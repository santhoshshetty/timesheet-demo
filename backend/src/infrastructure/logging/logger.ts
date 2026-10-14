import pino from 'pino';
import type { LogLevel } from '../config/config';

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export interface AppLogger extends Logger {
  /** Underlying pino instance, used only by the HTTP request logger. */
  readonly pino: pino.Logger;
}

const REDACT_PATHS = ['req.headers.authorization', 'req.headers.cookie'];

export function createLogger(level: LogLevel, destination?: pino.DestinationStream): AppLogger {
  return wrap(pino({ level, redact: REDACT_PATHS }, destination));
}

function wrap(instance: pino.Logger): AppLogger {
  return {
    pino: instance,
    info: (message, context) => instance.info(context ?? {}, message),
    warn: (message, context) => instance.warn(context ?? {}, message),
    error: (message, context) => instance.error(context ?? {}, message),
    child: (bindings) => wrap(instance.child(bindings)),
  };
}
