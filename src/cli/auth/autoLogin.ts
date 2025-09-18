import type { AuthLoginHooks } from '../../services/authService';
import { AuthError } from '../../services/errors';
import type { CliContext } from '../types';
import { handleDeviceCodePrompt, shouldAttemptBrowserOpen } from './prompts';

function envTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}

function nonInteractive(context: CliContext): boolean {
  return envTruthy(context.env.COPILOT_CLI_NON_INTERACTIVE) || envTruthy(context.env.CI);
}

export async function attemptAutoLogin(context: CliContext): Promise<boolean> {
  const tokenFromEnv = context.env.COPILOT_AGENT_TOKEN?.trim();
  if (tokenFromEnv) {
    try {
      await context.authService.login('env-token');
      context.stderr.write('Authenticated using COPILOT_AGENT_TOKEN.\n');
      return true;
    } catch (error) {
      if (error instanceof AuthError) {
        context.stderr.write(`${error.message}\n`);
      } else if (error instanceof Error) {
        context.stderr.write(`Failed to authenticate using COPILOT_AGENT_TOKEN: ${error.message}\n`);
      }
      return false;
    }
  }

  if (nonInteractive(context)) {
    context.stderr.write('Automatic login skipped (non-interactive environment).\n');
    return false;
  }

  const hooks: AuthLoginHooks = {
    onDeviceCode: async (info) => {
      await handleDeviceCodePrompt(info, context);
    },
  };

  try {
    if (!shouldAttemptBrowserOpen(context)) {
      context.stderr.write('Follow the on-screen instructions to complete sign-in.\n');
    }
    await context.authService.login('device-code', hooks);
    context.stderr.write('Authentication complete.\n');
    return true;
  } catch (error) {
    if (error instanceof AuthError) {
      context.stderr.write(`${error.message}\n`);
    } else if (error instanceof Error) {
      context.stderr.write(`Login failed: ${error.message}\n`);
    } else {
      context.stderr.write('Login failed due to an unknown error.\n');
    }
    return false;
  }
}

export async function ensureAuthenticated(context: CliContext): Promise<void> {
  try {
    await context.authService.requireSession();
    return;
  } catch (error) {
    if (!(error instanceof AuthError)) {
      throw error;
    }
    context.stderr.write('Authentication required. Attempting to log in...\n');
    const loggedIn = await attemptAutoLogin(context);
    if (!loggedIn) {
      throw error;
    }
  }

  await context.authService.requireSession();
}
