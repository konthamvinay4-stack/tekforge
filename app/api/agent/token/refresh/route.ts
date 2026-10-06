import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function secret() { return process.env.TEKFORGE_AGENT_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "development-only-change-me"; }

function verify(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Date.now() <= Number(data.expiresAt) ? data : null;
  } catch { return null; }
}

export async function POST(request: Request) {
  try {
    const current = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const claims = verify(current);
    if (!claims) return NextResponse.json({ error: "Invalid or expired agent token." }, { status: 401 });
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ clusterId: claims.clusterId, name: claims.name, provider: claims.provider, issuedAt: now, expiresAt })).toString("base64url");
    const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
    return NextResponse.json({ token: payload + "." + signature, expiresAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to refresh token" }, { status: 500 });
  }
}
