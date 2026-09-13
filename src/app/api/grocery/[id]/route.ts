import { NextResponse } from "next/server";
import { deleteGroceryItem, setGroceryChecked } from "@/lib/db";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  let body: { checked?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const item = setGroceryChecked(id, Boolean(body.checked));
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!deleteGroceryItem(id)) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
