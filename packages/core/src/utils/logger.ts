import { formatWithOptions } from 'util';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';
const levels = ['debug', 'info', 'warn', 'error', 'none'];

enum PriorityOf {
  debug,
  info,
  warn,
  error,
  none
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
  label: string;
  private readonly logger: Logger;
  private _logLevel: LogLevel = 'none';

  constructor(readonly options: LoggerOptions = {}) {
    this.logger = options.logger || console;
    this.label = options.label ?? 'uploadx:';
    if (options.logLevel) this.logLevel = options.logLevel;
    if (options.write) this.write = options.write;
  }

  get logLevel(): LogLevel {
    return this._logLevel;
  }

  set logLevel(value: LogLevel) {
    if (value && !levels.includes(value)) {
      throw new Error(`Invalid log level: ${value}, supported levels are: ${levels.join(', ')}.`);
    }
    this._logLevel = value;
  }

  write = (data: unknown[], level: Exclude<LogLevel, 'none'>): void => {
    if (PriorityOf[level] >= PriorityOf[this._logLevel]) {
      const message = formatWithOptions({ depth: 2, maxStringLength: 80 }, ...data);
      const timestamp = new Date().toISOString();
      this.logger[level](`${timestamp} ${level.toUpperCase()} ${this.label} ${message}`);
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

export const logger = new BasicLogger();
