import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ service: "tekforge-control-plane", status: "ok", executionEngine: "tekton" });
}
