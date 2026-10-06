import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.pipelineId) return NextResponse.json({ error: "pipelineId is required." }, { status: 400 });

    const supabase = await createClient();
    const { data: pipeline, error: pipelineError } = await supabase
      .from("pipelines")
      .select("id,name,tekton_pipeline_name,spec,applications(repository_url,default_branch,build_command,test_command,image_repository)")
      .eq("id", body.pipelineId)
      .single();

    if (pipelineError || !pipeline) return NextResponse.json({ error: pipelineError?.message || "Pipeline not found." }, { status: 404 });

    const application = Array.isArray(pipeline.applications) ? pipeline.applications[0] : pipeline.applications;
    if (!application?.repository_url) return NextResponse.json({ error: "Pipeline application does not have a repository URL." }, { status: 400 });

    if (body.clusterId) {
      const namespace = body.namespace || "tekforge";
      const pipelineName = pipeline.tekton_pipeline_name || pipeline.name;
      const runName = `tekforge-${Date.now()}`;
      const params = [
        { name: "repository", value: application.repository_url },
        { name: "image", value: application.image_repository || `tekforge/${pipeline.name}` },
      ];

      const { data: run, error: runError } = await supabase.from("pipeline_runs").insert({
        pipeline_id: pipeline.id,
        environment_id: body.environmentId || null,
        commit_sha: body.commitSha || null,
        branch: body.branch || application.default_branch || "main",
        status: "queued",
        cluster_id: body.clusterId,
        tekton_pipeline_run_name: runName,
      }).select().single();

      if (runError || !run) return NextResponse.json({ error: runError?.message || "Unable to create pipeline run." }, { status: 500 });

      const { data: command, error: commandError } = await supabase.from("agent_commands").insert({
        cluster_id: body.clusterId,
        type: "create-pipelinerun",
        payload: { pipelineRunId: run.id, pipelineName, runName, namespace, params },
        status: "queued",
      }).select("id,status").single();

      if (commandError || !command) {
        await supabase.from("pipeline_runs").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", run.id);
        return NextResponse.json({ error: commandError?.message || "Unable to queue PipelineRun." }, { status: 500 });
      }

      return NextResponse.json({ run, commandId: command.id, status: "queued", namespace }, { status: 202 });
    }

    return NextResponse.json({ error: "clusterId is required for agent-backed execution." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to start pipeline." }, { status: 500 });
  }
}
