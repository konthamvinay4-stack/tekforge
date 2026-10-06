import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("agent_commands")
    .select("id,status,result,error,completed_at")
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "Connection test not found." }, { status: 404 });
  return NextResponse.json(data);
}
