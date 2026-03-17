export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

const LOG_METHODS: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: console.debug,
  info: console.log,
  warn: console.warn,
  error: console.error,
};

function emit(level: LogLevel, module: string, msg: string, data?: Record<string, unknown>): void {
  const entry = {
    level,
    module,
    msg,
    ...data,
    ts: new Date().toISOString(),
  };
  LOG_METHODS[level](JSON.stringify(entry));
}

export function createLogger(module: string): Logger {
  return {
    debug: (msg, data?) => emit("debug", module, msg, data),
    info: (msg, data?) => emit("info", module, msg, data),
    warn: (msg, data?) => emit("warn", module, msg, data),
    error: (msg, data?) => emit("error", module, msg, data),
  };
}

export const log = createLogger("app");
