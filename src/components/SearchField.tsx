"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Search-as-you-type over the saved recipes. The query lives in the URL so a
 * search can be shared, reloaded and backed out of.
 */
export function SearchField({
  defaultValue,
  hidden,
}: {
  defaultValue: string;
  hidden: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      for (const [key, entry] of Object.entries(hidden)) {
        if (entry) params.set(key, entry);
      }
      if (value.trim()) params.set("q", value.trim());
      const query = params.toString();
      router.replace(query ? `/?${query}` : "/", { scroll: false });
    }, 220);

    return () => clearTimeout(timer);
    // `hidden` is rebuilt each render; the query string is what matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
        aria-hidden
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search recipes and ingredients"
        aria-label="Search recipes"
        className="w-full rounded-2xl bg-card py-3 pr-4 pl-10 text-sm shadow-card outline-none placeholder:text-muted"
      />
    </div>
  );
}
