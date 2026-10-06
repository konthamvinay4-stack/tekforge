import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function secret() { return process.env.TEKFORGE_AGENT_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "development-only-change-me"; }
function valid(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try { const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); return Date.now() <= Number(data.expiresAt) ? data : null; } catch { return null; }
}

export async function POST(request: Request) {
  const claims = valid(request);
  if (!claims) return NextResponse.json({ error: "Invalid or expired agent token." }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.commandId || !body.status) return NextResponse.json({ error: "commandId and status are required." }, { status: 400 });

    const admin = createAdminClient();
    const { data: command, error: commandReadError } = await admin.from("agent_commands")
      .select("id,cluster_id,type,payload").eq("id", body.commandId).single();
    if (commandReadError || !command) return NextResponse.json({ error: "Command not found." }, { status: 404 });
    if (command.cluster_id !== claims.clusterId) return NextResponse.json({ error: "Command does not belong to this agent." }, { status: 403 });

    const { error } = await admin.from("agent_commands").update({
      status: body.status, result: body.result ?? null, error: body.error ?? null, completed_at: new Date().toISOString()
    }).eq("id", body.commandId).eq("status", "leased");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const pipelineRunId = command.payload?.pipelineRunId;
    const resourceName = body.result?.resource?.metadata?.name;
    if (pipelineRunId && command.type === "create-pipelinerun") {
      await admin.from("pipeline_runs").update({
        status: body.status === "completed" && resourceName ? "running" : "failed",
        tekton_pipeline_run_name: resourceName || null,
        started_at: body.status === "completed" && resourceName ? new Date().toISOString() : null,
        finished_at: body.status === "failed" ? new Date().toISOString() : null,
      }).eq("id", pipelineRunId);
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update command" }, { status: 400 }); }
}
