/**
 * Minimal logger interface injected into SDK orchestrators so they can emit
 * debug output without importing a concrete logging implementation.
 *
 * The CLI wires its `filelogger` into these hooks; other consumers can pass
 * `console` or a no-op.
 */
export interface Logger {
  debug(message: string): void
  warn(message: string): void
  error(message: string): void
  log(message: string): void
}

export const NOOP_LOGGER: Logger = {
  debug: () => {},
  warn: () => {},
  error: () => {},
  log: () => {},
}
