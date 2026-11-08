/**
 * Shared tailwind color classes for a `player.condition` value.
 *
 * Kept in one place so the same condition value looks the same everywhere
 * it appears (pre-match XI / substitutes, opponent scouting, sub panel,
 * training-groups roster). `condColor` is the text class; `condBgColor`
 * the bar/fill class. Both use identical thresholds and color families.
 */
export function condColor(condition: number): string {
  if (condition >= 75) return "text-selected";
  if (condition >= 50) return "text-warning";
  return "text-danger";
}

export function condBgColor(condition: number): string {
  if (condition >= 75) return "bg-selected-fill";
  if (condition >= 50) return "bg-warning-solid";
  return "bg-danger-solid";
}
