import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const applicationId = url.searchParams.get("applicationId");
  const status = url.searchParams.get("status");

  const supabase = await createClient();
  let query = supabase
    .from("pipeline_runs")
    .select("id,pipeline_id,environment_id,commit_sha,branch,status,tekton_pipeline_run_name,started_at,finished_at,created_at,pipelines(id,name,template,application_id,applications(id,name,repository_url)),environments(id,name,namespace,protected)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (applicationId) query = query.eq("pipelines.application_id", applicationId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const releases = (data || []).map((run: any) => {
    const pipeline = Array.isArray(run.pipelines) ? run.pipelines[0] : run.pipelines;
    const application = Array.isArray(pipeline?.applications) ? pipeline?.applications[0] : pipeline?.applications;
    const environment = Array.isArray(run.environments) ? run.environments[0] : run.environments;
    return {
      id: run.id,
      release: "rel-" + run.id.slice(0, 8),
      application: application?.name || "Unknown application",
      applicationId: pipeline?.application_id || null,
      pipeline: pipeline?.name || "Unknown pipeline",
      pipelineId: run.pipeline_id,
      template: pipeline?.template || "visual",
      environment: environment?.name || "unassigned",
      namespace: environment?.namespace || null,
      protected: Boolean(environment?.protected),
      revision: run.commit_sha || run.branch || "unknown",
      branch: run.branch || "main",
      status: run.status,
      tektonPipelineRun: run.tekton_pipeline_run_name,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      createdAt: run.created_at,
    };
  });

  return NextResponse.json({ releases });
}
