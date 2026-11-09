import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FirstDayTaskBanner from "./FirstDayTaskBanner";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => options?.defaultValue ?? key,
  }),
}));

describe("FirstDayTaskBanner", () => {
  /** Given the tactics task, when the player keeps the current setup, then completion is an explicit acknowledgment. */
  it("requires an explicit keep-current confirmation for tactics", () => {
    const onAcknowledge = vi.fn();
    render(<FirstDayTaskBanner task="tactics" onAcknowledge={onAcknowledge} />);

    fireEvent.click(screen.getByRole("button", { name: "firstDay.tasks.tactics.confirm" }));
    expect(onAcknowledge).toHaveBeenCalledWith("tactics");
  });

  /** Given the squad task, when it renders, then it does not claim a tab visit was a review. */
  it("asks for a squad review acknowledgment", () => {
    const onAcknowledge = vi.fn();
    render(<FirstDayTaskBanner task="squad" onAcknowledge={onAcknowledge} />);

    expect(screen.getByText("firstDay.tasks.squad.description")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "firstDay.tasks.squad.confirm" }));
    expect(onAcknowledge).toHaveBeenCalledWith("squad");
  });
});
