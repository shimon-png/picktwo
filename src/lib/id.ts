const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function randomString(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % 62];
  return out;
}

/** Sortable-ish unique id for primary keys. */
export function createId(): string {
  return Date.now().toString(36) + randomString(12);
}

/** 8-char base62 public slug for battles. */
export function createSlug(): string {
  return randomString(8);
}
