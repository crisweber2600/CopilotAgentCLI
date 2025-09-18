import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  type AuthMethod,
  type AuthSession,
  type AuthStoreShape,
} from '../models/cliDelegation';
import { AuthError } from './errors';

export interface AuthServiceOptions {
  agentHome: string;
  env: NodeJS.ProcessEnv;
  now?: () => Date;
}

const AUTH_FILE = 'auth.json';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const DEVICE_CODE_CLIENT_ID = '01ab8ac9400c4e429b23';
const DEVICE_CODE_SCOPES = ['read:user', 'user:email', 'repo', 'workflow'];
const PAT_V3_URL = 'https://api.github.com';
const SESSION_TOKEN_URL = 'https://github.com/github-copilot/chat/token';
const DEFAULT_POLL_INTERVAL = 5;

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

interface DeviceCodeTokenError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

export interface DeviceCodePromptInfo {
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresAt: string;
}

export interface AuthLoginHooks {
  onDeviceCode?(info: DeviceCodePromptInfo): Promise<void> | void;
}

export class AuthService {
  private readonly authFilePath: string;

  constructor(private readonly options: AuthServiceOptions) {
    this.authFilePath = join(options.agentHome, AUTH_FILE);
  }

  async login(method: AuthMethod, hooks?: AuthLoginHooks): Promise<AuthSession> {
    switch (method) {
      case 'env-token':
        return this.loginWithEnvToken();
      case 'device-code':
        return this.loginWithDeviceCode(hooks);
      case 'github-pat':
        return this.loginWithGitHubPat();
      case 'github-session':
        return this.loginWithGitHubSession();
      default:
        throw new AuthError(`Unsupported authentication method: ${method}`);
    }
  }

  async getSession(): Promise<AuthSession | undefined> {
    const store = await this.readStore();
    if (!store.session) {
      return undefined;
    }
    return this.withoutSecret(store.session);
  }

  async requireSession(): Promise<AuthSession> {
    const store = await this.readStore();
    const session = store.session;
    if (!session || session.status !== 'authenticated') {
      throw new AuthError('No authenticated session found. Run "copilot-cli login" first.');
    }
    if (this.isSessionExpired(session)) {
      if (session.method === 'github-session') {
        const refreshed = await this.refreshGitHubSession(session);
        return this.withoutSecret(refreshed);
      }
      await this.expireSession(session);
      throw new AuthError('Authentication expired. Run "copilot-cli login" again.');
    }
    return this.withoutSecret(session);
  }

  async getAccessToken(): Promise<string> {
    const store = await this.readStore();
    const session = store.session;
    if (!session || session.status !== 'authenticated') {
      throw new AuthError('No authenticated session found. Run "copilot-cli login" first.');
    }
    if (this.isSessionExpired(session)) {
      if (session.method === 'github-session') {
        const refreshed = await this.refreshGitHubSession(session);
        return refreshed.token as string;
      }
      await this.expireSession(session);
      throw new AuthError('Authentication expired. Run "copilot-cli login" again.');
    }
    if (!session.token) {
      throw new AuthError('Authenticated session is missing an access token. Please login again.');
    }
    return session.token;
  }

  async logout(): Promise<void> {
    await fs.mkdir(this.options.agentHome, { recursive: true });
    await this.writeStore({});
  }

  private async loginWithEnvToken(): Promise<AuthSession> {
    const token = this.options.env.COPILOT_AGENT_TOKEN?.trim();
    if (!token) {
      throw new AuthError('Environment token not provided. Set COPILOT_AGENT_TOKEN.');
    }

    const session: AuthSession = {
      method: 'env-token',
      status: 'authenticated',
      token,
    };

    await this.persist(session);
    return this.withoutSecret(session);
  }

  private async loginWithGitHubPat(): Promise<AuthSession> {
    const token = this.options.env.GITHUB_TOKEN?.trim() ?? this.options.env.GITHUB_PAT?.trim();
    if (!token) {
      throw new AuthError('GitHub PAT not provided. Set GITHUB_TOKEN or GITHUB_PAT.');
    }

    try {
      const response = await fetch(`${PAT_V3_URL}/rate_limit`, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'copilot-cli',
        },
      });

