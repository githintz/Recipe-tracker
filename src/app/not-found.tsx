import Link from "next/link";

export default function NotFound() {
  return (
    <main className="py-24 text-center">
      <div className="text-4xl" aria-hidden>
        🍽
      </div>
      <h1 className="font-display mt-3 text-[22px] font-extrabold">Nothing here</h1>
      <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-muted">
        That recipe or folder has been deleted, or the link was wrong.
      </p>
      <Link
        href="/"
        className="pressable mt-5 inline-block rounded-full px-6 py-3 text-[14.5px] font-bold text-white"
        style={{ background: "var(--accent)" }}
      >
        Back to your recipes
      </Link>
    </main>
  );
}
