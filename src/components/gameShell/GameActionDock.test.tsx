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

  it("sits in the shell's own bar rather than floating over the workspace", () => {
    const { container } = render(
      <GameActionDock>
        <button type="button">Save</button>
      </GameActionDock>,
    );

    // No positioning at all: it is a row child, so nothing can end up underneath it.
    const dock = container.firstElementChild;
    expect(dock).not.toHaveClass("absolute");
    expect(dock).not.toHaveClass("fixed");
  });
});
