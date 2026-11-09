import { useEffect, useRef } from "react";
import { setGameKeysOwned } from "../../lib/nativeChrome";

/** What the keyboard asks the shell to do, before any screen hears about it. */
export type GameHotkey =
  | { kind: "menu" }
  | { kind: "search" }
  | { kind: "save" }
  | { kind: "continue" }
  | { kind: "section"; index: number };

/** The parts of a keydown the mapping reads, so a test can hand it one without a DOM event. */
export interface HotkeyEvent {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
  defaultPrevented: boolean;
}

export interface GameHotkeyHandlers {
  onContinue?: () => void;
  onMenu?: () => void;
  onSave?: () => void;
  onSearch?: () => void;
  onSection?: (index: number) => void;
}

/** The primary sections a digit can reach with Alt (Career … Office). */
const SECTION_DIGITS = 5;

function isHtmlElement(target: EventTarget | null): target is HTMLElement {
  return typeof HTMLElement !== "undefined" && target instanceof HTMLElement;
}

/** A field takes the keys for itself: Escape blurs it, Space types a space. */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!isHtmlElement(target)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

/** Something that already answers Space (a button, a link, a menu row): the browser owns it. */
function isInteractive(target: EventTarget | null): boolean {
  if (!isHtmlElement(target)) return false;
  return target.closest("button, a, [role='button'], [role='menuitem'], [role='option']") !== null;
}

/**
 * Which shell action a keydown means, or null when it means nothing here.
 *
 * The map is one place, so the hint strip, the pause menu and the tests agree on it:
 * Esc = pause menu · Alt+1…5 = primary section · Space = continue · F5 = save · Ctrl/Cmd+K = search.
 */
export function gameHotkeyFor(event: HotkeyEvent): GameHotkey | null {
  if (event.defaultPrevented) return null;
  if (isTextEntry(event.target)) return null;

  const key = event.key;

  if (key === "Escape") return { kind: "menu" };
  if (key === "F5") return { kind: "save" };
  if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "k") return { kind: "search" };

  if (event.altKey && !event.ctrlKey && !event.metaKey) {
    const digit = Number.parseInt(key, 10);
    if (digit >= 1 && digit <= SECTION_DIGITS) return { kind: "section", index: digit - 1 };
  }

  if (
    key === " " &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !isInteractive(event.target)
  ) {
    return { kind: "continue" };
  }

  return null;
}

/** Subscribes the shell to the map above. `enabled` goes false while an overlay owns the keys. */
export function useGameHotkeys(handlers: GameHotkeyHandlers, enabled = true): void {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    // Tell the native hardening these keys are spoken for, so it does not preventDefault them
    // out from under this listener. Released on unmount and whenever an overlay takes the keys.
    setGameKeysOwned(true);

    function onKeyDown(event: KeyboardEvent): void {
      const hotkey = gameHotkeyFor(event);
      if (!hotkey) return;

      switch (hotkey.kind) {
        case "menu":
          event.preventDefault();
          latest.current.onMenu?.();
          break;
        case "save":
          event.preventDefault();
          latest.current.onSave?.();
          break;
        case "search":
          event.preventDefault();
          latest.current.onSearch?.();
          break;
        case "continue":
          event.preventDefault();
          latest.current.onContinue?.();
          break;
        case "section":
          event.preventDefault();
          latest.current.onSection?.(hotkey.index);
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      setGameKeysOwned(false);
    };
  }, [enabled]);
}
