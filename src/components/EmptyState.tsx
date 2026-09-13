import Link from "next/link";

export function EmptyState({
  emoji,
  title,
  body,
  actionHref,
  actionLabel,
}: {
  emoji: string;
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <h2 className="font-display mt-3 text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{body}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
