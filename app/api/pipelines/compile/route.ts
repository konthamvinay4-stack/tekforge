import { NextResponse } from "next/server";
import { compileToTekton, type PipelineGraph } from "@/lib/pipeline-compiler";

export async function POST(request: Request) {
  try {
    const graph = (await request.json()) as PipelineGraph;
    const result = compileToTekton(graph);
    return NextResponse.json({ valid: true, ...result });
  } catch (error) {
    return NextResponse.json({ valid: false, error: error instanceof Error ? error.message : "Unable to compile pipeline." }, { status: 400 });
  }
}
