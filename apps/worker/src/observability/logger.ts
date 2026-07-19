/**
 * Minimal structured JSON logger. Logs must never contain secrets, tokens or
 * personal data (see 02_SYSTEM_ARCHITECTURE section 15.3). Timestamps are added
 * per line; callers pass only non-sensitive structured fields.
 */
export type LogLevel = "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

function write(level: LogLevel, event: string, fields: LogFields): void {
  const line = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const logger = {
  info: (event: string, fields: LogFields = {}) => write("info", event, fields),
  warn: (event: string, fields: LogFields = {}) => write("warn", event, fields),
  error: (event: string, fields: LogFields = {}) =>
    write("error", event, fields),
};
