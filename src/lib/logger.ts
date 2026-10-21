/**
 * Safe logger - filters sensitive data in production.
 * Use this instead of console.log/console.warn/console.error directly.
 */

const isProduction = !__DEV__;

const SENSITIVE_KEYS = [
  "token",
  "access_token",
  "refresh_token",
  "password",
  "secret",
  "authorization",
  "cookie",
  "api_key",
  "apikey",
  "key",
];

function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((k) => lowerKey.includes(k))) {
      out[key] = "[REDACTED]";
    } else {
      out[key] = sanitize(value);
    }
  }
  return out;
}

export const logger = {
  log: (...args: unknown[]): void => {
    if (isProduction) {
      console.log(...args.map(sanitize));
    } else {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]): void => {
    if (isProduction) {
      console.warn(...args.map(sanitize));
    } else {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]): void => {
    if (isProduction) {
      console.error(...args.map(sanitize));
    } else {
      console.error(...args);
    }
  },
  // For debug-only logs that should never appear in production
  debug: (...args: unknown[]): void => {
    if (!isProduction) console.log(...args);
  },
};