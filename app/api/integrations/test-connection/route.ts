import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clusterId, namespace = "tekforge", integration, serverUrl, credentialSecret } = body;
    if (!clusterId || !integration) return NextResponse.json({ error: "clusterId and integration are required." }, { status: 400 });

    if (!["sonarqube", "sonarcloud"].includes(integration)) {
      return NextResponse.json({ ok: true, status: "ready", message: "This integration runs locally in the Tekton task; no external connection is required." });
    }
    if (!serverUrl) return NextResponse.json({ error: "Server URL is required." }, { status: 400 });
    if (!/^https?:\/\//i.test(serverUrl)) return NextResponse.json({ error: "Server URL must start with http:// or https://." }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin.from("agent_commands").insert({
      cluster_id: clusterId,
      type: "test-integration",
      payload: { namespace, integration, serverUrl, credentialSecret: credentialSecret || null },
      status: "queued",
    }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, commandId: data.id, status: "queued" }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to test integration." }, { status: 400 });
  }
}
