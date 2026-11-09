import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { countryName } from "../lib/countries";
import { resetCountryResourcesCache } from "../components/menu/CreateManagerNationalityField";
import type { ManagerProfile } from "../components/menu/types";
import MainMenu from "./MainMenu";

const navigateMock = vi.fn();
const setGameActiveMock = vi.fn();
const setGameStateMock = vi.fn();
const showErrorMock = vi.fn();
const translationState = { language: "en" };

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../lib/errorDialog", () => ({
  showError: (title: string, detail: string) => showErrorMock(title, detail),
}));

let dialogOpenResult: string | null = null;
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(async () => dialogOpenResult) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(vi.fn())) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigateMock }));

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      typeof options?.defaultValue === "string" ? options.defaultValue : key,
    i18n: { language: translationState.language },
  }),
}));

vi.mock("../store/gameStore", () => ({
  useGameStore: (
    selector: (state: {
      setGameActive: typeof setGameActiveMock;
      setGameState: typeof setGameStateMock;
    }) => unknown,
  ) => selector({ setGameActive: setGameActiveMock, setGameState: setGameStateMock }),
}));

vi.mock("../components/ui", async () => ({
  Dialog: (
    await vi.importActual<typeof import("../components/ui/Dialog")>("../components/ui/Dialog")
  ).Dialog,
  Button: ({
    children,
    icon: _icon,
    iconRight: _iconRight,
    iconLeft: _iconLeft,
    ...props
  }: ComponentPropsWithoutRef<"button"> & {
    icon?: unknown;
    iconRight?: unknown;
    iconLeft?: unknown;
  }) => <button {...props}>{children}</button>,
  CountryFlag: ({ code }: { code: string }) => (
    <span data-testid={`country-flag-${code.toLowerCase()}`} />
  ),
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
    value,
    onChange,
    children,
    "aria-label": ariaLabel,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    children?: ReactNode;
    "aria-label"?: string;
  }) => (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange?.({ target: { value: event.target.value } })}
    >
      {children}
    </select>
  ),
}));

