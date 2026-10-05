import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function secret() {
  return process.env.TEKFORGE_AGENT_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "development-only-change-me";
}

function verifyToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (Date.now() > Number(data.expiresAt)) return null;
  return data as { clusterId: string; name: string; provider: string };
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const claims = verifyToken(authorization.replace(/^Bearer\s+/i, ""));
    if (!claims) return NextResponse.json({ error: "Invalid or expired agent token." }, { status: 401 });

    const body = await request.json();
    const cluster = body.cluster || {};
    const admin = createAdminClient();
    const { error } = await admin.from("agent_clusters").upsert({
      id: claims.clusterId,
      name: claims.name,
      provider: claims.provider,
      status: "connected",
      kubernetes_version: cluster.kubernetesVersion || null,
      nodes: Number(cluster.nodes || 0),
      pods: Number(cluster.pods || 0),
      namespaces: Number(cluster.namespaces || 0),
      tekton: Boolean(cluster.tekton),
      last_heartbeat: new Date().toISOString(),
      metadata: cluster,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, clusterId: claims.clusterId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Heartbeat failed" }, { status: 500 });
  }
}
