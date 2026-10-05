import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

function secret() {
  return process.env.TEKFORGE_AGENT_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "development-only-change-me";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const provider = String(body.provider || "Other").trim();
    if (!name) return NextResponse.json({ error: "Cluster name is required." }, { status: 400 });

    const clusterId = randomUUID();
    const now = Date.now();
    const expiresAt = now + 30 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ clusterId, name, provider, issuedAt: now, expiresAt })).toString("base64url");
    const signature = createHmac("sha256", secret()).update(payload).digest("base64url");

    return NextResponse.json({ clusterId, token: `${payload}.${signature}`, expiresAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate token" }, { status: 500 });
  }
}
