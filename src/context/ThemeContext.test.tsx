import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "./ThemeContext";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark", "high-contrast");
});

describe("ThemeProvider", () => {
  /** Given the dedicated game presentation, when the app mounts, then the root is dark. */
  it("applies the dark game presentation on mount", () => {
    render(
      <ThemeProvider>
        <span>ready</span>
      </ThemeProvider>,
    );

    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("dark");
  });

  /** Given an old light preference, when the app mounts, then it still opens in the game presentation. */
  it.each(["light", "dark", "system"])("ignores the old %s theme preference", (stored) => {
    localStorage.setItem("ofm-theme", stored);

    render(
      <ThemeProvider>
        <span>ready</span>
      </ThemeProvider>,
    );

    expect(document.documentElement).toHaveClass("dark");
  });

  /** Given high contrast already on the root, when the provider mounts, then it preserves it. */
  it("does not remove the accessibility contrast class", () => {
    document.documentElement.classList.add("high-contrast");

    render(
      <ThemeProvider>
        <span>ready</span>
      </ThemeProvider>,
    );

    expect(document.documentElement).toHaveClass("dark", "high-contrast");
  });
});
