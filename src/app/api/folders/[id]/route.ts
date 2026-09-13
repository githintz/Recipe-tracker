import { NextResponse } from "next/server";
import { deleteFolder, updateFolder } from "@/lib/db";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  let body: { name?: string; emoji?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const folder = updateFolder(id, body);
  if (!folder) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  return NextResponse.json({ folder });
}

/** Deleting a folder never deletes the recipes inside it. */
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!deleteFolder(id)) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
