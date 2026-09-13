import { NextResponse } from "next/server";
import { createFolder, listFolders } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ folders: listFolders() });
}

export async function POST(request: Request) {
  let body: { name?: string; emoji?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Give the folder a name." }, { status: 400 });

  return NextResponse.json({ folder: createFolder(name, body.emoji || "📁") }, { status: 201 });
}
