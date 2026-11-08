/** `?preview=match` draws the live match screen on the preview match. */
export function readMatchPreview(search: string): boolean {
  return new URLSearchParams(search).get("preview") === "match";
}
