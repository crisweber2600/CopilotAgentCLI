import { ValidationError, isServiceError } from '../../services/errors';
import type { CliContext } from '../types';
import { parseArgs, resolveOutputFormat, writeJson, writeLine } from '../utils';

export async function cancelCommand(args: string[], context: CliContext): Promise<number> {
  const parsed = parseArgs(args);
  const id = parsed.positionals[0];

  if (!id) {
    throw new ValidationError('Session id is required.');
  }

  await context.authService.requireSession();

  const format = resolveOutputFormat(parsed, context.ciDefaultJson);
  let session;
  try {
    session = await context.sessionService.cancel(id);
  } catch (error) {
    if (isServiceError(error) && error.exitCode === 6) {
      const latest = await context.sessionService.get(id);
      if (latest.status === 'cancelled') {
        session = latest;
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  const payload = { id: session.id, status: session.status };

  if (format === 'json') {
    writeJson(context.stdout, payload);
  } else {
    writeLine(context.stdout, `Cancelled session ${session.id}.`);
  }

  return 0;
}

export default cancelCommand;
