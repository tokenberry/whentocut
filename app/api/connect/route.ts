import { NextRequest, NextResponse } from "next/server";
import { listPartnerApps } from "@/lib/steam/partnerClient";
import { PartnerAuthError, PartnerApiError } from "@/lib/steam/partnerApiClient";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

/**
 * POST /api/connect  { webApiKey }
 * Validates a Steamworks publisher/financial key (GetPartnerAppListForWebAPIKey) and,
 * for the signed-in user, stores it ENCRYPTED (AES-GCM) in PartnerCredential.
 *
 * The key is handled server-side only and is NEVER echoed, logged, or returned.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: { webApiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const webApiKey = (body.webApiKey ?? "").trim();
  if (webApiKey.length < 16) {
    return NextResponse.json({ error: "Invalid Steamworks Web API key" }, { status: 400 });
  }

  try {
    const apps = await listPartnerApps(webApiKey); // validates the key
    const enc = encryptSecret(webApiKey);
    await prisma.partnerCredential.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...enc },
      update: enc,
    });
    return NextResponse.json({
      ok: true,
      connected: true,
      accessibleAppids: apps.map((a) => a.appid),
      appCount: apps.length,
    });
  } catch (err) {
    if (err instanceof PartnerAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof PartnerApiError) {
      return NextResponse.json(
        { error: `Steamworks partner API error (HTTP ${err.status}).` },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "Failed to validate key" }, { status: 502 });
  }
}

/** DELETE /api/connect — disconnect the user's stored key. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  await prisma.partnerCredential.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ ok: true, connected: false });
}