      if (!response.ok) {
        throw new AuthError(`GitHub PAT validation failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(`GitHub PAT validation failed: ${(error as Error).message}`);
    }

    const session: AuthSession = {
      method: 'github-pat',
      status: 'authenticated',
      token,
    };

    await this.persist(session);
    return this.withoutSecret(session);
  }

  private async loginWithGitHubSession(): Promise<AuthSession> {
    const { token, expiresAt } = await this.fetchSessionToken();
    const session: AuthSession = {
      method: 'github-session',
      status: 'authenticated',
      token,
      expiresAt,
    };

    await this.persist(session);
    return this.withoutSecret(session);
  }

  private async loginWithDeviceCode(hooks?: AuthLoginHooks): Promise<AuthSession> {
    const issuedAt = this.options.now?.() ?? new Date();

    if (this.options.env.COPILOT_CLI_TEST_MODE) {
      const expiresAt = new Date(issuedAt.getTime() + 60 * 60 * 1000).toISOString();
      const session: AuthSession = {
        method: 'device-code',
        status: 'authenticated',
        expiresAt,
        token: 'device-code-test-token',
      };

      if (hooks?.onDeviceCode) {
        await hooks.onDeviceCode({
          userCode: 'TEST-CODE',
          verificationUri: 'https://github.com/login/device',
          verificationUriComplete: 'https://github.com/login/device?code=TEST-CODE',
          expiresAt,
        });
      }

      await this.persist(session);
      return this.withoutSecret(session);
    }

    const deviceCode = await this.requestDeviceCode();
    const deviceCodeExpiresAt = new Date(issuedAt.getTime() + deviceCode.expires_in * 1000);

    if (hooks?.onDeviceCode) {
      await hooks.onDeviceCode({
        userCode: deviceCode.user_code,
        verificationUri: deviceCode.verification_uri,
        verificationUriComplete: deviceCode.verification_uri_complete,
        expiresAt: deviceCodeExpiresAt.toISOString(),
      });
    }

    const tokenResult = await this.pollForAccessToken(deviceCode, issuedAt);
    const expiresAt =
      tokenResult.expiresInSeconds !== undefined
        ? new Date(Date.now() + tokenResult.expiresInSeconds * 1000).toISOString()
        : undefined;

    const session: AuthSession = {
      method: 'device-code',
      status: 'authenticated',
      ...(expiresAt ? { expiresAt } : {}),
      token: tokenResult.token,
    };

    await this.persist(session);
    return this.withoutSecret(session);
  }

  private async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const payload = {
      client_id: DEVICE_CODE_CLIENT_ID,
      scope: DEVICE_CODE_SCOPES.join(' '),
    };

    let response: Response;
    try {
      response = await fetch(DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new AuthError(`Failed to contact GitHub for device code: ${(error as Error).message}`);
    }

    if (!response.ok) {
      throw new AuthError(`GitHub device-code request failed with HTTP ${response.status}.`);
    }

    const data = (await response.json()) as Partial<DeviceCodeResponse> & Partial<DeviceCodeTokenError>;

    if (!data || typeof data.device_code !== 'string' || typeof data.user_code !== 'string' || typeof data.verification_uri !== 'string' || typeof data.expires_in !== 'number') {
      const description = data?.error_description ?? 'Unexpected response from GitHub device-code endpoint.';
      throw new AuthError(description);
    }

    return {
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      verification_uri_complete: data.verification_uri_complete,
      expires_in: data.expires_in,
      interval: data.interval,
    };
  }

  private async pollForAccessToken(
    device: DeviceCodeResponse,
    issuedAt: Date
  ): Promise<{ token: string; expiresInSeconds?: number }> {
    let intervalSeconds = device.interval ?? DEFAULT_POLL_INTERVAL;
    const grantType = 'urn:ietf:params:oauth:grant-type:device_code';
    const expiresMs = issuedAt.getTime() + device.expires_in * 1000;

    while (Date.now() < expiresMs) {
      await this.delay(intervalSeconds * 1000);

      let response: Response;
      try {
        response = await fetch(ACCESS_TOKEN_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: DEVICE_CODE_CLIENT_ID,
            device_code: device.device_code,
            grant_type: grantType,
          }),
        });
      } catch (error) {
        throw new AuthError(`Failed to poll GitHub for access token: ${(error as Error).message}`);
      }

      if (!response.ok) {
        throw new AuthError(`GitHub token polling failed with HTTP ${response.status}.`);
      }

      const result = (await response.json()) as DeviceCodeTokenError & {
        access_token?: string;
        expires_in?: number;
      };

      if (result.access_token) {
        const expiresInSeconds = typeof result.expires_in === 'number' ? result.expires_in : undefined;
        return { token: result.access_token, expiresInSeconds };
      }

      switch (result.error) {
        case 'authorization_pending':
          continue;
        case 'slow_down':
          intervalSeconds += DEFAULT_POLL_INTERVAL;
          continue;
        case 'expired_token':
          throw new AuthError('Device code expired before authorization was completed.');
        case 'access_denied':
          throw new AuthError('Authorization denied in browser.');
        default:
          throw new AuthError(result.error_description ?? 'Unknown error while exchanging device code.');
      }
    }

    throw new AuthError('Device code expired before authorization was completed.');
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async persist(session: AuthSession): Promise<void> {
    await fs.mkdir(this.options.agentHome, { recursive: true });
    await this.writeStore({ session });
  }

  private async readStore(): Promise<AuthStoreShape> {
    try {
      const raw = await fs.readFile(this.authFilePath, 'utf8');
      return JSON.parse(raw) as AuthStoreShape;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  private withoutSecret(session: AuthSession): AuthSession {
    const sanitized: AuthSession = { ...session };
    if ('token' in sanitized) {
      delete sanitized.token;
    }
    return sanitized;
  }

  private async refreshGitHubSession(session: AuthSession): Promise<AuthSession> {
    const { token, expiresAt } = await this.fetchSessionToken();
    const refreshed: AuthSession = {
      ...session,
      token,
      expiresAt,
      status: 'authenticated',
    };
    await this.persist(refreshed);
    return refreshed;
  }

  private isSessionExpired(session: AuthSession): boolean {
    if (session.status !== 'authenticated' || !session.expiresAt) {
      return false;
    }
    const expiry = Date.parse(session.expiresAt);
    if (Number.isNaN(expiry)) {
      return false;
    }
    const skewMs = 60_000;
    return expiry - skewMs <= Date.now();
  }

  private async expireSession(session: AuthSession): Promise<void> {
    const expiredSession: AuthSession = {
      method: session.method,
      status: 'expired',
      expiresAt: session.expiresAt,
    };
    await this.writeStore({ session: expiredSession });
  }

  private async writeStore(store: AuthStoreShape): Promise<void> {
    await fs.mkdir(this.options.agentHome, { recursive: true });
    await fs.writeFile(this.authFilePath, JSON.stringify(store, null, 2), 'utf8');
  }

  private sessionCookie(): string {
    const raw = this.options.env.COPILOT_CLI_SESSION_COOKIE?.trim() ?? this.options.env.GITHUB_USER_SESSION?.trim();
    if (!raw) {
      throw new AuthError('Session cookie not provided. Set COPILOT_CLI_SESSION_COOKIE or GITHUB_USER_SESSION.');
    }
    return raw.includes('user_session=') ? raw : `user_session=${raw}`;
  }

  private async fetchSessionToken(): Promise<{ token: string; expiresAt?: string }> {
    const cookie = this.sessionCookie();
    let response: Response;
    try {
      response = await fetch(SESSION_TOKEN_URL, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'X-Requested-With': 'XMLHttpRequest',
          'GitHub-Verified-Fetch': 'true',
          Origin: 'https://github.com',
          Accept: 'application/json',
        },
      });
    } catch (error) {
      throw new AuthError(`Failed to contact GitHub for Copilot token: ${(error as Error).message}`);
    }

    if (!response.ok) {
      throw new AuthError(`GitHub session token request failed with HTTP ${response.status}.`);
    }

    const data = (await response.json()) as { token?: string; expiration?: string };
    if (!data.token) {
      throw new AuthError('GitHub session token response did not include a token.');
    }

    return { token: data.token, expiresAt: data.expiration };
  }
}
