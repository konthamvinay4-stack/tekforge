import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const applicationId = new URL(request.url).searchParams.get("applicationId");
  const supabase = await createClient();
  let query = supabase.from("pipelines").select("*, applications(name)").order("created_at", { ascending: false });
  if (applicationId) query = query.eq("application_id", applicationId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pipelines: data });
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
  const { data, error } = await supabase
    .from("pipelines")
    .insert({
      application_id: body.applicationId,
      name: body.name || "node-ci",
      template: body.template || "node-ci",
      spec,
      tekton_pipeline_name: body.tektonPipelineName || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pipeline: data }, { status: 201 });
}
