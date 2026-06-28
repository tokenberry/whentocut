import { PartnerCredentials } from "./partnerClient";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

/**
 * Resolve partner credentials for a request:
 *   1. the signed-in user's own encrypted Steamworks key (per-user, from Postgres), else
 *   2. the server's single-tenant env key (owner fallback), else null.
 *
 * Returns null when nothing is configured so the app degrades to public-only data.
 * Server-side only — never import from a client component.
 */
export async function resolvePartnerCreds(
  userId?: string | null,
): Promise<PartnerCredentials | null> {
  if (userId) {
    const cred = await prisma.partnerCredential.findUnique({ where: { userId } });
    if (cred) {
      return {
        webApiKey: decryptSecret({
          encryptedKey: cred.encryptedKey,
          iv: cred.iv,
          authTag: cred.authTag,
        }),
      };
    }
  }

  const envKey =
    process.env.STEAMWORKS_FINANCIAL_KEY?.trim() ||
    process.env.STEAMWORKS_PARTNER_KEY?.trim();
  return envKey ? { webApiKey: envKey } : null;
}

/** Whether a single-tenant env key is configured at all. */
export function partnerConfigured(): boolean {
  return Boolean(
    process.env.STEAMWORKS_FINANCIAL_KEY?.trim() ||
      process.env.STEAMWORKS_PARTNER_KEY?.trim(),
  );
}
