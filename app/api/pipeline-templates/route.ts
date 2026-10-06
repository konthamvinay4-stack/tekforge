import { NextResponse } from "next/server";
import { getPipelineTemplate, pipelineTemplates } from "@/lib/pipeline-templates";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const template = getPipelineTemplate(id);
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
    return NextResponse.json({ template });
  }

  return NextResponse.json({
    templates: pipelineTemplates.map(({ graph: _graph, ...template }) => template),
    count: pipelineTemplates.length,
  });
}
