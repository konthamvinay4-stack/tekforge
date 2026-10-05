import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function secret() {
  return process.env.TEKFORGE_AGENT_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "development-only-change-me";
}

function claimsFrom(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (Date.now() > Number(data.expiresAt)) return null;
    return data as { clusterId: string };
  } catch { return null; }
}

export async function GET(request: Request) {
  const claims = claimsFrom(request);
  if (!claims) return NextResponse.json({ error: "Invalid or expired agent token." }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("agent_commands").select("id,type,payload,created_at").eq("cluster_id", claims.clusterId).eq("status", "queued").order("created_at", { ascending: true }).limit(5);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ commands: [] });
  const ids = data.map((command) => command.id);
  const { error: leaseError } = await admin.from("agent_commands").update({ status: "leased", leased_at: new Date().toISOString() }).in("id", ids).eq("status", "queued");
  if (leaseError) return NextResponse.json({ error: leaseError.message }, { status: 500 });
  return NextResponse.json({ commands: data });
}
