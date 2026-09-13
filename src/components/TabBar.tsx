"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Recipes", icon: BookIcon },
  { href: "/folders", label: "Folders", icon: FolderIcon },
  { href: "/import", label: "Add", icon: PlusIcon, primary: true },
  { href: "/grocery", label: "List", icon: ListIcon },
];

export function TabBar() {
  const pathname = usePathname();

  // Cook mode is full-screen by design — the tab bar would only get in the way.
  if (pathname.endsWith("/cook")) return null;

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ href, label, icon: Icon, primary }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
            >
              <span
                className={
                  primary
                    ? "flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white"
                    : active
                      ? "text-accent"
                      : "text-muted"
                }
              >
                <Icon />
              </span>
              <span className={active && !primary ? "text-accent" : "text-muted"}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function BookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 19.5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6 4.4 7 6 5M3.5 12l.9 1L6 11M3.5 18l.9 1L6 17" />
    </svg>
  );
}