vi.mock("../components/diagnostics/CrashReportPrompt", () => ({ CrashReportPrompt: () => null }));
vi.mock("../components/menu/SavesList", () => ({
  default: ({
    saves,
    onLoad,
  }: {
    saves?: Array<{ id: string; name: string }>;
    onLoad?: (id: string) => void;
  }) => (
    <div data-testid="saves-list">
      {(saves ?? []).map((save) => (
        <button key={save.id} type="button" onClick={() => onLoad?.(save.id)}>
          {save.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("../components/menu/PackageBuildStep", () => ({
  default: ({
    onNext,
    onTogglePackage,
    onInstallPackage,
    installedPackages,
  }: {
    onNext: () => void;
    onTogglePackage: (id: string) => void;
    onInstallPackage: () => void;
    installedPackages: Array<{ id: string }>;
  }) => (
    <div data-testid="package-build-step">
      {installedPackages.map((pkg) => (
        <button
          key={pkg.id}
          type="button"
          onClick={() => onTogglePackage(pkg.id)}
        >{`toggle-${pkg.id}`}</button>
      ))}
      <button type="button" onClick={onInstallPackage}>
        install-package
      </button>
      <button type="button" onClick={onNext}>
        package-next
      </button>
    </div>
  ),
}));

const mockedInvoke = vi.mocked(invoke);

async function openWorldStep(): Promise<void> {
  fireEvent.click(screen.getByText("menu.newGame"));
  await screen.findByTestId("package-build-step");
}

async function openSeasonStep(): Promise<void> {
  await openWorldStep();
  fireEvent.click(screen.getByText("package-next"));
  await screen.findByLabelText("createManager.startYear");
}

async function openIdentityStep(): Promise<void> {
  await openSeasonStep();
  fireEvent.click(screen.getByText("careerSetup.continue"));
  await screen.findByPlaceholderText("createManager.placeholderFirst");
}

function fillManagerDetails(): void {
  fireEvent.change(screen.getByPlaceholderText("createManager.placeholderFirst"), {
    target: { value: "Ada" },
  });
  fireEvent.change(screen.getByPlaceholderText("createManager.placeholderLast"), {
    target: { value: "Lovelace" },
  });
}

async function getNationalityTrigger(): Promise<HTMLButtonElement> {
  let trigger: HTMLButtonElement | null = null;
  await waitFor(() => {
    const fieldContainer = document.getElementById("create-manager-field-nationality");
    const candidate = fieldContainer?.querySelector("div.relative > button:not([disabled])");
    trigger = candidate instanceof HTMLButtonElement ? candidate : null;
    expect(trigger).toBeInstanceOf(HTMLButtonElement);
  });
  if (!trigger) throw new Error("Nationality trigger button not found");
  return trigger;
}

async function selectNationality(language: string, nationalityCode: string): Promise<void> {
  fireEvent.mouseDown(await getNationalityTrigger());
  fireEvent.mouseDown(await screen.findByText(countryName(nationalityCode, language)));
}

async function completeIdentity(language = "en", nationality = "ES"): Promise<void> {
  fillManagerDetails();
  await selectNationality(language, nationality);
  fireEvent.click(screen.getByText("careerSetup.continue"));
}

describe("MainMenu career setup", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setGameActiveMock.mockReset();
    setGameStateMock.mockReset();
    showErrorMock.mockReset();
    dialogOpenResult = null;
    localStorage.clear();
    translationState.language = "en";
    mockedInvoke.mockReset();
    mockedInvoke.mockImplementation(async (command: string) => {
      if (command === "list_installed_packages" || command === "get_manager_profiles") return [];
      if (command === "start_new_game") return { id: "game-1" };
      if (command === "save_manager_profile") {
        return {
          id: "profile-1",
          first_name: "Test",
          last_name: "Manager",
          date_of_birth: "1980-01-01",
          nationality: "GB",
          created_at: new Date().toISOString(),
          last_used_at: null,
        };
      }
      if (command === "touch_manager_profile") return true;
      return null;
    });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      queueMicrotask(() => cb(0));
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetCountryResourcesCache();
  });

  /** Given the title screen, when it opens, then the native menu actions are present. */
  it("shows the title menu", async () => {
    render(<MainMenu />);
    expect(screen.getByText("menu.newGame")).toBeInTheDocument();
    expect(screen.getByText("menu.loadGame")).toBeInTheDocument();
    expect(screen.getByText("menu.settings")).toBeInTheDocument();
  });

  /** Given the guided path, when every beat is completed, then the real startup payload and presentation travel to club selection. */
  it("runs world, season, identity and philosophy before starting the career", async () => {
    render(<MainMenu />);
    await openSeasonStep();
    fireEvent.change(screen.getByLabelText("createManager.startYear"), {
      target: { value: "2028" },
    });
    fireEvent.change(screen.getByLabelText("createManager.startPhase"), {
      target: { value: "midSeason" },
    });
    fireEvent.click(screen.getAllByRole("radio")[3]);
    fireEvent.click(screen.getByText("careerSetup.continue"));

    await screen.findByPlaceholderText("createManager.placeholderFirst");
    await completeIdentity();
    await screen.findByText("careerSetup.philosophyLabel");
    fireEvent.click(screen.getByRole("radio", { name: /careerSetup.philosophies.press/ }));
    fireEvent.click(screen.getByText("careerSetup.findClub"));

    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith(
        "start_new_game",
        expect.objectContaining({
          firstName: "Ada",
          lastName: "Lovelace",
          nationality: "ES",
          startupOptions: expect.objectContaining({
            startYear: 2028,
            startPhase: "midSeason",
            historyDepthYears: 24,
          }),
        }),
      );
    });
    expect(setGameStateMock).toHaveBeenCalledWith({ id: "game-1" });
    expect(navigateMock).toHaveBeenCalledWith("/select-team", {
      state: {
        careerSetup: expect.objectContaining({ guidance: "guided", philosophy: "HighPress" }),
      },
    });
  });

  /** Given quick guidance, when identity is submitted, then the optional philosophy beat is skipped. */
  it("quick setup starts the career directly after identity", async () => {
    render(<MainMenu />);
    await openSeasonStep();
    fireEvent.click(screen.getByText("careerSetup.quick"));
    fireEvent.click(screen.getByText("careerSetup.continue"));
    await screen.findByPlaceholderText("createManager.placeholderFirst");
    await completeIdentity();

    await waitFor(() =>
      expect(mockedInvoke).toHaveBeenCalledWith("start_new_game", expect.anything()),
    );
    expect(screen.queryByText("careerSetup.philosophyLabel")).not.toBeInTheDocument();
    expect(navigateMock).toHaveBeenCalledWith("/select-team", {
      state: { careerSetup: expect.objectContaining({ guidance: "quick" }) },
    });
  });

  /** Given an invalid season, when continuing, then the year field is focused and the identity beat is not opened. */
  it("blocks an invalid start year on the season beat", async () => {
    render(<MainMenu />);
    await openSeasonStep();
    fireEvent.change(screen.getByLabelText("createManager.startYear"), {
      target: { value: "1899" },
    });
    fireEvent.click(screen.getByText("careerSetup.continue"));

    await waitFor(() => expect(screen.getByLabelText("createManager.startYear")).toHaveFocus());
    expect(screen.getByText("validation.minStartYear")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("createManager.placeholderFirst")).not.toBeInTheDocument();
  });

  /** Given an empty identity, when submitting, then the first invalid field is focused. */
  it("focuses the first invalid identity field", async () => {
    render(<MainMenu />);
    await openIdentityStep();
    fireEvent.click(screen.getByText("careerSetup.continue"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("createManager.placeholderFirst")).toHaveFocus(),
    );
  });

  /** Given a stored history depth, when the season beat opens, then the preference is restored and persisted. */
  it("restores and persists the generated history depth", async () => {
    localStorage.setItem("ofm-generated-history-depth-years", "24");
    render(<MainMenu />);
    await openSeasonStep();
    expect(screen.getAllByRole("radio")[3]).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getAllByRole("radio")[1]);
    expect(localStorage.getItem("ofm-generated-history-depth-years")).toBe("6");
  });

  /** Given installed packages, when one is toggled, then its id reaches startup. */
  it("passes activated package ids to startup", async () => {
    mockedInvoke.mockImplementation(async (command: string) => {
      if (command === "list_installed_packages")
        return [
          {
            id: "premier-league",
            name: "Premier League",
            packageType: "database",
            teamCount: 20,
            playerCount: 400,
            issues: [],
          },
        ];
      if (command === "start_new_game") return { id: "game-1" };
      if (command === "get_manager_profiles") return [];
      if (command === "save_manager_profile")
        return {
          id: "profile-1",
          first_name: "Ada",
          last_name: "Lovelace",
          nationality: "ES",
          created_at: new Date().toISOString(),
          last_used_at: null,
        };
      return null;
    });
    render(<MainMenu />);
    await openWorldStep();
    fireEvent.click(await screen.findByText("toggle-premier-league"));
    fireEvent.click(screen.getByText("package-next"));
    fireEvent.click(screen.getByText("careerSetup.continue"));
    await screen.findByPlaceholderText("createManager.placeholderFirst");
    await completeIdentity();
    await screen.findByText("careerSetup.philosophyLabel");
    fireEvent.click(screen.getByText("careerSetup.findClub"));

    await waitFor(() =>
      expect(mockedInvoke).toHaveBeenCalledWith(
        "start_new_game",
        expect.objectContaining({ packageIds: ["premier-league"] }),
      ),
    );
  });

  /** Given a picked package file, when installed, then it becomes activatable. */
  it("installs a world package and makes it activatable", async () => {
    dialogOpenResult = "/tmp/custom-world.ofm";
    let installed = false;
    mockedInvoke.mockImplementation(async (command: string) => {
      if (command === "list_installed_packages")
        return installed
          ? [{ id: "custom-world", name: "Custom World", packageType: "database", issues: [] }]
          : [];
      if (command === "install_package") {
        installed = true;
        return { id: "custom-world", name: "Custom World", packageType: "database", issues: [] };
      }
      if (command === "get_manager_profiles") return [];
      return null;
    });
    render(<MainMenu />);
    await openWorldStep();
    fireEvent.click(await screen.findByText("install-package"));
    await waitFor(() =>
      expect(mockedInvoke).toHaveBeenCalledWith("install_package", {
        path: "/tmp/custom-world.ofm",
      }),
    );
    expect(await screen.findByText("toggle-custom-world")).toBeInTheDocument();
  });

  describe("profile confirm", () => {
    const mockProfile: ManagerProfile = {
      id: "profile-1",
      first_name: "Test",
      last_name: "Manager",
      date_of_birth: "1980-01-01",
      nationality: "GB",
      created_at: "2024-01-01T00:00:00.000Z",
      last_used_at: null,
    };

    beforeEach(() => {
      mockedInvoke.mockImplementation(async (command: string) => {
        if (command === "list_installed_packages") return [];
        if (command === "get_manager_profiles") return [mockProfile];
        if (command === "touch_manager_profile") return true;
        if (command === "save_manager_profile")
          return { ...mockProfile, id: "profile-2", last_used_at: new Date().toISOString() };
        if (command === "update_manager_profile") return { ...mockProfile, first_name: "Modified" };
        if (command === "delete_manager_profile") return true;
        if (command === "start_new_game") return { id: "game-1" };
        return null;
      });
    });

    async function openModal(): Promise<void> {
      render(<MainMenu />);
      await openIdentityStep();
      fireEvent.click(await screen.findByText("Test Manager"));
      fireEvent.change(screen.getByPlaceholderText("createManager.placeholderFirst"), {
        target: { value: "Modified" },
      });
      await selectNationality("en", "ES");
      fireEvent.click(screen.getByText("careerSetup.continue"));
      await screen.findByText("managerProfiles.saveConfirm.title");
    }

    /** Given a modified loaded profile, when continuing, then the save decision is explicit. */
    it("shows the confirm modal", async () => {
      await openModal();
      expect(screen.getByText("managerProfiles.saveConfirm.title")).toBeInTheDocument();
    });

    /** Given the update branch, when chosen, then the profile is updated and the flow continues. */
    it("updates the loaded profile and continues", async () => {
      await openModal();
      fireEvent.click(screen.getByText("managerProfiles.saveConfirm.update"));
      await waitFor(() =>
        expect(mockedInvoke).toHaveBeenCalledWith(
          "update_manager_profile",
          expect.objectContaining({ id: "profile-1", firstName: "Modified" }),
        ),
      );
      await screen.findByText("careerSetup.philosophyLabel");
    });

    /** Given the save-new branch, when chosen, then a forced new profile is saved. */
    it("saves a new profile and continues", async () => {
      await openModal();
      fireEvent.click(screen.getByText("managerProfiles.saveConfirm.saveNew"));
      await waitFor(() =>
        expect(mockedInvoke).toHaveBeenCalledWith(
          "save_manager_profile",
          expect.objectContaining({ firstName: "Modified", force: true }),
        ),
      );
      await screen.findByText("careerSetup.philosophyLabel");
    });

    /** Given cancel, when chosen, then the identity beat remains open. */
    it("cancel keeps the identity beat open", async () => {
      await openModal();
      fireEvent.click(screen.getByText("menu.cancel"));
      await waitFor(() =>
        expect(screen.queryByText("managerProfiles.saveConfirm.title")).not.toBeInTheDocument(),
      );
      expect(screen.getByPlaceholderText("createManager.placeholderFirst")).toBeInTheDocument();
    });
  });

  /** Given a failed load, when the save is opened, then the backend error is surfaced. */
  it("surfaces a message when a save fails to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedInvoke.mockImplementation(async (command: string) => {
      if (command === "get_saves")
        return [
          {
            id: "save-1",
            name: "My Save",
            manager_name: "Ada Lovelace",
            db_filename: "save-1.db",
            checksum: "abc",
            created_at: "2026-01-01T00:00:00Z",
            last_played_at: "2026-02-01T00:00:00Z",
          },
        ];
      if (command === "load_game")
        throw "be.error.saveLoad.incompatibleVersion?saveVersion=99&supported=29";
      if (command === "get_manager_profiles") return [];
      return null;
    });
    render(<MainMenu />);
    fireEvent.click(screen.getByText("menu.loadGame"));
    fireEvent.click(await screen.findByText("My Save"));
    await waitFor(() =>
      expect(showErrorMock).toHaveBeenCalledWith("errors.title", "menu.loadGameFailed"),
    );
    expect(navigateMock).not.toHaveBeenCalledWith("/dashboard");
  });
});

