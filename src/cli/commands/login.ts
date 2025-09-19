import type { AuthMethod } from '../../models/cliDelegation';
import { AuthError, ValidationError } from '../../services/errors';
import type { AuthLoginHooks } from '../../services/authService';
import type { CliContext } from '../types';
import { getStringFlag, parseArgs, resolveOutputFormat, writeJson, writeLine } from '../utils';
import { handleDeviceCodePrompt } from '../auth/prompts';

const SUPPORTED_METHODS: AuthMethod[] = ['device-code', 'env-token', 'github-pat', 'github-session'];

export async function loginCommand(args: string[], context: CliContext): Promise<number> {
  const parsed = parseArgs(args);
  const method = (getStringFlag(parsed, 'method') ?? 'device-code') as AuthMethod;

  if (!SUPPORTED_METHODS.includes(method)) {
    throw new ValidationError(`Unsupported auth method: ${method}`);
  }

  const outputFormat = resolveOutputFormat(parsed, context.ciDefaultJson);

  try {
    const hooks: AuthLoginHooks | undefined =
      method === 'device-code'
        ? {
            onDeviceCode: async (info) => {
              await handleDeviceCodePrompt(info, context);
            },
          }
        : undefined;

    const session = await context.authService.login(method, hooks);
    const payload: Record<string, unknown> = {
      status: session.status,
      method: session.method,
    };

    if (session.expiresAt) {
      payload.expiresAt = session.expiresAt;
    }

    if (outputFormat === 'json') {
      writeJson(context.stdout, payload);
    } else {
      writeLine(context.stdout, `Authenticated via ${method}.`);
    }
    return 0;
  } catch (error) {
    if (error instanceof AuthError) {
      context.stderr.write(`${error.message}\n`);
      return error.exitCode;
    }
    throw error;
  }
}

export default loginCommand;
