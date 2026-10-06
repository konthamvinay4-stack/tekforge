import { NextResponse } from "next/server";
import { taskCatalog, getTaskCatalogItem } from "@/lib/task-catalog";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const category = searchParams.get("category");

  if (id) {
    const task = getTaskCatalogItem(id);
    if (!task) return NextResponse.json({ error: "Task template not found" }, { status: 404 });
    return NextResponse.json({ task });
  }

  const tasks = category
    ? taskCatalog.filter((task) => task.category.toLowerCase() === category.toLowerCase())
    : taskCatalog;

  return NextResponse.json({
    tasks: tasks.map(({ fields, ...task }) => ({
      ...task,
      fields: fields.map(({ defaultValue, ...field }) => ({ ...field, defaultValue })),
    })),
    categories: [...new Set(taskCatalog.map((task) => task.category))],
  });
}
