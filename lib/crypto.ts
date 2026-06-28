import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for secrets at rest (Steamworks partner keys).
 * ENCRYPTION_KEY must be 32 bytes as 64 hex chars. Generate with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Server-side only. Never log plaintext keys.
 */

const ALGO = "aes-256-gcm";

function key(): Buffer {
  const hex = process.env.ENCRYPTION_KEY?.trim();
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be set to 64 hex chars (32 bytes).");
  }
  return Buffer.from(hex, "hex");
}

export interface Encrypted {
  encryptedKey: string; // hex
  iv: string; // hex
  authTag: string; // hex
}

export function encryptSecret(plaintext: string): Encrypted {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    encryptedKey: enc.toString("hex"),
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
  };
}

export function decryptSecret(e: Encrypted): string {
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(e.iv, "hex"));
  decipher.setAuthTag(Buffer.from(e.authTag, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(e.encryptedKey, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
