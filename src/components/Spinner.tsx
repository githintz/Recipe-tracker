export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <span
        className="h-9 w-9 animate-spin rounded-full border-[3px]"
        style={{ borderColor: "var(--subtle)", borderTopColor: "var(--accent)" }}
        aria-hidden
      />
      {label && <p className="text-[13.5px] text-muted">{label}</p>}
    </div>
  );
}
