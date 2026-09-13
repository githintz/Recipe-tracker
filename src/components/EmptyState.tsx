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
    <div
      className="rounded-3xl px-6 py-12 text-center"
      style={{ background: "var(--subtle)" }}
    >
      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <h2 className="font-display mt-3 text-[19px] font-extrabold">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted">{body}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="pressable mt-5 inline-block rounded-full px-6 py-3 text-[14.5px] font-bold text-white"
          style={{ background: "var(--accent)" }}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
