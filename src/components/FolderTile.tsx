import Link from "next/link";
import type { Folder, Recipe } from "@/lib/types";

/** A folder in the home screen's horizontal strip: cover photo, then a name. */
export function FolderTile({
  folder,
  cover,
}: {
  folder: Folder;
  cover: Recipe | undefined;
}) {
  return (
    <Link href={`/folders/${folder.id}`} className="pressable block w-[120px] shrink-0">
      <div className="aspect-square w-full overflow-hidden rounded-2xl bg-subtle">
        {cover?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl opacity-40" aria-hidden>
            {folder.emoji}
          </span>
        )}
      </div>
      <p className="font-display mt-2 line-clamp-2 text-[14px] leading-tight font-bold">
        {folder.name}
      </p>
    </Link>
  );
}
