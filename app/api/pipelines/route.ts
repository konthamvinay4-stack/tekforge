import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPipelineRuns } from "@/lib/tekton";

export async function GET(request: Request) {
  const applicationId = new URL(request.url).searchParams.get("applicationId");
  const supabase = await createClient();
  let query = supabase.from("pipelines").select("*, applications(name)").order("created_at", { ascending: false });
  if (applicationId) query = query.eq("application_id", applicationId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let tektonRuns: unknown[] = [];
  try {
    const result = await getPipelineRuns() as { items?: unknown[] };
    tektonRuns = result.items || [];
  } catch {
    // Supabase-backed pipeline browsing should continue to work when Tekton is unavailable.
  }

  return NextResponse.json({ pipelines: data, tektonRuns });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.applicationId) return NextResponse.json({ error: "applicationId is required." }, { status: 400 });

  const spec = body.spec ?? {
    runtime: "nodejs",
    runtimeVersion: "22",
    build: "npm",
    test: "npm-test",
    security: ["trivy"],
    container: "kaniko",
    deployment: "kubernetes",
  };

  const supabase = await createClient();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id, repository_url, default_branch, build_command, test_command")
    .eq("id", body.applicationId)
    .single();

  if (applicationError || !application) return NextResponse.json({ error: applicationError?.message || "Application not found." }, { status: 404 });

  const pipelineName = body.tektonPipelineName || body.name || "node-ci";
  const { data, error } = await supabase
    .from("pipelines")
    .insert({
      application_id: body.applicationId,
      name: body.name || "node-ci",
      template: body.template || "node-ci",
      spec,
      tekton_pipeline_name: pipelineName,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const { applyPipeline } = await import("@/lib/tekton");
    const tektonPipeline = await applyPipeline(
      pipelineName,
      application.repository_url,
      application.default_branch || "main",
      application.build_command || "npm run build",
      application.test_command || "npm test",
    );
    return NextResponse.json({ pipeline: data, tektonPipeline }, { status: 201 });
  } catch (tektonError) {
    return NextResponse.json({
      pipeline: data,
      warning: tektonError instanceof Error ? tektonError.message : "Tekton pipeline creation failed.",
    }, { status: 201 });
  }
}
