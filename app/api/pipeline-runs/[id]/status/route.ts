import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPipelineRun } from "@/lib/tekton/client";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: run, error } = await supabase.from("pipeline_runs").select("*").eq("id", id).single();
  if (error || !run) return NextResponse.json({ error: error?.message || "Pipeline run not found" }, { status: 404 });
  if (!run.tekton_pipeline_run_name) return NextResponse.json({ run });

  try {
    const status = await getPipelineRun(run.tekton_pipeline_run_name);
    const updates: Record<string, unknown> = { status: status.status.toLowerCase() };
    if (status.startedAt) updates.started_at = status.startedAt;
    if (status.completedAt) updates.finished_at = status.completedAt;

    const { data: updated, error: updateError } = await supabase.from("pipeline_runs").update(updates).eq("id", id).select().single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ run: updated, tekton: status });
  } catch (error) {
    return NextResponse.json({ run, tektonError: error instanceof Error ? error.message : "Unable to reach Tekton" }, { status: 502 });
  }
}
