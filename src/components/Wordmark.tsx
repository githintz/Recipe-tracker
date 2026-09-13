/** The app's own mark: a ladle bowl over the name. */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="14" fill="none" stroke="var(--accent)" strokeWidth="3" />
        <path
          d="M9.5 14.5a6.5 6.5 0 0 0 13 0z"
          fill="var(--accent)"
        />
        <path
          d="M22.5 14.5V9.2a2.6 2.6 0 0 0-5.2 0"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      <span
        className="font-display text-[26px] font-extrabold text-accent"
        style={{ letterSpacing: "-0.04em" }}
      >
        ladle
      </span>
    </span>
  );
}
