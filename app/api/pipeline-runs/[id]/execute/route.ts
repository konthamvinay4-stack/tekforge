import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPipelineRun } from "@/lib/tekton/client";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data: run, error: runError } = await supabase
    .from("pipeline_runs")
    .select("*, pipelines(name, tekton_pipeline_name, applications(name, repository_url, default_branch, image_repository, runtime, test_command))")
    .eq("id", id)
    .single();

  if (runError || !run) return NextResponse.json({ error: runError?.message || "Pipeline run not found" }, { status: 404 });

  const pipelineName = run.pipelines?.tekton_pipeline_name || run.pipelines?.name || "node-ci";
  const application = run.pipelines?.applications;
  const image = application?.image_repository;
  if (!image) return NextResponse.json({ error: "No container image repository is configured for this application." }, { status: 400 });

  try {
    const tekton = await createPipelineRun({
      pipelineName,
      runName: `tekforge-${id.slice(0, 8)}`,
      repoUrl: application?.repository_url,
      branch: run.branch || application?.default_branch || "main",
      commitSha: run.commit_sha || undefined,
      image,
      runtime: application?.runtime || "nodejs",
      testCommand: application?.test_command || "",
    });

    const { data: updated, error } = await supabase
      .from("pipeline_runs")
      .update({ status: "running", tekton_pipeline_run_name: tekton.metadata.name, started_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ run: updated, tekton });
  } catch (error) {
    await supabase.from("pipeline_runs").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tekton execution failed" }, { status: 502 });
  }
}