describe("MainMenu routing of an active career", () => {
  const activeGame = (teamId: string | null) => ({
    manager: {
      first_name: "Ada",
      last_name: "Lovelace",
      display_name: "Ada Lovelace",
      team_id: teamId,
    },
    extra_translations: {},
    teams: [],
    players: [],
  });

  function backendReports(stage: string | null, teamId: string | null) {
    mockedInvoke.mockReset();
    mockedInvoke.mockImplementation(async (command: string) => {
      if (command === "get_active_game") return activeGame(teamId);
      if (command === "get_career_stage") {
        if (stage === null) throw "be.error.noActiveGameSession";
        return stage;
      }
      if (command === "get_manager_profiles" || command === "list_installed_packages") return [];
      return null;
    });
  }

  beforeEach(() => {
    navigateMock.mockReset();
  });

  /** Given a clubless active career, when the menu opens, then club selection is resumed. */
  it("a_clubless_manager_lands_on_team_selection", async () => {
    backendReports("awaitingClub", null);
    render(<MainMenu />);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/select-team"));
    expect(navigateMock).not.toHaveBeenCalledWith("/dashboard");
  });

  /** Given an employed manager, when the menu opens, then the dashboard route is unchanged. */
  it("a_manager_with_a_club_lands_where_they_did", async () => {
    backendReports("employed", "team-1");
    render(<MainMenu />);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/dashboard"));
    expect(navigateMock).not.toHaveBeenCalledWith("/select-team");
  });

  /** Given an unemployed manager, when the menu opens, then the dashboard job surface is shown. */
  it("an_unemployed_manager_lands_on_the_dashboard", async () => {
    backendReports("unemployed", null);
    render(<MainMenu />);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/dashboard"));
  });

  /** Given an unknown stage, when the menu opens, then the dashboard fallback still works. */
  it("falls_back_to_the_dashboard_when_the_stage_is_unknown", async () => {
    backendReports(null, "team-1");
    render(<MainMenu />);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/dashboard"));
  });

  /** Given a saved career abandoned at club selection, when loaded, then it resumes there. */
  it("leaving_at_team_selection_resumes_there", async () => {
    let loaded = false;
    mockedInvoke.mockReset();
    mockedInvoke.mockImplementation(async (command: string) => {
      if (command === "get_active_game") {
        if (!loaded) throw "be.error.noActiveGameSession";
        return activeGame(null);
      }
      if (command === "get_saves")
        return [
          {
            id: "save-1",
            name: "Abandoned",
            manager_name: "Ada Lovelace",
            db_filename: "save-1.db",
            checksum: "abc",
            created_at: "2026-01-01T00:00:00Z",
            last_played_at: "2026-02-01T00:00:00Z",
          },
        ];
      if (command === "load_game") {
        loaded = true;
        return activeGame(null);
      }
      if (command === "get_career_stage") return "awaitingClub";
      if (command === "get_manager_profiles" || command === "list_installed_packages") return [];
      return null;
    });
    render(<MainMenu />);
    fireEvent.click(screen.getByText("menu.loadGame"));
    fireEvent.click(await screen.findByText("Abandoned"));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/select-team"));
  });

  /** Given an MCP-created clubless career, when the backend announces it, then club selection opens. */
  it("an_mcp_created_clubless_career_routes_to_team_selection", async () => {
    let careerCreated = false;
    mockedInvoke.mockReset();
    mockedInvoke.mockImplementation(async (command: string) => {
      if (command === "get_active_game") {
        if (!careerCreated) throw "be.error.noActiveGameSession";
        return activeGame(null);
      }
      if (command === "get_career_stage") return "awaitingClub";
      if (command === "get_manager_profiles" || command === "list_installed_packages") return [];
      return null;
    });
    render(<MainMenu />);
    await waitFor(() =>
      expect(listen).toHaveBeenCalledWith("game-state-changed", expect.any(Function)),
    );
    const onGameStateChanged = vi
      .mocked(listen)
      .mock.calls.find(([eventName]) => eventName === "game-state-changed")?.[1];
    expect(navigateMock).not.toHaveBeenCalled();
    careerCreated = true;
    await act(async () => {
      await onGameStateChanged?.({ event: "game-state-changed", id: 1, payload: null });
    });
    expect(navigateMock).toHaveBeenCalledWith("/select-team");
  });
});
