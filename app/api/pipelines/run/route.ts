import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyPipeline, createPipelineRun, tektonNamespace } from "@/lib/tekton";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.pipelineId) return NextResponse.json({ error: "pipelineId is required." }, { status: 400 });

    const supabase = await createClient();
    const { data: pipeline, error: pipelineError } = await supabase
      .from("pipelines")
      .select("id, name, tekton_pipeline_name, spec, applications(repository_url, default_branch, build_command, test_command)")
      .eq("id", body.pipelineId)
      .single();

    if (pipelineError || !pipeline) {
      return NextResponse.json({ error: pipelineError?.message || "Pipeline not found." }, { status: 404 });
    }

    const application = Array.isArray(pipeline.applications) ? pipeline.applications[0] : pipeline.applications;
    if (!application?.repository_url) {
      return NextResponse.json({ error: "Pipeline application does not have a repository URL." }, { status: 400 });
    }

    const tektonPipelineName = pipeline.tekton_pipeline_name || pipeline.name;
    await applyPipeline(
      tektonPipelineName,
      application.repository_url,
      application.default_branch || "main",
      application.build_command || "npm run build",
      application.test_command || "npm test",
    );

    const run = await createPipelineRun(
      tektonPipelineName,
      application.repository_url,
      application.default_branch || "main",
      application.build_command || "npm run build",
      application.test_command || "npm test",
    ) as { metadata?: { name?: string; namespace?: string }; status?: unknown };

    return NextResponse.json({
      run,
      pipelineId: pipeline.id,
      tektonPipelineName,
      namespace: tektonNamespace(),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to start Tekton PipelineRun.",
    }, { status: 500 });
  }
}
