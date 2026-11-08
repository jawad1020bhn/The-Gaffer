import { Fragment, useState, type ReactNode } from "react";
import { Shield } from "lucide-react";
import { getAttributeColorClass } from "./PlayerProfile.helpers";
import { getAttributeColors } from "../../lib/playerAttributeDisplay";
import type { PlayerAttributeGroup } from "./PlayerProfile.attributes";
import type { PlayerData } from "../../store/gameStore";
import { Card, CardBody, CardHeader, ProgressBar } from "../ui";
import { PlayerAttributeRadarChart } from "./PlayerAttributeRadarChart";
import PlayerProfileStatCard from "./PlayerProfileStatCard";

interface PlayerProfileAttributesCardProps {
  attrGroups: PlayerAttributeGroup[];
  player: PlayerData;
  attributesVisible: boolean;
  scoutNote?: { scoutedLabel: string; outOfDate: boolean; outOfDateLabel: string };
  /** The club's opinion of his potential, shown above his attributes when it holds one. */
  potentialOpinion?: ReactNode;
  /** His ratings at the positions he plays, shown below his attributes when the club knows them. */
  positionRatings?: ReactNode;
  isGk?: boolean;
  title: string;
  averageLabel: string;
  hiddenTitle: string;
  hiddenBody: string;
  listLabel: string;
  radarLabel: string;
}

export default function PlayerProfileAttributesCard({
  attrGroups,
  player,
  attributesVisible,
  scoutNote,
  potentialOpinion,
  positionRatings,
  isGk = false,
  title,
  averageLabel,
  hiddenTitle,
  hiddenBody,
  listLabel,
  radarLabel,
}: PlayerProfileAttributesCardProps) {
  const [view, setView] = useState<"list" | "radar">("list");

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        action={
          attributesVisible ? (
            <div className="flex rounded-control overflow-hidden border border-line text-caption font-heading font-bold uppercase tracking-label">
              <button
                type="button"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
                className={`px-3 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${view === "list" ? "bg-selected-fill text-on-brand" : "text-fg-muted hover:bg-hover"}`}
              >
                {listLabel}
              </button>
              <button
                type="button"
                aria-pressed={view === "radar"}
                onClick={() => setView("radar")}
                className={`px-3 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${view === "radar" ? "bg-selected-fill text-on-brand" : "text-fg-muted hover:bg-hover"}`}
              >
                {radarLabel}
              </button>
            </div>
          ) : null
        }
      >
        {title}
      </CardHeader>
      <CardBody>
        {potentialOpinion}
        {attributesVisible && scoutNote ? (
          <p className="mb-3 flex flex-wrap items-center gap-2 text-caption text-fg-muted">
            <span>{scoutNote.scoutedLabel}</span>
            {scoutNote.outOfDate ? (
              <span className="rounded-full bg-warning-solid px-2 py-0.5 font-heading text-caption font-bold uppercase tracking-label text-warning bg-warning-tint">
                {scoutNote.outOfDateLabel}
              </span>
            ) : null}
          </p>
        ) : null}
        {attributesVisible && view === "radar" ? (
          <PlayerAttributeRadarChart player={player} isGk={isGk} />
        ) : attributesVisible ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:auto-rows-fr">
            {attrGroups.map((group) => (
              <PlayerProfileStatCard
                key={group.label}
                label={group.label}
                headerRight={
                  <span
                    title={averageLabel}
                    className={`font-heading font-bold text-body tabular-nums ${getAttributeColorClass(group.average)}`}
                  >
                    {group.average}
                  </span>
                }
              >
                <div className="grid grid-cols-[auto_1fr_1.75rem] items-center gap-x-3 gap-y-2.5">
                  {group.attrs.map((attr) => (
                    <Fragment key={attr.name}>
                      <span className="text-caption text-fg-muted whitespace-nowrap">
                        {attr.name}
                      </span>
                      <ProgressBar
                        value={attr.value}
                        variant={getAttributeColors(attr.value).barVariant}
                        size="sm"
                        className="min-w-0"
                      />
                      <span
                        className={`font-heading font-bold text-caption text-right tabular-nums ${getAttributeColorClass(attr.value)}`}
                      >
                        {attr.value}
                      </span>
                    </Fragment>
                  ))}
                </div>
              </PlayerProfileStatCard>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full bg-hover flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-fg-subtle" />
            </div>
            <p className="text-body text-fg-muted font-medium">{hiddenTitle}</p>
            <p className="text-caption text-fg-subtle mt-1 max-w-xs mx-auto">{hiddenBody}</p>
          </div>
        )}
        {attributesVisible ? positionRatings : null}
      </CardBody>
    </Card>
  );
}
