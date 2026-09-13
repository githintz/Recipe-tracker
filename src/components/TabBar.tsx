"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Recipes", icon: BookIcon },
  { href: "/folders", label: "Folders", icon: FolderIcon },
  { href: "/grocery", label: "List", icon: ListIcon },
];

export function TabBar() {
  const pathname = usePathname();

  // Cook mode and the import flow are full-screen tasks; the bar only gets
  // in the way there.
  if (pathname.endsWith("/cook") || pathname.startsWith("/import")) return null;

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-card/92 backdrop-blur-md"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-bold"
              style={{ color: active ? "var(--accent)" : "var(--muted)" }}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function BookIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 19.5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="m3.4 6 .9 1L6 5M3.4 12l.9 1L6 11M3.4 18l.9 1L6 17" />
    </svg>
  );
}
