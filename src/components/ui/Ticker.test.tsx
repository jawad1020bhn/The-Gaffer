import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Ticker } from "./Ticker";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Ticker", () => {
  it("shows the value it is given on the first render, without counting up from zero", () => {
    render(<Ticker value={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("formats the resting value through the supplied formatter", () => {
    render(<Ticker value={1_500_000} format={(n) => `€${(n / 1_000_000).toFixed(1)}M`} />);
    expect(screen.getByText("€1.5M")).toBeInTheDocument();
  });

  it("keeps tabular numerals so a changing figure cannot reflow its panel", () => {
    render(<Ticker value={7} />);
    expect(screen.getByText("7")).toHaveClass("tabular-nums");
  });

  it("jumps straight to the new value when the player has asked for reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }));

    const { rerender } = render(<Ticker value={10} />);
    rerender(<Ticker value={90} />);
    expect(screen.getByText("90")).toBeInTheDocument();
  });

  it("settles on the exact target rather than a rounded frame", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { rerender } = render(<Ticker value={1} />);
    rerender(<Ticker value={1234} />);
    expect(screen.getByText("1234")).toBeInTheDocument();
  });
});
