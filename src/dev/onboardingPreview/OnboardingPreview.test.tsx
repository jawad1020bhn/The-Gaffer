import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "../../store/gameStore";
import { OnboardingPreview } from "./OnboardingPreview";
import { installOnboardingPreviewIpc } from "./previewIpc";
import { ONBOARDING_SAVE_ID } from "./fixture";
import { careerJournalKey } from "../../components/onboarding/careerJournal";

/**
 * The preview has to draw the shipped screens, not a picture of them: these tests fail if the
 * title screen stops mounting `MainMenu`, if the appointment stops being reachable, or if the
 * stub backend starts allowing a second `select_team`.
 */
describe("OnboardingPreview", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.getState().clearGame();
    mockWindows("main");
    installOnboardingPreviewIpc(mockIPC);
  });

  it("opens on the real title screen with no active career", async () => {
    render(<OnboardingPreview />);

    const text = () => document.body.textContent ?? "";
    await waitFor(() => expect(text()).toContain("New Game"));
    expect(text()).toContain("Load Game");
    // No career is installed, so the office is not drawn behind the title.
    expect(text()).not.toContain("First day essentials");
  });

  it("seeds the club beat on a world whose manager has no club yet", async () => {
    render(<OnboardingPreview stage="club" />);

    await waitFor(() => expect(document.body.textContent ?? "").toContain("Choose Your Club"));
    expect(useGameStore.getState().gameState?.manager.team_id).toBeNull();
    const text = () => document.body.textContent ?? "";
    // The dossier reads the fixture's recorded history and the authored competition.
    await waitFor(() => expect(text()).toContain("Sleeping giants"));
    expect(text()).toContain("Premier Division");
    expect(text()).toContain("2025 · finished 8");
  });

  it("seeds the appointment ceremony without appointing the manager twice", async () => {
    render(<OnboardingPreview stage="board" />);

    await waitFor(() => expect(document.body.textContent ?? "").toContain("The board meeting"));
    const state = useGameStore.getState().gameState;
    expect(state?.manager.team_id).toBe("harbour-city");
    // The ceremony is presentation-only: the journal is stored beside the save, not in the world.
    const stored = window.localStorage.getItem(
      careerJournalKey(state as NonNullable<typeof state>, ONBOARDING_SAVE_ID),
    );
    expect(stored).toContain('"arrivalStage":"board"');
  });
});
