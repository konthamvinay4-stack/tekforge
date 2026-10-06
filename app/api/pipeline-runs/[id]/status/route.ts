import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPipelineRun } from "@/lib/tekton/client";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: run, error } = await supabase.from("pipeline_runs").select("*").eq("id", id).single();
  if (error || !run) return NextResponse.json({ error: error?.message || "Pipeline run not found" }, { status: 404 });
  if (!run.tekton_pipeline_run_name) return NextResponse.json({ run });

  if (run.cluster_id) {
    const { data: existing } = await supabase.from("agent_commands")
      .select("id,status,result,error,completed_at")
      .eq("cluster_id", run.cluster_id)
      .eq("type", "get-pipelinerun")
      .contains("payload", { pipelineRunId: id })
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (existing?.status === "completed" && existing.result?.resource) {
      const condition = existing.result.resource.status?.conditions?.find((item: any) => item.type === "Succeeded");
      const status = condition?.status === "True" ? "succeeded" : condition?.status === "False" ? "failed" : "running";
      await supabase.from("pipeline_runs").update({
        status,
        finished_at: condition?.status === "True" || condition?.status === "False" ? (existing.completed_at || new Date().toISOString()) : null,
      }).eq("id", id);
      return NextResponse.json({ run: { ...run, status }, agent: existing.result });
    }

    if (!existing || existing.status === "completed" || existing.status === "failed") {
      await supabase.from("agent_commands").insert({
        cluster_id: run.cluster_id,
        type: "get-pipelinerun",
        payload: { pipelineRunId: id, namespace: process.env.TEKFORGE_TEKTON_NAMESPACE || "tekforge", name: run.tekton_pipeline_run_name },
        status: "queued",
      });
    }
    return NextResponse.json({ run, status: "pending-agent", commandId: existing?.id || null }, { status: 202 });
  }

  try {
    const status = await getPipelineRun(run.tekton_pipeline_run_name);
    const updates: Record<string, unknown> = { status: status.status.toLowerCase() };
    if (status.startedAt) updates.started_at = status.startedAt;
    if (status.completedAt) updates.finished_at = status.completedAt;
    const { data: updated, error: updateError } = await supabase.from("pipeline_runs").update(updates).eq("id", id).select().single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ run: updated, tekton: status });
  } catch (e) {
    return NextResponse.json({ run, tektonError: e instanceof Error ? e.message : "Unable to reach Tekton" }, { status: 502 });
  }
}
