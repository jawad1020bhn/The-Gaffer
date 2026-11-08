import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GameActionDock from "./GameActionDock";

describe("GameActionDock", () => {
  it("shows the actions it is given", () => {
    render(
      <GameActionDock>
        <button type="button">Continue</button>
      </GameActionDock>,
    );

    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("renders nothing at all when the career has no actions to offer", () => {
    const { container } = render(<GameActionDock />);

    expect(container).toBeEmptyDOMElement();
  });

  it("lets clicks through everywhere the dock is not", () => {
    const { container } = render(
      <GameActionDock>
        <button type="button">Save</button>
      </GameActionDock>,
    );

    // The outer wrapper is a positioning frame only; the panel inside it takes the pointer.
    const frame = container.firstElementChild;
    expect(frame).toHaveClass("pointer-events-none");
    expect(frame?.firstElementChild).toHaveClass("pointer-events-auto");
  });
});
