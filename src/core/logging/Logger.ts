export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const STORAGE_KEY = "stack-tutor:log-level";

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

export interface ScopedLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

class Logger {
  private static instance: Logger | null = null;
  private level: LogLevel;

  private constructor() {
    this.level = this.resolveInitialLevel();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }

    return Logger.instance;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setLevel(nextLevel: LogLevel): void {
    this.level = nextLevel;

    try {
      localStorage.setItem(STORAGE_KEY, nextLevel);
    } catch {
      // Ignore storage errors in restricted contexts.
    }
  }

  createScope(scope: string): ScopedLogger {
    return {
      debug: (message, data) => this.log("debug", scope, message, data),
      info: (message, data) => this.log("info", scope, message, data),
      warn: (message, data) => this.log("warn", scope, message, data),
      error: (message, data) => this.log("error", scope, message, data),
    };
  }

  private resolveInitialLevel(): LogLevel {
    const stored = this.readStoredLevel();
    if (stored) {
      return stored;
    }

    return import.meta.env.DEV ? "debug" : "info";
  }

  private readStoredLevel(): LogLevel | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return isLogLevel(raw) ? raw : null;
    } catch {
      return null;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return levelWeight[level] >= levelWeight[this.level];
  }

  private log(level: Exclude<LogLevel, "silent">, scope: string, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${scope}] ${message}`;
    const method = this.pickConsoleMethod(level);

    if (data === undefined) {
      method(prefix);
      return;
    }

    method(prefix, data);
  }

  private pickConsoleMethod(level: Exclude<LogLevel, "silent">): (...args: unknown[]) => void {
    if (level === "debug") {
      return console.debug;
    }

    if (level === "info") {
      return console.info;
    }

    if (level === "warn") {
      return console.warn;
    }

    return console.error;
  }
}

function isLogLevel(value: string | null): value is LogLevel {
  return value === "debug"
    || value === "info"
    || value === "warn"
    || value === "error"
    || value === "silent";
}

const sharedLogger = Logger.getInstance();

export function getLogger(scope: string): ScopedLogger {
  return sharedLogger.createScope(scope);
}

export function getGlobalLogger(): Logger {
  return sharedLogger;
}
