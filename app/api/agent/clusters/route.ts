import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("agent_clusters")
      .select("id,name,provider,status,kubernetes_version,nodes,pods,namespaces,tekton,last_heartbeat,metadata,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const clusters = (data || []).map((cluster) => {
      const stale = !cluster.last_heartbeat || Date.now() - new Date(cluster.last_heartbeat).getTime() > 45000;
      return { ...cluster, status: stale ? "offline" : cluster.status };
    });
    return NextResponse.json({ clusters });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load agents" }, { status: 500 });
  }
}
