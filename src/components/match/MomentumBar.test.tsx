import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MomentumBar from "./MomentumBar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      if (key === "match.momentumLabel" && options) {
        return `${options.homeTeam} ${options.home} / ${options.even} / ${options.away} ${options.awayTeam}`;
      }
      return key;
    },
  }),
}));

function renderBar(home: number, even: number, away: number) {
  render(<MomentumBar home={home} even={even} away={away} homeTeam="Alpha" awayTeam="Beta" />);
}

describe("MomentumBar", () => {
  /** Given a spell the home side dominated, when the bar is drawn, then its label reads the split. */
  it("names the split for anyone who cannot see the bar", () => {
    renderBar(80, 20, 0);

    expect(screen.getByRole("img", { name: "Alpha 80 / 20 / 0 Beta" })).toBeInTheDocument();
  });

  /** Given three shares, when the bar is drawn, then each segment takes its own width. */
  it("splits the bar into the three shares", () => {
    renderBar(60, 25, 15);

    const bar = screen.getByRole("img");
    const [home, even, away] = Array.from(bar.children) as HTMLElement[];

    expect(home.style.width).toBe("60%");
    expect(even.style.width).toBe("25%");
    expect(away.style.width).toBe("15%");
  });

  /** Given a quiet spell, when the bar is drawn, then it shows a heading rather than nothing. */
  it("still renders when nobody is on top", () => {
    renderBar(0, 100, 0);

    expect(screen.getByText("match.momentum")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Alpha 0 / 100 / 0 Beta" })).toBeInTheDocument();
  });
});
