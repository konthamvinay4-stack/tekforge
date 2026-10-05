import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const clusterId = new URL(request.url).searchParams.get("clusterId");
  if (!clusterId) return NextResponse.json({ error: "clusterId is required" }, { status: 400 });
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("agent_clusters").select("id,name,provider,status,kubernetes_version,nodes,pods,namespaces,tekton,last_heartbeat").eq("id", clusterId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ cluster: { id: clusterId, status: "pending" } });
    const stale = !data.last_heartbeat || Date.now() - new Date(data.last_heartbeat).getTime() > 45000;
    return NextResponse.json({ cluster: { id: data.id, name: data.name, provider: data.provider, status: stale ? "offline" : "connected", kubernetesVersion: data.kubernetes_version, nodes: data.nodes, pods: data.pods, namespaces: data.namespaces, tekton: data.tekton, lastHeartbeat: data.last_heartbeat } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Status unavailable" }, { status: 503 });
  }
}
