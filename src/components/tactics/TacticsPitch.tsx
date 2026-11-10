import type { DragEvent, JSX } from "react";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getPlayerOvr } from "../../lib/helpers";
import type { FamiliarityTable } from "../../hooks/useFamiliarity";
import type { PositionTable } from "../../lib/positionTable";
import { usePositionTable } from "../../hooks/usePositionGroups";
import type { PlayerData, TeamMatchRolesData } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import { Badge, Card, PitchToken, Select, usePitchTokenFocus } from "../ui";
import {
  getSquadTacticalFit,
  translatePositionAbbreviation,
  type DragState,
  type SquadSection,
} from "../squad/SquadTab.helpers";
import type { TacticsPitchSlot } from "./TacticsTab.helpers";
import { buildTacticsPlayerContextMenuItems } from "./TacticsContextMenu.helpers";
import type { PlayerRole, TacticsPhaseSettings } from "../../store/types";
import { getRoleOptions } from "../../lib/playerRoles";

interface TacticsPitchProps {
  /** The screen's one familiarity table, the one its count and its writers grade with. */
  familiarity: FamiliarityTable;
  /** The table, the familiarity and the squad's answer are all in: tokens state a fit only then. */
  lineupReady: boolean;
  benchPlayers?: PlayerData[];
  dragState: DragState | null;
  formation: string;
  matchRoles?: TeamMatchRolesData;
  onRoleChange?: (playerId: string, role: PlayerRole) => void;
  playerRoles?: Record<string, PlayerRole>;
  tacticsPhase?: TacticsPhaseSettings;
  comparePlayerId: string | null;
  hoveredSlot: number | null;
  onAssignBestFit?: (playerId: string) => void;
  onAssignMatchRole?: (role: keyof TeamMatchRolesData, playerId: string) => void;
  onClearSelection: () => void;
  onDemoteStarter?: (playerId: string) => void;
  onDragStart: (
    event: DragEvent<HTMLElement>,
    playerId: string,
    from: SquadSection,
    slotIndex: number | null,
  ) => void;
  onDragEnd: () => void;
  onLineupPlayerClick: (playerId: string, section: SquadSection) => void;
  onOpenPlayerProfile?: (playerId: string) => void;
  onPromoteBench?: (playerId: string) => void;
  onSlotDragOver: (event: DragEvent<HTMLElement>, slotIndex: number) => void;
  onSlotDragLeave: (slotIndex: number) => void;
  onSlotDrop: (event: DragEvent<HTMLElement>, slotIndex: number) => void;
  /** Null until the lineup can be graded: the badge then claims no count. */
  outOfPositionCount: number | null;
  pitchSlots: TacticsPitchSlot[];
  selectedPlayer: PlayerData | null;
  selectedPlayerId: string | null;
}

type FitTone = "exact" | "adapted" | "out" | "empty";

interface RoleMarker {
  key: keyof TeamMatchRolesData;
  shortLabel: string;
  toneClassName: string;
}

function getFitTone(
  player: PlayerData | null,
  slotPosition: string,
  positionTable: PositionTable,
  familiarity: FamiliarityTable,
  lineupReady: boolean,
): FitTone {
  // The tone waits on what the count waits on, so the pitch never states a verdict in one place
  // and withholds it in another.
  if (!player || !lineupReady) {
    return "empty";
  }

  // No grade (not loaded, or not the club's) is no verdict: the token says nothing of fit.
  switch (getSquadTacticalFit(player, slotPosition, positionTable, familiarity)) {
    case "natural":
      return "exact";
    case "out":
      return "out";
    case "adapted":
      return "adapted";
    default:
      return "empty";
  }
}

function getRoleMarkers(
  matchRoles: TeamMatchRolesData | undefined,
  playerId: string,
): RoleMarker[] {
  if (!matchRoles) {
    return [];
  }

  const markers: RoleMarker[] = [];

  if (matchRoles.captain === playerId) {
    markers.push({
      key: "captain",
      shortLabel: "C",
      toneClassName: "border-warning bg-warning-tint text-warning",
    });
  }

  if (matchRoles.vice_captain === playerId) {
    markers.push({
      key: "vice_captain",
      shortLabel: "VC",
      toneClassName: "border-line/60 bg-chrome/85 text-fg",
    });
  }

  if (matchRoles.penalty_taker === playerId) {
    markers.push({
      key: "penalty_taker",
      shortLabel: "PK",
      toneClassName: "border-selected bg-selected-fill text-on-brand",
    });
  }

  if (matchRoles.free_kick_taker === playerId) {
    markers.push({
      key: "free_kick_taker",
      shortLabel: "FK",
      toneClassName: "border-positive bg-positive-solid text-on-brand",
    });
  }

  if (matchRoles.corner_taker === playerId) {
    markers.push({
      key: "corner_taker",
      shortLabel: "CK",
      toneClassName: "border-warning bg-warning-tint text-warning",
    });
  }

  return markers;
}

