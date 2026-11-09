import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Landmark, PenLine, ShieldCheck } from "lucide-react";

import { kitStyle } from "../../lib/kitStyle";
import { formatDateFull, getUserNextFixture, getTeamName } from "../../lib/helpers";
import type { GameStateData, PlayerData } from "../../store/gameStore";
import { resolveBoardObjective, resolveMessage } from "../../utils/backendI18n";
import { Badge, Button, Dialog, PlayerAvatar, TeamLogo } from "../ui";
import ChoiceCards from "../careerSetup/ChoiceCards";
import SoundToggle from "../careerSetup/SoundToggle";
import { playUiCue } from "../../lib/uiSound";
import {
  MANAGER_BACKGROUNDS,
  PHILOSOPHY_OPTIONS,
  type BoardPromise,
} from "../careerSetup/careerSetupModel";
import type { CareerJournal } from "./careerJournal";

interface ArrivalSequenceProps {
  gameState: GameStateData;
  journal: CareerJournal;
  onAdvance: (promise?: BoardPromise) => void;
  onSkip: () => void;
  onSign?: () => Promise<void>;
}

const PROMISES: ReadonlyArray<{ value: BoardPromise; labelKey: string; descriptionKey: string }> = [
  {
    value: "europe",
    labelKey: "arrival.promises.europe",
    descriptionKey: "arrival.promises.europeDesc",
  },
  {
    value: "attractive",
    labelKey: "arrival.promises.attractive",
    descriptionKey: "arrival.promises.attractiveDesc",
  },
  {
    value: "survival",
    labelKey: "arrival.promises.survival",
    descriptionKey: "arrival.promises.survivalDesc",
  },
];

function keyPlayers(gameState: GameStateData, teamId: string): PlayerData[] {
  const captainId = gameState.teams.find((team) => team.id === teamId)?.match_roles?.captain;
  const squad = gameState.players.filter((player) => player.team_id === teamId);
  return [...squad]
    .sort((left, right) => {
      if (left.id === captainId) return -1;
      if (right.id === captainId) return 1;
      return right.market_value - left.market_value;
    })
    .slice(0, 3);
}

