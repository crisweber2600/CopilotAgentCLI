import { ValidationError } from '../../services/errors';
import type { CliContext } from '../types';
import { getStringFlag, parseArgs, resolveOutputFormat, writeJson, writeLine } from '../utils';

export async function approveCommand(args: string[], context: CliContext): Promise<number> {
  const parsed = parseArgs(args);
  const id = parsed.positionals[0];
  if (!id) {
    throw new ValidationError('Session id is required to approve a pending action.');
  }

  await context.authService.requireSession();

  const note = getStringFlag(parsed, 'note');
  const format = resolveOutputFormat(parsed, context.ciDefaultJson);
  const result = await context.sessionService.approve(id, { note });

  const payload = {
    id: result.id,
    status: result.status,
    needsUserInput: result.needsUserInput,
    updatedAt: result.updatedAt,
  };

  if (format === 'json') {
    writeJson(context.stdout, payload);
  } else {
    writeLine(context.stdout, `Approved session ${result.id}. Status is now ${result.status}.`);
  }

  return 0;
}

export default approveCommand;
