import { formatWithOptions } from 'util';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

enum PriorityOf {
  debug,
  info,
  warn,
  error
}

export interface LoggerOptions {
  logger?: Logger;
  logLevel?: LogLevel;
  label?: string;
  write?: (data: unknown[], level?: LogLevel) => void;
}

export interface Logger {
  logLevel?: LogLevel;
  debug(...data: any[]): void;
  info(...data: any[]): void;
  warn(...data: any[]): void;
  error(...data: any[]): void;
}

/**
 * Basic logger implementation
 */
export class BasicLogger implements Logger {
  logLevel?: LogLevel;
  label: string;
  private readonly _logger: Logger;
  constructor(readonly options: LoggerOptions = {}) {
    this._logger = options.logger || console;
    this.logLevel = options.logLevel;
    this.label = options.label ?? 'uploadx:';
    this.write = options.write || this.write;
  }

  write = (data: unknown[], level: LogLevel): void => {
    if (!this.logLevel) return;
    if (PriorityOf[level] >= PriorityOf[this.logLevel]) {
      const message = formatWithOptions({ colors: true, depth: 1, maxStringLength: 80 }, ...data);
      const timestamp = new Date().toISOString();
      this._logger[level](`${timestamp} ${level.toUpperCase()} ${this.label} ${message}`);
    }
  };

  info(...data: unknown[]): void {
    this.write(data, 'info');
  }

  warn(...data: unknown[]): void {
    this.write(data, 'warn');
  }

  error(...data: unknown[]): void {
    this.write(data, 'error');
  }

  debug(...data: unknown[]): void {
    this.write(data, 'debug');
  }
}

export const logger = new BasicLogger({});
