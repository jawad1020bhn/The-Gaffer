import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../context/ThemeContext";
import { useSettingsStore } from "../store/settingsStore";
import Settings from "./Settings";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock, isTauri: () => false }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

// The theme provider asks the system for its colour scheme; jsdom has no matchMedia.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

function renderSettings() {
  render(
    <MemoryRouter>
      <ThemeProvider>
        <Settings />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

const savedSettings = () =>
  invokeMock.mock.calls
    .filter(([command]) => command === "save_settings")
    .map(([, args]) => (args as { settings: Record<string, unknown> }).settings);

const lastSaved = () => {
  const saved = savedSettings();
  return saved[saved.length - 1];
};

// The store as a fresh launch has it: a choice saved by one test must not be the next one's.
const freshStore = useSettingsStore.getState();

/** The backend answers with these saved settings; the rest are the store's defaults. */
function answerWithSaved(settings: Record<string, unknown>) {
  invokeMock.mockImplementation(async (command: string) => {
    if (command === "get_settings") {
      return {
        settings,
        currency: { code: "EUR", symbol: "€", exchange_rate: 1 },
        supported_currencies: [{ code: "EUR", symbol: "€", exchange_rate: 1 }],
      };
    }
    return command.startsWith("list_") ? [] : null;
  });
}

beforeEach(() => {
  useSettingsStore.setState(freshStore, true);
  invokeMock.mockReset();
  answerWithSaved({});
});

describe("Settings: retired presentation controls", () => {
  /** Given the dedicated dark game shell, when Display settings render, then old theme/sidebar controls are gone. */
  it("does not offer the retired theme or sidebar controls", async () => {
    renderSettings();
    await screen.findByRole("radiogroup", { name: "settings.uiScale" });
    expect(screen.queryByRole("radiogroup", { name: "settings.theme" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "settings.sidebarWidth" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "settings.sidebarBehaviour" }),
    ).not.toBeInTheDocument();
  });
});

describe("Settings: the language picker", () => {
  /**
   * Given the game ships English and announces Arabic
   * When the language picker opens
   * Then English is the only selectable row and Arabic is there but disabled, marked as coming
   *      soon. An enabled Arabic row would switch the game to a language with no strings.
   */
  it("offers English and announces Arabic without letting it be chosen", async () => {
    renderSettings();

    const trigger = await screen.findByRole("combobox", { name: "settings.language" });
    fireEvent.click(trigger);

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(2);

    const [english, arabic] = options;
    expect(english).toHaveAccessibleName("settings.languages.en");
    expect(english).not.toBeDisabled();
    expect(arabic).toHaveAccessibleName("settings.languages.ar (settings.languageComingSoon)");
    expect(arabic).toBeDisabled();
  });

  /**
   * Given the open picker with Arabic disabled
   * When a player clicks it anyway
   * Then nothing is saved and the picker stays on English.
   */
  it("does not change the language when the announced row is clicked", async () => {
    renderSettings();

    const trigger = await screen.findByRole("combobox", { name: "settings.language" });
    fireEvent.click(trigger);
    fireEvent.click(
      within(screen.getByRole("listbox")).getByRole("option", {
        name: "settings.languages.ar (settings.languageComingSoon)",
      }),
    );

    expect(savedSettings()).toHaveLength(0);
    expect(useSettingsStore.getState().settings.language).toBe("en");
  });
});

describe("Settings: the choices", () => {
  /**
   * Given the Settings page
   * When a screen reader reaches each row with a choice of a few
   * Then it is a radio group named by the row's own label, with the saved choice checked and the
   * only one in the tab order: UI scale, density, match speed.
   */
  it.each([
    ["settings.uiScale", "settings.uiScaleOptions.normal"],
    ["settings.uiDensity", "settings.uiDensityOptions.comfortable"],
    ["settings.matchSpeed", "settings.speeds.normal"],
  ])("draws %s as a radio group named by its row", async (row, saved) => {
    renderSettings();
    const group = await screen.findByRole("radiogroup", { name: row });
    const checked = within(group).getByRole("radio", { checked: true });
    expect(checked).toHaveAccessibleName(saved);
    expect(checked).toHaveAttribute("tabindex", "0");
    for (const other of within(group).getAllByRole("radio", { checked: false })) {
      expect(other).toHaveAttribute("tabindex", "-1");
    }
  });

  /**
   * Given the match speed on Normal, with the focus on it
   * When the player presses the right arrow
   * Then the choice and the focus move to Fast, and it is saved.
   */
  it("moves a choice with the arrow keys", async () => {
    renderSettings();
    const speed = await screen.findByRole("radiogroup", { name: "settings.matchSpeed" });
    const normal = within(speed).getByRole("radio", { name: "settings.speeds.normal" });
    normal.focus();
    fireEvent.keyDown(normal, { key: "ArrowRight" });
    await waitFor(() => expect(lastSaved()).toMatchObject({ match_speed: "fast" }));
    expect(within(speed).getByRole("radio", { name: "settings.speeds.fast" })).toHaveFocus();
  });

  it("saves compact density from the Display section", async () => {
    renderSettings();
    const density = await screen.findByRole("radiogroup", { name: "settings.uiDensity" });
    fireEvent.click(
      within(density).getByRole("radio", { name: "settings.uiDensityOptions.compact" }),
    );
    await waitFor(() => expect(lastSaved()).toMatchObject({ ui_density: "compact" }));
  });

  /**
   * Given each on/off setting saved as the opposite of its default
   * When a screen reader reaches it on the Settings page
   * Then it is a switch named by its row's label, saying the saved state (not the default);
   * flipping it saves the other state.
   */
  it.each([
    ["settings.highContrast", "high_contrast", false],
    ["settings.matchCommentary", "show_match_commentary", true],
    ["settings.confirmAdvance", "confirm_advance", false],
    ["settings.continueToNextEvent", "continue_to_next_event", false],
    ["settings.skipShootoutPicker", "skip_shootout_picker", false],
    ["settings.autoSave", "auto_save", true],
  ] as const)("draws %s as a switch named by its row", async (row, field, byDefault) => {
    const saved = !byDefault;
    answerWithSaved({ [field]: saved });
    renderSettings();
    const control = await screen.findByRole("switch", { name: row });
    await waitFor(() => expect(control).toHaveAttribute("aria-checked", String(saved)));

    fireEvent.click(control);
    await waitFor(() => expect(lastSaved()).toMatchObject({ [field]: byDefault }));
  });
});
