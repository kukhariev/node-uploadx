import {
  configureSync,
  getLogger,
  getConsoleSink,
  type LogLevel as LogTapeLogLevel,
  type Logger as LogTapeLogger
} from '@logtape/logtape';

export type LogLevel = LogTapeLogLevel;

export type Logger = LogTapeLogger;

/**
 * The primary logger for the uploadx library.
 * Applications should configure the 'uploadx' category.
 *
 * @example
 * ```ts
 * await configure({
 *   sinks: { console: getConsoleSink() },
 *   loggers: [{ category: ['uploadx'], lowestLevel: 'info', sinks: ['console'] }]
 * });
 * ```
 */
export const uploadxLogger: LogTapeLogger = getLogger(['uploadx']);

/**
 * Normalizes legacy log levels (e.g. 'warn') to LogTape's format
 */
function toLogTapeLevel(level: string): LogTapeLogLevel {
  return level === 'warn' ? 'warning' : (level as LogTapeLogLevel);
}

/**
 * Configures the LogTape logger for simple console output if a logLevel is provided and not 'none'.
 * This function is called from the Storage constructor to enable logging based on user configuration.
 */
export function configureSimpleLogger(logLevel: string | undefined): void {
  if (!logLevel || logLevel === 'none') return;
  configureSync({
    sinks: { console: getConsoleSink() },
    loggers: [
      {
        category: ['uploadx'],
        lowestLevel: toLogTapeLevel(logLevel),
        sinks: ['console']
      },
      // Suppress internal LogTape messages
      {
        category: ['logtape', 'meta'],
        lowestLevel: 'warning',
        sinks: ['console']
      }
    ]
  });
}

/** @deprecated Use `uploadxLogger` instead */
export const logger = uploadxLogger;

// Re-export for library consumers who may need to create their own loggers
export { configureSync, getConsoleSink, getLogger };
