import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function secret() { return process.env.TEKFORGE_AGENT_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "development-only-change-me"; }
function valid(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try { const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); return Date.now() <= Number(data.expiresAt); } catch { return false; }
}

export async function POST(request: Request) {
  if (!valid(request)) return NextResponse.json({ error: "Invalid or expired agent token." }, { status: 401 });
  try {
    const body = await request.json() as { commandId?: string; status?: "completed" | "failed"; result?: unknown; error?: string };
    if (!body.commandId || !body.status) return NextResponse.json({ error: "commandId and status are required." }, { status: 400 });
    const admin = createAdminClient();
    const { error } = await admin.from("agent_commands").update({ status: body.status, result: body.result ?? null, error: body.error ?? null, completed_at: new Date().toISOString() }).eq("id", body.commandId).eq("status", "leased");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update command" }, { status: 400 }); }
}
