import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cancelPipelineRun } from "@/lib/tekton/client";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: run, error } = await supabase.from("pipeline_runs").select("*").eq("id", id).single();
  if (error || !run) return NextResponse.json({ error: error?.message || "Pipeline run not found" }, { status: 404 });
  if (!run.tekton_pipeline_run_name) return NextResponse.json({ error: "Run has not been submitted to Tekton." }, { status: 400 });

  try {
    await cancelPipelineRun(run.tekton_pipeline_run_name);
    const { data: updated, error: updateError } = await supabase.from("pipeline_runs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", id).select().single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ run: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to cancel Tekton run" }, { status: 502 });
  }
}
