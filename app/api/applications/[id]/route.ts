import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data: application, error } = await supabase
    .from("applications")
    .select("*, projects(id,name)")
    .eq("id", id)
    .single();

  if (error || !application) {
    return NextResponse.json({ error: error?.message || "Application not found." }, { status: 404 });
  }

  const { data: pipelines, error: pipelineError } = await supabase
    .from("pipelines")
    .select("id,name,template,tekton_pipeline_name,spec,created_at,updated_at")
    .eq("application_id", id)
    .order("updated_at", { ascending: false });

  if (pipelineError) {
    return NextResponse.json({ error: pipelineError.message }, { status: 500 });
  }

  return NextResponse.json({ application, pipelines: pipelines || [] });
}
