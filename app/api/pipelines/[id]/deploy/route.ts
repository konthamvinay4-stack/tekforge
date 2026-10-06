import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { compileToTekton, type PipelineGraph } from "@/lib/pipeline-compiler";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  if (!body.clusterId) return NextResponse.json({ error: "clusterId is required." }, { status: 400 });

  const supabase = await createClient();
  const { data: pipeline, error } = await supabase
    .from("pipelines")
    .select("id,name,tekton_pipeline_name,spec")
    .eq("id", id).single();

  if (error || !pipeline) return NextResponse.json({ error: error?.message || "Pipeline not found." }, { status: 404 });

  const graph = (body.graph || pipeline.spec?.graph) as PipelineGraph;
  if (!graph?.nodes || !graph?.edges) return NextResponse.json({ error: "A visual pipeline graph is required." }, { status: 400 });

  try {
    const compiled = compileToTekton(graph, pipeline.tekton_pipeline_name || pipeline.name);
    const resources = compiled.resources.map((resource) => ({
      ...resource,
      metadata: { ...(resource.metadata || {}), namespace: body.namespace || "tekforge" },
    }));

    const { data: command, error: commandError } = await supabase.from("agent_commands").insert({
      cluster_id: body.clusterId,
      type: "apply-pipeline",
      payload: { pipelineId: id, namespace: body.namespace || "tekforge", resources },
      status: "queued",
    }).select("id,status").single();

    if (commandError || !command) return NextResponse.json({ error: commandError?.message || "Unable to queue deployment." }, { status: 500 });

    await supabase.from("pipelines").update({
      spec: { ...(pipeline.spec || {}), graph, compiled: compiled.pipelineYaml },
      tekton_pipeline_name: pipeline.tekton_pipeline_name || pipeline.name,
    }).eq("id", id);

    return NextResponse.json({
      status: "queued",
      commandId: command.id,
      pipelineId: id,
      clusterId: body.clusterId,
      namespace: body.namespace || "tekforge",
      taskNames: compiled.taskNames,
      resourceCount: resources.length,
    }, { status: 202 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Pipeline compilation failed." }, { status: 400 });
  }
}
