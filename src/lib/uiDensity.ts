export type UiDensity = "comfortable" | "compact";

/** The root class for the saved density. Unknown values fall back to comfortable. */
export function densityClassFor(density: string): "" | "density-compact" {
  return density === "compact" ? "density-compact" : "";
}
