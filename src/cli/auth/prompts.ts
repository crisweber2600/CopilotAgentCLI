import type { DeviceCodePromptInfo } from '../../services/authService';
import type { CliContext } from '../types';
import open from 'open';

export async function handleDeviceCodePrompt(info: DeviceCodePromptInfo, context: CliContext): Promise<void> {
  const codeMessage = `To finish the device-code sign-in, visit ${info.verificationUri} and enter code ${info.userCode}.`;
  context.stderr.write(`${codeMessage}\n`);

  if (info.verificationUriComplete) {
    context.stderr.write(`Direct link: ${info.verificationUriComplete}\n`);
  }

  await tryOpenVerificationUrl(info, context);

  const expires = info.expiresAt ? ` (expires at ${info.expiresAt})` : '';
  context.stderr.write(`Waiting for authorization to complete${expires}...\n`);
}

async function tryOpenVerificationUrl(info: DeviceCodePromptInfo, context: CliContext): Promise<void> {
  if (!shouldAttemptBrowserOpen(context)) {
    return;
  }

  const target = info.verificationUriComplete ?? info.verificationUri;

  try {
    await open(target, { wait: false });
  } catch (error) {
    if (context.verbose) {
      context.stderr.write(`Unable to open browser automatically: ${(error as Error).message}\n`);
    }
  }
}

export function shouldAttemptBrowserOpen(context: CliContext): boolean {
  if (context.env.COPILOT_CLI_TEST_MODE) {
    return false;
  }
  if (context.env.COPILOT_CLI_NO_BROWSER) {
    return false;
  }
  if (context.env.CI) {
    return false;
  }

  const stdoutTty = Boolean((context.stdout as { isTTY?: boolean }).isTTY);
  const stderrTty = Boolean((context.stderr as { isTTY?: boolean }).isTTY);
  return stdoutTty || stderrTty;
}