import Link from "next/link";

/** The floating add button: a gradient ring around a white disc. */
export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="no-print pressable fixed right-5 bottom-24 z-30 flex h-14 w-14 items-center justify-center rounded-full p-[3px] shadow-float"
    >
      <span className="fab-ring absolute inset-0 rounded-full" aria-hidden />
      <span className="relative flex h-full w-full items-center justify-center rounded-full bg-card">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
    </Link>
  );
}
