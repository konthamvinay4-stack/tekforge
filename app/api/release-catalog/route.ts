import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("releases").select("*, applications(name), pipelines(name), release_promotions(*)").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ releases: data || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.applicationId) return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
  const supabase = await createClient();
  const version = String(body.version || ("v" + Date.now()));
  const { data, error } = await supabase.from("releases").insert({ application_id: body.applicationId, pipeline_id: body.pipelineId || null, version, commit_sha: body.commitSha || null, status: "draft", current_environment: body.currentEnvironment || "development", target_environment: body.targetEnvironment || "development", notes: body.notes || null, metadata: { branch: body.branch || "main" } }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ release: data }, { status: 201 });
}
