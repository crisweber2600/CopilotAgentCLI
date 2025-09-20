export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerContext {
  workItemId?: string;
  attemptId?: string;
  stepKey?: string;
  executor?: string;
  gitSha?: string;
  [key: string]: unknown;
}

export class Logger {
  constructor(private readonly context: LoggerContext = {}) {}

  child(additional: LoggerContext): Logger {
    return new Logger({ ...this.context, ...additional });
  }

  debug(message: string, fields?: LoggerContext): void {
    this.log('debug', message, fields);
  }

  info(message: string, fields?: LoggerContext): void {
    this.log('info', message, fields);
  }

  warn(message: string, fields?: LoggerContext): void {
    this.log('warn', message, fields);
  }

  error(message: string, fields?: LoggerContext): void {
    this.log('error', message, fields);
  }

  private log(level: LogLevel, message: string, fields?: LoggerContext): void {
    const payload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...(fields ?? {}),
    };

    if (level === 'error') {
      console.error(JSON.stringify(payload));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(payload));
    } else if (level === 'debug') {
      if (process.env.DEBUG?.toLowerCase() === 'true') {
        console.debug(JSON.stringify(payload));
      }
    } else {
      console.log(JSON.stringify(payload));
    }
  }
}

export const logger = new Logger({ gitSha: process.env.GITHUB_SHA });
