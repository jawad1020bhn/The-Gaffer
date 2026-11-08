import { useRatingTiers } from "../../hooks/useRatingTiers";
import { ratingTierClass } from "../../lib/ratingTier";
import { useTranslation } from "react-i18next";
import type { PlayerData } from "../../store/gameStore";
import { Button, CountryFlag } from "../ui";
import { Eye, GitCompareArrows, X } from "lucide-react";
import { calcAge, getPlayerOvr } from "../../lib/helpers";
import { naturalPositionOf } from "../../lib/positions";
import type { PositionTable } from "../../lib/positionTable";
import PlayerPositionBadge from "../PlayerPositionBadge";
import { usePositionTable } from "../../hooks/usePositionGroups";

const ATTRIBUTE_GROUPS: {
  labelKey: string;
  attrs: Array<keyof PlayerData["attributes"]>;
}[] = [
  {
    labelKey: "common.attrGroups.physical",
    attrs: ["pace", "stamina", "strength", "agility"],
  },
  {
    labelKey: "common.attrGroups.technical",
    attrs: ["passing", "shooting", "tackling", "dribbling", "defending"],
  },
  {
    labelKey: "common.attrGroups.mental",
    attrs: [
      "positioning",
      "vision",
      "decisions",
      "composure",
      "aggression",
      "teamwork",
      "leadership",
    ],
  },
  {
    labelKey: "common.attrGroups.goalkeeper",
    attrs: ["handling", "reflexes", "aerial"],
  },
];

/** The id of the inspector's heading, which names the dialog the panel is drawn in. */
export const TACTICS_INSPECTOR_TITLE_ID = "tactics-inspector-title";

interface TacticsPlayerFocusPanelProps {
  canConfirmSwap: boolean;
  comparePlayer: PlayerData | null;
  onClose?: () => void;
  onConfirmSwap: () => void;
  selectedPlayer: PlayerData | null;
}

function getNormalizedPlayerPosition(player: PlayerData, positions: PositionTable): string {
  return positions.groupOf(naturalPositionOf(player));
}

function PlayerSummary({ label, player }: { label: string; player: PlayerData }) {
  const { t } = useTranslation();
  const displayPosition = naturalPositionOf(player);
  const overallRating = getPlayerOvr(player);

  return (
    <div className="rounded-panel border border-line bg-sunken/70 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-body font-heading font-bold uppercase tracking-labelst text-fg-muted">
            {label}
          </p>
          <p className="text-body font-heading font-bold text-fg mt-1">{player.full_name}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <PlayerPositionBadge position={displayPosition} long />
            <span className="text-caption text-fg-muted">
              <CountryFlag code={player.nationality} className="text-caption leading-none mr-1" />
              {t("common.age")} {calcAge(player.date_of_birth)}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-body font-heading font-bold uppercase tracking-labelst text-fg-muted">
            {t("common.ovr")}
          </div>
          <div className="text-display font-heading font-bold text-selected">{overallRating}</div>
        </div>
      </div>
    </div>
  );
}

