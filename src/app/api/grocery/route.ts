import { NextResponse } from "next/server";
import { addGroceryLine, clearGroceryItems, listGroceryItems } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ items: listGroceryItems() });
}

export async function POST(request: Request) {
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "Type something to add." }, { status: 400 });

  return NextResponse.json({ item: addGroceryLine(text) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const removed = clearGroceryItems(searchParams.get("scope") !== "all");
  return NextResponse.json({ removed });
}
