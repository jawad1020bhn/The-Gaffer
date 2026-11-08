/** `?preview=shell` draws the game shell and Home on the preview career. */
export function readShellPreview(search: string): boolean {
  return new URLSearchParams(search).get("preview") === "shell";
}
