import crypto from "crypto";

/**
 * Encrypts small secrets (eBay login tokens) before they are written to disk,
 * so a copied data file or a leaked backup does not hand over anyone's eBay
 * access. AES-256-GCM: a wrong key or any change to the stored text fails to
 * decrypt instead of returning rubbish.
 *
 * The key comes from TOKEN_ENCRYPTION_KEY, set on the host and never stored
 * with the data. With no key set nothing is encrypted and nothing is stored:
 * callers must treat "not configured" as "feature off".
 */

let cachedKey: { source: string; key: Buffer } | null = null;

function key(): Buffer | null {
  const source = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  // A short key is a weak key; refuse it rather than quietly accept it.
  if (!source || source.length < 32) return null;
  if (cachedKey?.source === source) return cachedKey.key;
  cachedKey = { source, key: crypto.scryptSync(source, "flippilot-token-store-v1", 32) };
  return cachedKey.key;
}

export function encryptionConfigured(): boolean {
  return key() !== null;
}

/** JSON in, one opaque base64 string out (iv + auth tag + ciphertext). */
export function encryptJson(value: unknown): string {
  const k = key();
  if (!k) throw new Error("TOKEN_ENCRYPTION_KEY is not set (32+ characters needed)");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

/** The value back, or null if the key is wrong or the text was changed. */
export function decryptJson<T = unknown>(payload: string): T | null {
  const k = key();
  if (!k) return null;
  try {
    const raw = Buffer.from(payload, "base64");
    if (raw.length < 12 + 16 + 1) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", k, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const data = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    return JSON.parse(data.toString("utf8")) as T;
  } catch {
    return null;
  }
}
