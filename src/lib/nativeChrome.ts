/**
 * Native-window hardening.
 *
 * A Tauri window is still a webview, and a webview left alone will reload on F5, zoom on Ctrl+wheel,
 * offer "Back / Reload / Save as" on right-click, and bounce at the end of a scroll. Every one of
 * those is a instant tell that the player is looking at a web page. This removes the browser
 * behaviours the game does not use and leaves the ones it does.
 *
 * Nothing here touches game logic. It is installed once, before React renders, and returns a
 * teardown so a test can install it into a jsdom window and take it back out.
 */

/**
 * Whether the game shell is currently listening for its own shortcuts.
 *
 * F5 and Ctrl+K belong to the shell when it is mounted and enabled: it calls preventDefault and
 * performs quick save / search. If the hardening prevented the default first, `gameHotkeyFor`
 * would see `defaultPrevented` and decline to act, so F5 would save nothing. When the shell is not
 * listening — the main menu, settings, or a modal that has taken the keys — the hardening swallows
 * them instead, so the webview still never reloads.
 */
let gameOwnsKeys = false;

export function setGameKeysOwned(owned: boolean): void {
  gameOwnsKeys = owned;
}

/** The keys `useGameHotkeys` acts on; left alone while it is listening. */
function isGameKey(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  if (key === "f5" || key === "escape" || key === " ") return true;
  if ((event.ctrlKey || event.metaKey) && key === "k") return true;
  if (event.altKey && !event.ctrlKey && !event.metaKey && /^[1-5]$/.test(key)) return true;
  return false;
}

/** Keys the webview owns by default that the game must own instead. */
function isBrowserShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();

  // F5 is the game's quick save; F11 is fullscreen. Neither may reach the webview.
  if (key === "f5" || key === "f11") return true;

  if (event.ctrlKey || event.metaKey) {
    // Reload, hard reload, save page, print, find, view source, and the zoom keys.
    if (["r", "s", "p", "f", "u", "g", "+", "-", "=", "0"].includes(key)) return true;
    if (event.shiftKey && key === "r") return true;
  }

  return false;
}

/** A field keeps its own editing menu and its own zoom, because the player is typing in it. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest("input, textarea, [contenteditable='true'], [data-allow-context-menu]") !== null
  );
}

async function toggleFullscreen(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.setFullscreen(!(await win.isFullscreen()));
    return;
  } catch {
    // Not in Tauri (the dev harness in a browser tab): use the DOM API instead so F11 still does
    // something recognisable while a screen is being built.
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    // Fullscreen refused (a browser tab without a user gesture, or a kiosk webview). Ignore.
  }
}

/**
 * Install the hardening. Safe to call once at startup; returns the teardown.
 *
 * The context menu is suppressed at the window level in the bubble phase, so a component that
 * opens the game's own menu on `contextmenu` has already run and set its state — this only stops
 * the webview drawing its own menu on top of it.
 */
export function installNativeChrome(target: Window = window): () => void {
  const doc = target.document;

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === "f11") {
      event.preventDefault();
      void toggleFullscreen();
      return;
    }
    if (gameOwnsKeys && isGameKey(event)) return;
    if (isBrowserShortcut(event)) event.preventDefault();
  }

  function onContextMenu(event: MouseEvent): void {
    if (!isEditable(event.target)) event.preventDefault();
  }

  function onWheel(event: WheelEvent): void {
    // Ctrl+wheel and trackpad pinch both arrive as a wheel event with ctrlKey set.
    if (event.ctrlKey) event.preventDefault();
  }

  function onDragStart(event: DragEvent): void {
    // Dragging a scene plate or a crest out of the window is a browser behaviour, not a game one.
    // Pitch tokens implement their own drag with pointer events, so this does not touch them.
    if (event.target instanceof Element && event.target.closest("img")) event.preventDefault();
  }

  function onGesture(event: Event): void {
    // Safari/WKWebView pinch. Non-standard, so it is added defensively and ignored elsewhere.
    event.preventDefault();
  }

  target.addEventListener("keydown", onKeyDown, { capture: true });
  target.addEventListener("contextmenu", onContextMenu);
  target.addEventListener("wheel", onWheel, { passive: false });
  target.addEventListener("dragstart", onDragStart);
  for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
    doc.addEventListener(name, onGesture, { passive: false });
  }

  return () => {
    target.removeEventListener("keydown", onKeyDown, { capture: true });
    target.removeEventListener("contextmenu", onContextMenu);
    target.removeEventListener("wheel", onWheel);
    target.removeEventListener("dragstart", onDragStart);
    for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
      doc.removeEventListener(name, onGesture);
    }
  };
}
