/** Shared display helpers, safe to import from both server and client code. */

export function formatMinutesPlain(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** "1.5×" for an arbitrary factor, "half" and "double" where they read better. */
export function formatFactor(factor: number): string {
  if (factor === 0.5) return "Half";
  if (factor === 1) return "As written";
  if (factor === 2) return "Double";
  if (factor === 3) return "Triple";
  return `${Math.round(factor * 100) / 100}×`;
}
