import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const pipelineId = new URL(request.url).searchParams.get("pipelineId");
  const supabase = await createClient();
  let query = supabase
    .from("pipeline_runs")
    .select("*, pipelines(name, applications(name)), environments(name)")
    .order("created_at", { ascending: false });
  if (pipelineId) query = query.eq("pipeline_id", pipelineId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.pipelineId) return NextResponse.json({ error: "pipelineId is required." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pipeline_runs")
    .insert({
      pipeline_id: body.pipelineId,
      environment_id: body.environmentId || null,
      commit_sha: body.commitSha || null,
      branch: body.branch || "main",
      status: "queued",
      tekton_pipeline_run_name: body.tektonPipelineRunName || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ run: data }, { status: 201 });
}
