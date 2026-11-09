import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SeasonStep from "./SeasonStep";
import { createSetupDraft } from "./careerSetupModel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => options?.defaultValue ?? key,
  }),
}));

vi.mock("../ui", () => ({
  SegmentedControl: ({
    options,
    value,
    onChange,
  }: {
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <div role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
  Select: ({
    children,
    fullWidth: _fullWidth,
    ...props
  }: React.ComponentPropsWithoutRef<"select"> & { fullWidth?: boolean }) => (
    <select {...props}>{children}</select>
  ),
}));

describe("SeasonStep", () => {
  /** Given a generated world, when the season beat renders, then history depth and guidance are explicit choices. */
  it("offers history depth and guidance for a generated world", () => {
    const onChange = vi.fn();
    render(
      <SeasonStep
        draft={createSetupDraft(2026)}
        hasDatabase={false}
        errors={{}}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("createManager.startYear")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("radio")[3]);
    expect(onChange).toHaveBeenCalledWith({ historyDepthYears: 24 });
    fireEvent.click(screen.getByText("careerSetup.quick"));
    expect(onChange).toHaveBeenCalledWith({ guidance: "quick" });
  });

  /** Given an authored database, when the season beat renders, then generated-history controls are hidden. */
  it("hides generated history when a database supplies the past", () => {
    render(
      <SeasonStep draft={createSetupDraft(2026)} hasDatabase errors={{}} onChange={() => {}} />,
    );

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