function getPitchMarkerClassName(options: {
  comparePlayerId: string | null;
  draggedPlayerId: string | null;
  hoveredSlot: number | null;
  player: PlayerData;
  selectedPlayerId: string | null;
  slot: TacticsPitchSlot;
}): string {
  const { comparePlayerId, draggedPlayerId, hoveredSlot, player, selectedPlayerId, slot } = options;
  const isDragged = draggedPlayerId === player.id;
  const isSelected = selectedPlayerId === player.id;
  const isComparing = comparePlayerId === player.id;
  const isHovered = hoveredSlot === slot.index;

  const base =
    "absolute z-20 flex w-[6rem] -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center gap-0.5 rounded-panel px-1 py-1 text-center transition-all active:cursor-grabbing";

  if (isDragged) {
    return `${base} opacity-60`;
  }

  if (isSelected) {
    return `${base} bg-warning-tint ring-2 ring-focus shadow-lg`;
  }

  if (isComparing) {
    return `${base} bg-selected-tint ring-2 ring-selected/50 shadow-lg`;
  }

  if (isHovered) {
    return `${base} bg-selected-tint shadow-lg`;
  }

  return `${base} hover:-translate-y-[54%]`;
}

function getSlotTargetClassName(isHovered: boolean, hasPlayer: boolean): string {
  if (isHovered) {
    return "absolute z-10 h-[4.5rem] w-[4.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-selected/40 bg-selected-tint";
  }

  if (hasPlayer) {
    return "absolute z-10 h-[4.5rem] w-[4.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line/10 bg-transparent";
  }

  return "absolute z-10 h-[4.5rem] w-[4.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-line/25 bg-overlay/10";
}

function getPitchDisplayName(player: PlayerData): string {
  return (player.match_name || player.full_name).toUpperCase();
}

// SVG viewBox is 0 0 100 140; pitch bounds x=[4,96] y=[4,136]; midfield at y=70.
// Team attacks upward (toward y=4). Defensive line sits in the lower half.
function getDefensiveLineY(line: TacticsPhaseSettings["defensive_line"]): number {
  switch (line) {
    case "High":
      return 77;
    case "Low":
      return 105;
    case "VeryLow":
      return 118;
    default:
      return 91; // Medium
  }
}

function getPressingZoneOpacity(intensity: TacticsPhaseSettings["pressing_intensity"]): number {
  switch (intensity) {
    case "Aggressive":
      return 0.13;
    case "Passive":
      return 0;
    default:
      return 0.07; // Medium
  }
}

function getPressingZoneTop(intensity: TacticsPhaseSettings["pressing_intensity"]): number {
  // Aggressive: press from opponent's half; Medium: press from 35m line; Passive: no zone
  switch (intensity) {
    case "Aggressive":
      return 4;
    case "Passive":
      return 70;
    default:
      return 35;
  }
}

function TacticalOverlays({ phase }: { phase: TacticsPhaseSettings }): JSX.Element {
  const lineY = getDefensiveLineY(phase.defensive_line);
  const pressOpacity = getPressingZoneOpacity(phase.pressing_intensity);
  const pressTop = getPressingZoneTop(phase.pressing_intensity);

  return (
    <>
      {/* Pressing zone: shaded band in the opponent's half */}
      {pressOpacity > 0 && (
        <rect
          x="4"
          y={pressTop}
          width="92"
          height={70 - pressTop}
          fill={`rgba(255,220,100,${pressOpacity})`}
          pointerEvents="none"
        />
      )}

      {/* Defensive line: dashed horizontal line */}
      <line
        x1="4"
        y1={lineY}
        x2="96"
        y2={lineY}
        stroke="rgba(255,80,80,0.75)"
        strokeWidth="0.8"
        strokeDasharray="3,2"
        pointerEvents="none"
      />
    </>
  );
}

