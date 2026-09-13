/**
 * A stand-in for a creator's profile picture. Social platforms don't hand out
 * avatar images to third parties, so we draw a stable, colourful initial
 * instead — the same name always gets the same colour.
 */
const PALETTE = [
  "#f5484f", "#f2648f", "#b45cf0", "#5b8def", "#2bb3a3",
  "#3f9e5a", "#e8913a", "#d4573f", "#7a6cf0", "#c2417f",
];

function hash(input: string): number {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 31 + input.charCodeAt(i)) >>> 0;
  }
  return value;
}

export function Avatar({
  name,
  size = 28,
  ring = true,
}: {
  name: string | null;
  size?: number;
  ring?: boolean;
}) {
  const label = (name ?? "?").replace(/^@/, "").trim() || "?";
  const initial = [...label][0]?.toUpperCase() ?? "?";
  const color = PALETTE[hash(label) % PALETTE.length];

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.44,
        boxShadow: ring ? "0 0 0 2px var(--card)" : undefined,
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
    >
      {initial}
    </span>
  );
}