function SinglePlayerAttributes({ player }: { player: PlayerData }) {
  const tierOf = useRatingTiers();
  const { t } = useTranslation();
  const positions = usePositionTable();
  const isGoalkeeper = getNormalizedPlayerPosition(player, positions) === "Goalkeeper";

  return (
    <div className="space-y-4">
      {ATTRIBUTE_GROUPS.filter(
        (group) => group.labelKey !== "common.attrGroups.goalkeeper" || isGoalkeeper,
      ).map((group) => (
        <div key={group.labelKey}>
          <h4 className="text-body font-heading font-bold uppercase tracking-labelst text-fg-muted mb-2">
            {t(group.labelKey)}
          </h4>
          <div className="space-y-2">
            {group.attrs.map((attr) => {
              const value = player.attributes[attr];
              return (
                <div key={attr} className="grid grid-cols-[minmax(0,1fr)_40px] gap-3 items-center">
                  <div>
                    <div className="text-caption text-fg-muted mb-1">
                      {t(`common.attributes.${attr}`)}
                    </div>
                    <div className="h-2 rounded-full bg-hover overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ratingTierClass(tierOf(value), "bar")}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                  <span
                    className={`text-body font-heading font-bold tabular-nums ${ratingTierClass(tierOf(value), "text")}`}
                  >
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompareAttributes({
  canConfirmSwap,
  comparePlayer,
  onConfirmSwap,
  selectedPlayer,
}: {
  canConfirmSwap: boolean;
  comparePlayer: PlayerData;
  onConfirmSwap: () => void;
  selectedPlayer: PlayerData;
}) {
  const tierOf = useRatingTiers();
  const { t } = useTranslation();
  const positions = usePositionTable();
  const showGoalkeeperAttrs =
    getNormalizedPlayerPosition(selectedPlayer, positions) === "Goalkeeper" ||
    getNormalizedPlayerPosition(comparePlayer, positions) === "Goalkeeper";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <PlayerSummary label={t("tactics.selectedPlayer")} player={selectedPlayer} />
        <PlayerSummary label={t("tactics.comparePlayer")} player={comparePlayer} />
      </div>
      <div className="flex flex-col gap-3 rounded-panel border border-line bg-sunken/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body text-fg-muted">{t("tactics.compareSelectionHint")}</p>
        <Button type="button" size="sm" onClick={onConfirmSwap} disabled={!canConfirmSwap}>
          {t("tactics.confirmSwap")}
        </Button>
      </div>
      {ATTRIBUTE_GROUPS.filter(
        (group) => group.labelKey !== "common.attrGroups.goalkeeper" || showGoalkeeperAttrs,
      ).map((group) => (
        <div key={group.labelKey}>
          <h4 className="text-caption font-heading font-bold uppercase tracking-labelst text-fg-muted mb-2">
            {t(group.labelKey)}
          </h4>
          <div className="space-y-2">
            {group.attrs.map((attr) => {
              const left = selectedPlayer.attributes[attr];
              const right = comparePlayer.attributes[attr];
              const leftWins = left > right;
              const rightWins = right > left;
              return (
                <div
                  key={attr}
                  className="grid grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)] gap-2 items-center"
                >
                  <div
                    className={`rounded-control px-2 py-2 ${leftWins ? "bg-selected-tint ring-1 ring-selected/20" : "bg-sunken/70"}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-caption mb-1">
                      <span
                        className={`font-heading font-bold ${ratingTierClass(tierOf(left), "text")}`}
                      >
                        {left}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-panel overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ratingTierClass(tierOf(left), "bar")}`}
                        style={{ width: `${left}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-center text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
                    {t(`common.attributes.${attr}`)}
                  </div>
                  <div
                    className={`rounded-control px-2 py-2 ${rightWins ? "bg-selected-tint ring-1 ring-selected/20" : "bg-sunken/70"}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-caption mb-1">
                      <span
                        className={`font-heading font-bold ${ratingTierClass(tierOf(right), "text")}`}
                      >
                        {right}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-panel overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ratingTierClass(tierOf(right), "bar")}`}
                        style={{ width: `${right}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TacticsPlayerFocusPanel({
  canConfirmSwap,
  comparePlayer,
  onClose,
  onConfirmSwap,
  selectedPlayer,
}: TacticsPlayerFocusPanelProps) {
  const { t } = useTranslation();

  // No Card of its own: the comparison is drawn inside ui/Dialog, whose panel is the surface,
  // border and shadow, so a Card here drew a second border inside the first.
  return (
    <div>
      <div className="p-4 border-b border-line bg-panel rounded-t-xl">
        <div className="flex items-center justify-between">
          <h3
            id={TACTICS_INSPECTOR_TITLE_ID}
            className="text-body font-heading font-bold text-fg uppercase tracking-label flex items-center gap-2"
          >
            <Eye className="w-4 h-4 text-warning" />
            {t("tactics.inspector")}
          </h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="rounded-control p-1 text-fg/60 transition-colors hover:bg-panel/10 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="p-4">
        {selectedPlayer ? (
          comparePlayer ? (
            <CompareAttributes
              canConfirmSwap={canConfirmSwap}
              comparePlayer={comparePlayer}
              onConfirmSwap={onConfirmSwap}
              selectedPlayer={selectedPlayer}
            />
          ) : (
            <div className="space-y-4">
              <PlayerSummary label={t("tactics.selectedPlayer")} player={selectedPlayer} />
              <div className="rounded-panel border border-dashed border-line px-4 py-3 text-body text-fg-muted">
                {t("tactics.selectSecondPlayer")}
              </div>
              <SinglePlayerAttributes player={selectedPlayer} />
            </div>
          )
        ) : (
          <div className="rounded-panel border border-dashed border-line bg-sunken px-4 py-8 text-center">
            <GitCompareArrows className="mx-auto mb-3 h-10 w-10 text-fg-subtle" />
            <p className="text-body font-heading font-bold uppercase tracking-[0.18em] text-fg">
              {t("tactics.inspectorEmptyTitle")}
            </p>
            <p className="mt-2 text-body text-fg-muted">{t("tactics.selectPitchPlayer")}</p>
            <p className="text-caption text-fg-muted mt-2">{t("tactics.selectAnotherToSwap")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
