import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  const supabase = await createClient();
  let query = supabase.from("applications").select("*, projects(name), pipelines(id, name, tekton_pipeline_name, template)").order("created_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ applications: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const required = ["projectId", "name", "repositoryUrl"];
  const missing = required.filter((key) => !String(body[key] ?? "").trim());
  if (missing.length) return NextResponse.json({ error: `Missing: ${missing.join(", ")}` }, { status: 400 });

  const supabase = await createClient();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .insert({
      project_id: body.projectId,
      name: body.name.trim(),
      repository_url: body.repositoryUrl.trim(),
      default_branch: body.defaultBranch || "main",
      runtime: body.runtime || "nodejs",
      runtime_version: body.runtimeVersion || "22",
      build_command: body.buildCommand || "npm ci",
      test_command: body.testCommand || "npm test",
      image_repository: body.imageRepository || null,
      pipeline_status: "ready",
    })
    .select()
    .single();

  if (applicationError || !application) return NextResponse.json({ error: applicationError?.message || "Application creation failed" }, { status: 500 });

  const pipelineName = `${application.name}-ci`;
  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .insert({
      application_id: application.id,
      name: pipelineName,
      template: "node-ci",
      tekton_pipeline_name: "node-ci",
      spec: {
        runtime: application.runtime,
        runtimeVersion: application.runtime_version,
        buildCommand: application.build_command,
        testCommand: application.test_command,
      },
    })
    .select()
    .single();

  if (pipelineError || !pipeline) {
    await supabase.from("applications").delete().eq("id", application.id);
    return NextResponse.json({ error: pipelineError?.message || "Pipeline creation failed" }, { status: 500 });
  }

  return NextResponse.json({ application, pipeline }, { status: 201 });
}