export default function TacticsPitch({
  dragState,
  familiarity,
  lineupReady,
  formation,
  matchRoles,
  onRoleChange,
  playerRoles,
  tacticsPhase,
  comparePlayerId,
  hoveredSlot,
  onAssignBestFit,
  onAssignMatchRole,
  onClearSelection,
  onDemoteStarter,
  onDragEnd,
  onDragStart,
  onLineupPlayerClick,
  onOpenPlayerProfile,
  onPromoteBench,
  onSlotDragLeave,
  onSlotDragOver,
  onSlotDrop,
  outOfPositionCount,
  pitchSlots,
  selectedPlayer,
  selectedPlayerId,
}: TacticsPitchProps): JSX.Element {
  const { t } = useTranslation();
  const positionTable = usePositionTable();
  const { focusedPlayerId, focusToken, blurToken, getDescriptionId } = usePitchTokenFocus();
  const draggedPlayerId = dragState?.playerId ?? null;

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-1.5 rounded-t-panel border-b border-line bg-panel px-3 py-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-body font-heading font-bold uppercase tracking-label text-fg">
            <Star className="h-4 w-4 fill-current text-warning" />
            {t("preMatch.startingXI")} - {formation}
          </h3>
          {/* Own line, so the hint wraps instead of truncating mid-word against the legend. */}
          <p className="mt-0.5 text-caption text-fg-subtle">{t("tactics.pitchInteractionHint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {outOfPositionCount === null ? null : (
            <Badge variant={outOfPositionCount > 0 ? "danger" : "success"} size="sm">
              {outOfPositionCount} {t("squad.outOfPosition")}
            </Badge>
          )}
          <span className="rounded-full bg-positive-tint px-2.5 py-1 text-caption font-heading font-bold uppercase tracking-labelst text-positive">
            {t("tactics.naturalFit")}
          </span>
          <span className="rounded-full bg-warning-tint px-2.5 py-1 text-caption font-heading font-bold uppercase tracking-labelst text-warning">
            {t("tactics.adaptedFit")}
          </span>
          <span className="rounded-full bg-danger-tint px-2.5 py-1 text-caption font-heading font-bold uppercase tracking-labelst text-danger">
            {t("squad.outOfPosition")}
          </span>
          <span className="rounded-full bg-panel/8 px-2.5 py-1 text-caption font-heading font-bold uppercase tracking-labelst text-fg/70">
            {t("tactics.tableInteractionHint")}
          </span>
          {selectedPlayer ? (
            <button
              type="button"
              onClick={onClearSelection}
              className="text-caption font-heading font-bold uppercase tracking-label text-warning hover:text-warning"
            >
              {t("common.clear")}
            </button>
          ) : null}
        </div>
      </div>

      {/* The pitch is the one thing on this screen that must never scroll or be clipped. It is
          sized by the height left over after the header, so it always fits whole: height drives
          width through the aspect ratio, not the other way round. */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <div className="relative mx-auto aspect-[8/10] h-full max-w-full overflow-hidden rounded-panel border border-selected/20 bg-linear-to-b from-selected-fill to-selected-fill shadow-inner">
          <div className="h-full w-full">
            <svg
              viewBox="0 0 100 140"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="tactics-pitch-surface" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(63, 172, 99, 0.94)" />
                  <stop offset="100%" stopColor="rgba(31, 109, 61, 0.98)" />
                </linearGradient>
                <pattern
                  id="tactics-pitch-stripes"
                  width="100"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="100" height="10" fill="rgba(255,255,255,0.04)" />
                </pattern>
              </defs>
              <rect x="0" y="0" width="100" height="140" fill="url(#tactics-pitch-surface)" />
              <rect x="0" y="0" width="100" height="140" fill="url(#tactics-pitch-stripes)" />
              <rect
                x="4"
                y="4"
                width="92"
                height="132"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <line
                x1="4"
                y1="70"
                x2="96"
                y2="70"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <circle
                cx="50"
                cy="70"
                r="11"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <circle cx="50" cy="70" r="0.8" fill="rgba(255,255,255,0.75)" />
              <rect
                x="18"
                y="4"
                width="64"
                height="18"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <rect
                x="31"
                y="4"
                width="38"
                height="8"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <rect
                x="18"
                y="118"
                width="64"
                height="18"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <rect
                x="31"
                y="128"
                width="38"
                height="8"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <path
                d="M 38 22 A 12 12 0 0 0 62 22"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              <path
                d="M 38 118 A 12 12 0 0 1 62 118"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="0.6"
              />
              {tacticsPhase ? <TacticalOverlays phase={tacticsPhase} /> : null}
            </svg>

            {pitchSlots.map((slot) => {
              const player = slot.player;
              const fitTone = getFitTone(
                player,
                slot.position,
                positionTable,
                familiarity,
                lineupReady,
              );
              const isHovered = hoveredSlot === slot.index;

              return (
                <div
                  key={slot.index}
                  className="absolute"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  <div
                    data-testid={`pitch-slot-${slot.index}`}
                    className={getSlotTargetClassName(isHovered, !!player)}
                    onDragOver={(event) => onSlotDragOver(event, slot.index)}
                    onDragLeave={() => onSlotDragLeave(slot.index)}
                    onDrop={(event) => onSlotDrop(event, slot.index)}
                  />

                  {player ? (
                    (() => {
                      const roleMarkers = getRoleMarkers(matchRoles, player.id);

                      return (
                        <ContextMenu
                          items={buildTacticsPlayerContextMenuItems({
                            isSelected: selectedPlayerId === player.id,
                            matchRoles,
                            onAssignBestFit,
                            onAssignMatchRole,
                            onClearSelection,
                            onDemoteStarter,
                            onOpenProfile: (playerId) => {
                              if (onOpenPlayerProfile) {
                                onOpenPlayerProfile(playerId);
                              } else {
                                onLineupPlayerClick(playerId, "xi");
                              }
                            },
                            onPromoteBench,
                            onTacticalSelect: onLineupPlayerClick,
                            player,
                            section: "xi",
                            selectedPlayerId,
                            t,
                          })}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            aria-describedby={getDescriptionId(player.id)}
                            onFocus={() => focusToken(player.id)}
                            onBlur={blurToken}
                            draggable
                            data-testid={`pitch-player-${player.id}`}
                            onClick={() => onLineupPlayerClick(player.id, "xi")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onLineupPlayerClick(player.id, "xi");
                              }
                            }}
                            onDragOver={(event) => onSlotDragOver(event, slot.index)}
                            onDragLeave={() => onSlotDragLeave(slot.index)}
                            onDrop={(event) => onSlotDrop(event, slot.index)}
                            onDragStart={(event) => onDragStart(event, player.id, "xi", slot.index)}
                            onDragEnd={onDragEnd}
                            className={getPitchMarkerClassName({
                              comparePlayerId,
                              draggedPlayerId,
                              hoveredSlot,
                              player,
                              selectedPlayerId,
                              slot,
                            })}
                          >
                            <PitchToken
                              descriptionId={getDescriptionId(player.id)}
                              focused={focusedPlayerId === player.id}
                              name={getPitchDisplayName(player)}
                              positionAbbr={translatePositionAbbreviation(t, slot.position)}
                              position={slot.position}
                              ovr={getPlayerOvr(player)}
                              condition={player.condition}
                              fitTone={fitTone}
                              hidePortrait
                              markers={roleMarkers}
                            >
                              {/* Role combobox */}
                              {onRoleChange && (
                                <div
                                  draggable={false}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  className="w-full"
                                >
                                  <Select
                                    aria-label={`${player.full_name} — ${t("tactics.teamRoles")}`}
                                    selectSize="sm"
                                    variant="ghost"
                                    fullWidth
                                    value={playerRoles?.[player.id] ?? "Standard"}
                                    onChange={(e) => {
                                      onRoleChange(player.id, e.target.value as PlayerRole);
                                    }}
                                  >
                                    {getRoleOptions(
                                      // Roles follow the deployed slot, which is
                                      // what the backend validates against —
                                      // natural-position roles for an
                                      // out-of-position player would be
                                      // rejected and silently revert (#272).
                                      slot.position,
                                      playerRoles?.[player.id] ?? "Standard",
                                    ).map((role) => (
                                      <option key={role} value={role}>
                                        {t(`tactics.playerRoles.${role}`, role)}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                              )}
                            </PitchToken>
                          </div>
                        </ContextMenu>
                      );
                    })()
                  ) : (
                    <div className="absolute z-20 flex w-[4.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-line/28 bg-overlay/12 text-caption font-heading font-bold uppercase tracking-[0.18em] text-fg/70">
                        {translatePositionAbbreviation(t, slot.position)}
                      </div>
                      <span className="sr-only">{t("squad.dropPlayerHere")}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
