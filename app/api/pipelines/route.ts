import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function tektonName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "tekforge-pipeline";
}

export async function GET(request: Request) {
  const applicationId = new URL(request.url).searchParams.get("applicationId");
  const supabase = await createClient();
  let query = supabase.from("pipelines").select("*, applications(name)").order("updated_at", { ascending: false });
  if (applicationId) query = query.eq("application_id", applicationId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pipelines: data || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.applicationId) return NextResponse.json({ error: "applicationId is required." }, { status: 400 });

  const supabase = await createClient();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id, repository_url, default_branch, runtime, runtime_version, build_command, test_command, image_repository")
    .eq("id", body.applicationId)
    .single();

  if (applicationError || !application) return NextResponse.json({ error: applicationError?.message || "Application not found." }, { status: 404 });

  const graph = body.spec?.graph;
  const spec = body.spec ?? {
    runtime: application.runtime || "nodejs",
    runtimeVersion: application.runtime_version || "22",
    buildCommand: application.build_command || "npm run build",
    testCommand: application.test_command || "npm test",
  };

  if (body.pipelineId) {
    const { data: existing, error: existingError } = await supabase
      .from("pipelines")
      .select("id,application_id")
      .eq("id", body.pipelineId)
      .single();

    if (existingError || !existing) return NextResponse.json({ error: "Pipeline not found." }, { status: 404 });
    if (existing.application_id !== application.id) return NextResponse.json({ error: "Pipeline does not belong to this application." }, { status: 403 });

    const { data, error } = await supabase
      .from("pipelines")
      .update({
        name: body.name || "node-ci",
        template: body.template || "visual",
        spec,
        tekton_pipeline_name: body.tektonPipelineName || body.name || "node-ci",
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.pipelineId)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: error?.message || "Pipeline update failed." }, { status: 500 });
    return NextResponse.json({ pipeline: data, application }, { status: 200 });
  }

  const pipelineName = tektonName(body.tektonPipelineName || body.name || `${application.id}-pipeline`);
  const { data, error } = await supabase
    .from("pipelines")
    .insert({
      application_id: body.applicationId,
      name: body.name || "node-ci",
      template: body.template || "visual",
      spec,
      tekton_pipeline_name: pipelineName,
    })
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message || "Pipeline creation failed." }, { status: 500 });
  return NextResponse.json({ pipeline: data, application }, { status: 201 });
}
