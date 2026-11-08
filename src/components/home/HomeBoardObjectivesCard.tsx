import { CheckCircle2, Circle, Target } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge, Card, CardBody, CardHeader, ProgressBar } from "../ui";

export interface HomeBoardObjective {
  id: string;
  description: string;
  met: boolean;
}

interface HomeBoardObjectivesCardProps {
  objectives: HomeBoardObjective[];
  satisfaction: number;
  className?: string;
}

/** What the board asked for this season, and how much of it is done. */
export default function HomeBoardObjectivesCard({
  objectives,
  satisfaction,
  className = "",
}: HomeBoardObjectivesCardProps) {
  const { t } = useTranslation();
  const met = objectives.filter((objective) => objective.met).length;
  const percentage = Math.round((met / Math.max(objectives.length, 1)) * 100);

  return (
    <Card className={className}>
      <CardHeader
        action={
          <span className="shrink-0 font-heading text-caption font-bold tabular-nums text-fg-muted">
            {met}/{objectives.length}
          </span>
        }
      >
        <Target className="h-4 w-4 text-selected" aria-hidden="true" />
        {t("home.boardObjectives")}
      </CardHeader>
      <CardBody className="flex flex-col gap-2">
        <ProgressBar
          value={percentage}
          variant="accent"
          size="sm"
          label={t("home.boardObjectives")}
        />
        <ul className="flex flex-col gap-1.5">
          {objectives.map((objective) => (
            <li key={objective.id} className="flex items-center gap-2">
              {objective.met ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-positive" aria-hidden="true" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
              )}
              <span
                className={`min-w-0 flex-1 truncate text-body ${
                  objective.met ? "text-positive line-through" : "text-fg"
                }`}
                title={objective.description}
              >
                {objective.description}
              </span>
              <Badge variant={objective.met ? "success" : "neutral"} size="sm">
                {objective.met ? t("home.met") : t("home.inProgress")}
              </Badge>
            </li>
          ))}
        </ul>
        <p className="mt-auto text-caption text-fg-subtle">
          {t("home.objectivesMet", {
            done: met,
            total: objectives.length,
            pct: satisfaction,
          })}
        </p>
      </CardBody>
    </Card>
  );
}
