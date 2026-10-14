interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues(array: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>;
}

/**
 * `crypto.randomUUID` exists only in secure contexts (HTTPS or localhost); lower environments may be
 * served over plain HTTP, so fall back to building an RFC 4122 v4 UUID from `getRandomValues`.
 */
export function newIdempotencyKey(cryptoImpl: CryptoLike = globalThis.crypto): string {
  if (typeof cryptoImpl.randomUUID === 'function') {
    return cryptoImpl.randomUUID();
  }
  const bytes = cryptoImpl.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
