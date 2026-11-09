import { useCallback, useEffect, useState, type JSX } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import ArrivalSequence from "../../components/onboarding/ArrivalSequence";
import {
  acknowledgeMilestone,
  advanceArrival,
  createCareerJournal,
  dismissGuide,
  isCareerJournal,
  loadCareerJournal,
  resumeGuide,
  saveCareerJournal,
  skipArrival,
  type CareerJournal,
  type FirstDayMilestone,
} from "../../components/onboarding/careerJournal";
import type {
  BoardPromise,
  CareerPresentation,
} from "../../components/careerSetup/careerSetupModel";
import MainMenu from "../../pages/MainMenu";
import TeamSelection from "../../pages/TeamSelection";
import { setPlayStyle } from "../../services/squadService";
import { saveGame } from "../../services/sessionService";
import { useGameStore } from "../../store/gameStore";
import { ShellPreview } from "../shellPreview/ShellPreview";
import {
  appointManager,
  createOnboardingGameState,
  ONBOARDING_CLUB_ID,
  ONBOARDING_LEAGUE_ID,
  ONBOARDING_SAVE_ID,
  previewManagerIdentity,
} from "./fixture";
import type { OnboardingStage } from "./readOnboardingPreview";

/**
 * The first run, end to end, on the real screens.
 *
 * `/` and `/select-team` mount `MainMenu` and `TeamSelection` unchanged, so the title, the setup
 * beats and the club dossier are the shipped components. `/dashboard` mounts the office through
 * the shell preview's composition (GameShell + workspace) with the career journal wired in, which
 * is the same wiring `Dashboard` does — the difference is that no time is advanced and no match is
 * simulated here.
 *
 * Dev only: `/style-guide.html?preview=onboarding`.
 */

const PRESENTATION: CareerPresentation = {
  guidance: "guided",
  background: "formerPro",
  philosophy: "HighPress",
};

/** The beats `MainMenu` owns are reached by clicking; the later ones need a career already seeded. */
function seedForStage(stage: OnboardingStage): {
  route: string;
  state?: Record<string, unknown>;
} {
  const store = useGameStore.getState();
  const unappointed = createOnboardingGameState(previewManagerIdentity);

  if (stage === "club") {
    store.setGameState(unappointed);
    return { route: "/select-team", state: { careerSetup: PRESENTATION } };
  }

  const appointed = appointManager(
    unappointed,
    ONBOARDING_CLUB_ID,
    ["europe"],
    [ONBOARDING_LEAGUE_ID],
  );
  store.setGameState(appointed);
  store.setGameActive(true, appointed.manager.display_name);
  const journal = createCareerJournal(appointed, PRESENTATION);
  const staged: CareerJournal =
    stage === "sign"
      ? { ...journal, arrivalStage: "sign", promise: "attractive" }
      : stage === "welcome"
        ? { ...journal, arrivalStage: "welcome", promise: "attractive" }
        : stage === "board"
          ? journal
          : {
              ...journal,
              arrivalStage: "done",
              milestones: { ...journal.milestones, board: true },
            };
  saveCareerJournal(appointed, ONBOARDING_SAVE_ID, staged);
  return { route: "/dashboard", state: { arrivalJournal: staged } };
}

/** The office: the shell preview's frame, plus the journal-driven arrival and first-day guidance. */
function OfficePreview(): JSX.Element | null {
  const location = useLocation();
  const navigate = useNavigate();
  const gameState = useGameStore((store) => store.gameState);
  const setGameState = useGameStore((store) => store.setGameState);
  const markClean = useGameStore((store) => store.markClean);
  const [journal, setJournal] = useState<CareerJournal | null>(null);

  useEffect(() => {
    if (!gameState) {
      setJournal(null);
      return;
    }
    const routed = (location.state as { arrivalJournal?: unknown } | null)?.arrivalJournal;
    const stored = loadCareerJournal(gameState, ONBOARDING_SAVE_ID);
    setJournal(
      stored ??
        (isCareerJournal(routed) && routed.managerId === gameState.manager.id ? routed : null),
    );
  }, [gameState, location.state]);

  const update = useCallback(
    (next: CareerJournal) => {
      setJournal(next);
      if (gameState) saveCareerJournal(gameState, ONBOARDING_SAVE_ID, next);
    },
    [gameState],
  );

  const sign = useCallback(async () => {
    if (!gameState || !journal) return;
    const team = gameState.teams.find((candidate) => candidate.id === gameState.manager.team_id);
    if (team && team.play_style !== journal.philosophy) {
      const updated = await setPlayStyle(journal.philosophy);
      setGameState(updated);
      await saveGame();
      markClean();
    }
  }, [gameState, journal, markClean, setGameState]);

  if (!gameState) {
    navigate("/");
    return null;
  }

  return (
    <>
      <ShellPreview
        gameState={gameState}
        careerJournal={journal}
        onDismissGuide={() => journal && update(dismissGuide(journal))}
        onAcknowledgeMilestone={(milestone: FirstDayMilestone) =>
          journal && update(acknowledgeMilestone(journal, milestone))
        }
        onResumeGuide={() => journal && update(resumeGuide(journal))}
      />
      {journal && journal.arrivalStage !== "done" ? (
        <ArrivalSequence
          gameState={gameState}
          journal={journal}
          onAdvance={(promise?: BoardPromise) => update(advanceArrival(journal, promise))}
          onSkip={() => update(skipArrival(journal))}
          onSign={sign}
        />
      ) : null}
    </>
  );
}

function StageEntry({ stage }: { stage: OnboardingStage }): JSX.Element | null {
  const navigate = useNavigate();
  const [ready, setReady] = useState(stage === "title");

  useEffect(() => {
    if (stage === "title") return;
    const { route, state } = seedForStage(stage);
    navigate(route, { state, replace: true });
    setReady(true);
  }, [navigate, stage]);

  if (!ready) return null;
  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/select-team" element={<TeamSelection />} />
      <Route path="/dashboard" element={<OfficePreview />} />
      <Route path="*" element={<MainMenu />} />
    </Routes>
  );
}

export function OnboardingPreview({ stage = "title" }: { stage?: OnboardingStage }): JSX.Element {
  return (
    <BrowserRouter>
      <StageEntry stage={stage} />
    </BrowserRouter>
  );
}
