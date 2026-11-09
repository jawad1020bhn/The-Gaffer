import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CareerSetupLayout from "./CareerSetupLayout";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

describe("CareerSetupLayout", () => {
  /** Given a setup beat, when it renders, then the frame is a labelled game scene with a step rail and one forward action. */
  it("renders a full-window scene with rail, summary and footer", () => {
    render(
      <CareerSetupLayout
        step="identity"
        furthestStep="identity"
        titleKey="careerSetup.identity.title"
        subtitleKey="careerSetup.identity.subtitle"
        onBack={() => {}}
        onExit={() => {}}
        onSelectStep={() => {}}
        primaryAction={<button type="button">careerSetup.continue</button>}
        summary={<p>careerSetup.passport</p>}
      >
        <p>Form content</p>
      </CareerSetupLayout>,
    );

    expect(screen.getByRole("main", { name: "careerSetup.identity.title" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "careerSetup.rail" })).toBeInTheDocument();
    expect(screen.getByText("Form content")).toBeInTheDocument();
    expect(screen.getByText("careerSetup.passport")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "careerSetup.continue" })).toBeInTheDocument();
  });

  /** Given a completed beat, when the player clicks it, then the rail asks to return without losing the draft. */
  it("lets completed beats be revisited and locks future beats", () => {
    const onSelectStep = vi.fn();
    render(
      <CareerSetupLayout
        step="season"
        furthestStep="season"
        titleKey="careerSetup.season.title"
        subtitleKey="careerSetup.season.subtitle"
        onBack={() => {}}
        onExit={() => {}}
        onSelectStep={onSelectStep}
        primaryAction={<button type="button">Continue</button>}
      >
        <p>Season</p>
      </CareerSetupLayout>,
    );

    fireEvent.click(screen.getByRole("button", { name: /careerSetup.beats.world/ }));
    expect(onSelectStep).toHaveBeenCalledWith("world");
    expect(screen.getByRole("button", { name: /careerSetup.beats.club/ })).toBeDisabled();
  });
});