/** The appointment ceremony. The career is already committed; this scene never calls select_team again. */
export default function ArrivalSequence({
  gameState,
  journal,
  onAdvance,
  onSkip,
  onSign,
}: ArrivalSequenceProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const [promise, setPromise] = useState<BoardPromise>(journal.promise ?? "survival");
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState(false);
  const team = gameState.teams.find((candidate) => candidate.id === gameState.manager.team_id);
  const stage = journal.arrivalStage;
  const managerName = gameState.manager.display_name;
  const background = MANAGER_BACKGROUNDS.find((entry) => entry.id === journal.background);
  const philosophy = PHILOSOPHY_OPTIONS.find((entry) => entry.id === journal.philosophy);
  const nextFixture = getUserNextFixture(gameState);
  const stageTitleKey =
    stage === "board"
      ? "arrival.board.title"
      : stage === "sign"
        ? "arrival.sign.title"
        : "arrival.welcome.title";

  async function handleSign() {
    if (signing) return;
    setSigning(true);
    setSignError(false);
    try {
      await onSign?.();
      playUiCue("confirm");
      onAdvance();
    } catch {
      setSignError(true);
    } finally {
      setSigning(false);
    }
  }

  if (!team || stage === "done") return null;

  return (
    <Dialog
      labelledBy={titleId}
      onClose={onSkip}
      overlayClassName="bg-page p-0"
      surfaceClassName="bg-page"
      className="flex h-dvh w-full max-w-none flex-col rounded-none border-0"
    >
      <div className="h-1.5 shrink-0 bg-kit" style={kitStyle(team.colors)} />
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-chrome px-6 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <TeamLogo team={team} className="h-12 w-12 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-heading text-lead font-bold uppercase tracking-label text-fg">
              {team.name}
            </p>
            <p className="text-caption text-fg-muted">
              {formatDateFull(gameState.clock.current_date, i18n.language)}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onSkip} disabled={signing}>
          {t("arrival.skip")}
        </Button>
      </header>

      <div className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto">
        <img
          src="/assets/onboarding/stadium-night.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
        />
        <div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center gap-6 px-6 py-8">
          {stage === "board" ? (
            <>
              <div className="flex items-start gap-5">
                <div
                  className="grid h-20 w-20 shrink-0 place-items-center rounded-panel border border-line-strong bg-panel font-heading text-display font-bold text-selected"
                  aria-hidden="true"
                >
                  {team.short_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="flex items-center gap-2 font-heading text-caption font-bold uppercase tracking-label text-selected">
                    <Landmark className="h-4 w-4" aria-hidden="true" />{" "}
                    {t("arrival.board.chairman")}
                  </p>
                  <h1
                    id={titleId}
                    className="mt-1 font-heading text-display font-bold uppercase tracking-label text-fg"
                  >
                    {t(stageTitleKey)}
                  </h1>
                  <p className="mt-3 max-w-2xl text-lead text-fg-muted">
                    {t("arrival.board.speech", { club: team.name, manager: managerName })}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {gameState.board_objectives.slice(0, 3).map((objective) => {
                  const resolved = resolveBoardObjective(objective);
                  return (
                    <div
                      key={objective.id}
                      className="rounded-panel border border-line bg-panel/90 p-4"
                    >
                      <p className="font-heading text-caption font-bold uppercase tracking-label text-fg-subtle">
                        {t("arrival.board.objective")}
                      </p>
                      <p className="mt-1 text-body text-fg">{resolved.description}</p>
                    </div>
                  );
                })}
              </div>
              <ChoiceCards
                label={t("arrival.board.promiseLabel")}
                options={PROMISES.map((entry) => ({
                  value: entry.value,
                  label: t(entry.labelKey),
                  description: t(entry.descriptionKey),
                }))}
                value={promise}
                onChange={setPromise}
              />
              <p className="text-caption text-fg-subtle">{t("arrival.promiseNote")}</p>
            </>
          ) : null}

          {stage === "sign" ? (
            <div className="mx-auto w-full max-w-2xl rounded-panel border border-line bg-panel/95 p-8 shadow-card">
              <p className="flex items-center gap-2 font-heading text-caption font-bold uppercase tracking-label text-selected">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> {t("arrival.sign.official")}
              </p>
              <h1
                id={titleId}
                className="mt-2 font-heading text-display font-bold uppercase tracking-label text-fg"
              >
                {t(stageTitleKey)}
              </h1>
              <dl className="mt-6 grid gap-4 border-y border-line py-6 sm:grid-cols-2">
                <div>
                  <dt className="text-caption text-fg-subtle">{t("arrival.sign.manager")}</dt>
                  <dd className="font-heading text-title font-bold text-fg">{managerName}</dd>
                </div>
                <div>
                  <dt className="text-caption text-fg-subtle">{t("arrival.sign.club")}</dt>
                  <dd className="font-heading text-title font-bold text-fg">{team.name}</dd>
                </div>
                <div>
                  <dt className="text-caption text-fg-subtle">{t("arrival.sign.background")}</dt>
                  <dd className="text-body text-fg">
                    {background ? t(background.labelKey) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-fg-subtle">{t("arrival.sign.approach")}</dt>
                  <dd className="text-body text-fg">
                    {philosophy ? t(philosophy.labelKey) : null}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-body text-fg-muted">{t("arrival.sign.note")}</p>
              {signError ? (
                <p role="alert" className="mt-3 text-body text-danger">
                  {t("arrival.sign.error")}
                </p>
              ) : null}
            </div>
          ) : null}

          {stage === "welcome" ? (
            <>
              <div className="text-center">
                <Badge variant="accent">{t("arrival.welcome.press")}</Badge>
                <h1
                  id={titleId}
                  className="mt-3 font-heading text-display font-bold uppercase tracking-label text-fg"
                >
                  {t("arrival.appointedHeadline", { manager: managerName, club: team.name })}
                </h1>
                <p className="mt-2 text-lead text-fg-muted">
                  {t("arrival.welcome.subtitle", { club: team.name })}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {keyPlayers(gameState, team.id).map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 rounded-panel border border-line bg-panel/90 p-4"
                  >
                    <PlayerAvatar
                      player={player}
                      className="h-12 w-12 shrink-0 overflow-hidden rounded-control"
                      enableRuntimePortrait={false}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-heading text-body font-bold uppercase tracking-label text-fg">
                        {player.match_name}
                      </p>
                      <p className="text-caption text-fg-muted">
                        {player.id === team.match_roles?.captain
                          ? t("arrival.welcome.captain")
                          : t("arrival.welcome.keyPlayer")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-panel border border-line bg-panel/90 p-4">
                <p className="font-heading text-caption font-bold uppercase tracking-label text-fg-subtle">
                  {t("arrival.welcome.inbox")}
                </p>
                {gameState.messages.slice(0, 3).map((message) => {
                  const resolved = resolveMessage(message);
                  return (
                    <p key={message.id} className="mt-1 truncate text-body text-fg">
                      {resolved.subject}
                    </p>
                  );
                })}
                {nextFixture ? (
                  <p className="mt-2 text-caption text-fg-muted">
                    {t("arrival.welcome.nextFixture", {
                      home: getTeamName(gameState.teams, nextFixture.home_team_id),
                      away: getTeamName(gameState.teams, nextFixture.away_team_id),
                    })}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-chrome px-6 py-4">
        <div className="flex items-center gap-3">
          <SoundToggle />
          <p className="text-caption text-fg-subtle">{t("arrival.footerHint")}</p>
        </div>
        {stage === "board" ? (
          <Button variant="primary" size="lg" onClick={() => onAdvance(promise)}>
            {t("arrival.board.continue")}
          </Button>
        ) : null}
        {stage === "sign" ? (
          <Button
            variant="primary"
            size="lg"
            icon={<PenLine />}
            disabled={signing}
            onClick={() => void handleSign()}
          >
            {signing ? t("arrival.sign.signing") : t("arrival.sign.action")}
          </Button>
        ) : null}
        {stage === "welcome" ? (
          <Button variant="primary" size="lg" onClick={() => onAdvance()}>
            {t("arrival.welcome.action")}
          </Button>
        ) : null}
      </footer>
    </Dialog>
  );
}
