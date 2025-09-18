import { setTimeout as delay } from 'node:timers/promises';
import { ValidationError } from '../../services/errors';
import type { CliContext } from '../types';
import { parseArgs, resolveOutputFormat, writeLine } from '../utils';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

export async function followCommand(args: string[], context: CliContext): Promise<number> {
  const parsed = parseArgs(args);
  const id = parsed.positionals[0];

  if (!id) {
    throw new ValidationError('Session id is required.');
  }

  await context.authService.requireSession();
  const format = resolveOutputFormat(parsed, context.ciDefaultJson);
  const pollInterval = Math.max(
    500,
    Number.parseInt(context.env.COPILOT_CLI_FOLLOW_INTERVAL_MS ?? '2000', 10)
  );

  const emitted = new Set<string>();
  const serializeEvent = (event: unknown) => JSON.stringify(event);

  let interrupted = false;
  const onSigint = () => {
    interrupted = true;
  };

  process.once('SIGINT', onSigint);

  try {
    while (!interrupted) {
      const events = await context.sessionService.getFollowEvents(id);
      let newlyEmitted = 0;

      for (const event of events) {
        const key = serializeEvent(event);
        if (emitted.has(key)) {
          continue;
        }
        emitted.add(key);
        newlyEmitted += 1;

        if (format === 'json') {
          context.stdout.write(`${JSON.stringify(event)}\n`);
        } else {
          if (event.type === 'status') {
            writeLine(context.stdout, `${event.timestamp}: status -> ${event.status}`);
          } else {
            writeLine(context.stdout, `${event.timestamp}: ${event.message}`);
          }
        }
      }

      const session = await context.sessionService.get(id);
      const terminal = TERMINAL_STATUSES.has(session.status);

      if (session.status === 'waiting' && session.needsUserInput) {
        context.stderr.write('Session is waiting for approval. Use "copilot-cli approve" or "copilot-cli deny" to respond.\n');
      }

      if (terminal && newlyEmitted === 0) {
        if (format === 'json') {
          context.stdout.write(`${JSON.stringify({ type: 'status', status: session.status, timestamp: session.updatedAt, sessionId: session.id })}\n`);
        } else {
          writeLine(context.stdout, `${session.updatedAt}: status -> ${session.status}`);
        }
        break;
      }

      await delay(pollInterval);
    }

    if (interrupted) {
      context.stderr.write('Streaming interrupted by user.\n');
    }

    return 0;
  } finally {
    process.removeListener('SIGINT', onSigint);
  }
}

export default followCommand;
