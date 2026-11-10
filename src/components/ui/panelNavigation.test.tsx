import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { navigatePanels } from "./panelNavigation";

afterEach(() => vi.restoreAllMocks());

it("moves panel focus with Alt+arrows and wraps, without changing Tab order", () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  render(
    <div onKeyDown={navigatePanels}>
      <div data-panel tabIndex={-1}>
        One
      </div>
      <div data-panel tabIndex={-1}>
        Two
      </div>
    </div>,
  );
  const one = screen.getByText("One");
  const two = screen.getByText("Two");
  one.focus();
  fireEvent.keyDown(one, { key: "ArrowRight" });
  expect(one).toHaveFocus();
  fireEvent.keyDown(one, { key: "ArrowRight", altKey: true });
  expect(two).toHaveFocus();
  fireEvent.keyDown(two, { key: "ArrowRight", altKey: true });
  expect(one).toHaveFocus();
});

it("does not move focus out of a dialog", () => {
  render(
    <div onKeyDown={navigatePanels}>
      <div data-panel tabIndex={-1}>
        Panel
      </div>
      <div role="dialog">
        <button type="button">Inside</button>
      </div>
    </div>,
  );
  const inside = screen.getByRole("button");
  inside.focus();
  fireEvent.keyDown(inside, { key: "ArrowLeft", altKey: true });
  expect(inside).toHaveFocus();
});
