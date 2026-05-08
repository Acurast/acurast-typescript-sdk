/**
 * Abstraction over persistent key storage for ECDH keypairs used when
 * encrypting job environment variables. Implementations decide whether to
 * persist to disk, a database, or memory.
 *
 * The CLI ships a file-backed implementation (`.acurast/keys.json`); other
 * consumers can supply an in-memory store (see `InMemoryKeyStore`).
 */
export interface KeyStore {
  getItem(key: string): string | null | undefined
  setItem(key: string, value: string): void
}

/**
 * Ephemeral `KeyStore` that keeps keys only in process memory. Useful for
 * short-lived scripts or tests where no persistence is desired.
 */
export class InMemoryKeyStore implements KeyStore {
  private readonly store = new Map<string, string>()

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}
