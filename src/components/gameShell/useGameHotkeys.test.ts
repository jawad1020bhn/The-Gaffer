import { describe, expect, it } from "vitest";
import { gameHotkeyFor, type HotkeyEvent } from "./useGameHotkeys";

function key(overrides: Partial<HotkeyEvent> = {}): HotkeyEvent {
  return {
    key: "a",
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: null,
    defaultPrevented: false,
    ...overrides,
  };
}

function element(tagName: string): HTMLElement {
  return document.createElement(tagName);
}

describe("gameHotkeyFor", () => {
  /** Given Escape, when no overlay has claimed it, then the shell opens the pause menu. */
  it("maps Escape to the pause menu", () => {
    expect(gameHotkeyFor(key({ key: "Escape" }))).toEqual({ kind: "menu" });
  });

  /** Given a field has focus, when Escape is pressed, then the field keeps the key. */
  it("leaves Escape to a text field", () => {
    expect(gameHotkeyFor(key({ key: "Escape", target: element("input") }))).toBeNull();
  });

  /** Given a key a screen already handled, then the shell stays out of it. */
  it("ignores a key another handler consumed", () => {
    expect(gameHotkeyFor(key({ key: "Escape", defaultPrevented: true }))).toBeNull();
  });

  /** Given Ctrl+K (or Cmd+K on macOS), then the career search opens. */
  it("maps Ctrl+K and Cmd+K to search", () => {
    expect(gameHotkeyFor(key({ key: "k", ctrlKey: true }))).toEqual({ kind: "search" });
    expect(gameHotkeyFor(key({ key: "K", metaKey: true }))).toEqual({ kind: "search" });
  });

  /** Given F5, then the career is saved. */
  it("maps F5 to save", () => {
    expect(gameHotkeyFor(key({ key: "F5" }))).toEqual({ kind: "save" });
  });

  /** Given Alt and a section digit, then that section opens, numbered from one. */
  it("maps Alt and a digit to the section at that place", () => {
    expect(gameHotkeyFor(key({ key: "1", altKey: true }))).toEqual({ kind: "section", index: 0 });
    expect(gameHotkeyFor(key({ key: "5", altKey: true }))).toEqual({ kind: "section", index: 4 });
  });

  /** Given no Alt, then a digit types or scrolls and opens no section. */
  it("does not open a section on a bare digit", () => {
    expect(gameHotkeyFor(key({ key: "3" }))).toBeNull();
  });

  /** Given a button has focus, then Space presses it rather than continuing the career. */
  it("leaves Space to a focused control", () => {
    expect(gameHotkeyFor(key({ key: " " }))).toEqual({ kind: "continue" });
    expect(gameHotkeyFor(key({ key: " ", target: element("button") }))).toBeNull();
  });

  /** Given a text field, then Space types a space. */
  it("leaves Space to a text field", () => {
    expect(gameHotkeyFor(key({ key: " ", target: element("textarea") }))).toBeNull();
  });

  /** Given a letter nobody mapped, then the shell does nothing. */
  it("ignores unmapped keys", () => {
    expect(gameHotkeyFor(key({ key: "q" }))).toBeNull();
  });
});
