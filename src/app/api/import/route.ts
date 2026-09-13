import { NextResponse } from "next/server";
import {
  ImportError,
  NotARecipeError,
  importFromImage,
  importFromText,
  importFromUrl,
  isLlmAvailable,
} from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  mode?: "url" | "text" | "image";
  url?: string;
  text?: string;
  image?: string;
  mediaType?: string;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

/**
 * Extracts a recipe and returns it for review. Nothing is saved here — the
 * user confirms on the preview screen, which then POSTs to /api/recipes.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  try {
    switch (body.mode) {
      case "url": {
        if (!body.url?.trim()) {
          return NextResponse.json({ error: "Paste a link first." }, { status: 400 });
        }
        return NextResponse.json({ recipe: await importFromUrl(body.url) });
      }

      case "text": {
        if (!body.text?.trim()) {
          return NextResponse.json({ error: "Paste the recipe text first." }, { status: 400 });
        }
        return NextResponse.json({ recipe: await importFromText(body.text) });
      }

      case "image": {
        if (!body.image) {
          return NextResponse.json({ error: "No image was uploaded." }, { status: 400 });
        }
        const mediaType = body.mediaType as ImageType;
        if (!IMAGE_TYPES.includes(mediaType)) {
          return NextResponse.json(
            { error: "Use a JPEG, PNG, WebP or GIF image." },
            { status: 400 },
          );
        }
        // A base64 payload is ~4/3 of the file size; 10 MB of source is plenty.
        if (body.image.length > 14_000_000) {
          return NextResponse.json(
            { error: "That image is too large — keep it under 10 MB." },
            { status: 413 },
          );
        }
        return NextResponse.json({ recipe: await importFromImage(body.image, mediaType) });
      }

      default:
        return NextResponse.json({ error: "Unknown import type." }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof NotARecipeError) {
      return NextResponse.json(
        {
          error: error.message,
          hint: "Try a post where the recipe is written out in the caption.",
        },
        { status: 422 },
      );
    }
    if (error instanceof ImportError) {
      return NextResponse.json({ error: error.message, hint: error.hint }, { status: 422 });
    }

    console.error("Import failed:", error);
    return NextResponse.json(
      {
        error: "Something went wrong reading that recipe.",
        hint: isLlmAvailable() ? undefined : "Set ANTHROPIC_API_KEY for better import coverage.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ aiEnabled: isLlmAvailable() });
}
