import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPipelineRun } from "@/lib/tekton/client";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const supabase = await createClient();

  const { data: run, error: runError } = await supabase
    .from("pipeline_runs")
    .select("*, pipelines(name, tekton_pipeline_name, applications(name, repository_url, default_branch, image_repository, runtime, test_command))")
    .eq("id", id).single();

  if (runError || !run) return NextResponse.json({ error: runError?.message || "Pipeline run not found" }, { status: 404 });

  const pipelineName = run.pipelines?.tekton_pipeline_name || run.pipelines?.name;
  const application = run.pipelines?.applications;
  if (!pipelineName) return NextResponse.json({ error: "Pipeline has no Tekton pipeline name." }, { status: 400 });
  if (!application?.repository_url) return NextResponse.json({ error: "Application repository URL is required." }, { status: 400 });

  const clusterId = body.clusterId || run.cluster_id || null;
  const executionNamespace = body.namespace || "tekforge";

  // Preferred SaaS path: enqueue the operation for the connected cluster agent.
  // The agent is the only component allowed to mutate the customer's Kubernetes cluster.
  if (clusterId) {
    const params = [
      { name: "repo-url", value: application.repository_url },
      { name: "revision", value: run.branch || application.default_branch || "main" },
      ...(application.image_repository ? [{ name: "image", value: application.image_repository }] : []),
      { name: "test-command", value: application.test_command || "" },
    ];

    const { data: command, error: commandError } = await supabase.from("agent_commands").insert({
      cluster_id: clusterId,
      type: "create-pipelinerun",
      payload: { pipelineRunId: id, pipelineName, namespace: executionNamespace, params },
      status: "queued",
    }).select("id,status").single();

    if (commandError || !command) return NextResponse.json({ error: commandError?.message || "Unable to queue agent command" }, { status: 500 });

    await supabase.from("pipeline_runs").update({ status: "queued", started_at: null }).eq("id", id);
    return NextResponse.json({ mode: "agent", commandId: command.id, status: "queued", pipelineRunId: id, clusterId, namespace: executionNamespace }, { status: 202 });
  }

  // Backward-compatible local development path.
  const image = application.image_repository;
  if (!image) return NextResponse.json({ error: "No container image repository is configured for this application." }, { status: 400 });

  try {
    const tekton = await createPipelineRun({
      pipelineName,
      runName: `tekforge-${id.slice(0, 8)}`,
      repoUrl: application.repository_url,
      branch: run.branch || application.default_branch || "main",
      commitSha: run.commit_sha || undefined,
      image,
      runtime: application.runtime || "nodejs",
      testCommand: application.test_command || "",
    });
    const { data: updated, error } = await supabase.from("pipeline_runs").update({
      status: "running", tekton_pipeline_run_name: tekton.metadata.name, started_at: new Date().toISOString()
    }).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ mode: "direct", run: updated, tekton });
  } catch (error) {
    await supabase.from("pipeline_runs").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tekton execution failed" }, { status: 502 });
  }
}
