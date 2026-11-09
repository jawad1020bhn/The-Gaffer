import { useTranslation } from "react-i18next";
import { UserRound } from "lucide-react";

import { CountryFlag } from "../ui";
import { MANAGER_BACKGROUNDS, PHILOSOPHY_OPTIONS, type CareerSetupDraft } from "./careerSetupModel";

/** The persistent career summary beside the setup work surface. */
export default function CareerPassport({ draft }: { draft: CareerSetupDraft }) {
  const { t } = useTranslation();
  const name = [draft.firstName, draft.lastName].filter(Boolean).join(" ");
  const background = MANAGER_BACKGROUNDS.find((entry) => entry.id === draft.background);
  const philosophy = PHILOSOPHY_OPTIONS.find((entry) => entry.id === draft.philosophy);

  return (
    <div className="flex flex-col gap-5">
      <p className="font-heading text-caption font-bold uppercase tracking-label text-fg-subtle">
        {t("careerSetup.passport")}
      </p>
      <div className="rounded-panel border border-line bg-sunken p-4">
        <div className="grid h-16 w-16 place-items-center rounded-panel border border-line-strong bg-panel text-fg-subtle">
          <UserRound className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mt-3 break-words font-heading text-title font-bold uppercase tracking-label text-fg">
          {name || t("careerSetup.unnamedManager")}
        </p>
        {draft.nationality ? (
          <p className="mt-1 flex items-center gap-2 text-body text-fg-muted">
            <CountryFlag code={draft.nationality} /> {draft.nationality}
          </p>
        ) : null}
      </div>
      <dl className="flex flex-col gap-3 text-body">
        <div>
          <dt className="text-caption text-fg-subtle">{t("careerSetup.summary.season")}</dt>
          <dd className="font-heading text-lead font-bold text-fg">
            {draft.startYear} ·{" "}
            {t(
              draft.startPhase === "seasonStart"
                ? "createManager.phaseSeasonStart"
                : "createManager.phaseMidSeason",
            )}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-fg-subtle">{t("careerSetup.summary.background")}</dt>
          <dd className="text-fg">{background ? t(background.labelKey) : null}</dd>
        </div>
        <div>
          <dt className="text-caption text-fg-subtle">{t("careerSetup.summary.approach")}</dt>
          <dd className="text-fg">{philosophy ? t(philosophy.labelKey) : null}</dd>
        </div>
        <div>
          <dt className="text-caption text-fg-subtle">{t("careerSetup.summary.guidance")}</dt>
          <dd className="text-fg">
            {t(draft.guidance === "guided" ? "careerSetup.guided" : "careerSetup.quick")}
          </dd>
        </div>
      </dl>
    </div>
  );
}
