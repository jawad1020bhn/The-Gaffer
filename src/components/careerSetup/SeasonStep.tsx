import { useId } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";

import { SegmentedControl, Select } from "../ui";
import type { CareerSetupDraft, GuidanceMode } from "./careerSetupModel";

const HISTORY_DEPTHS = [0, 6, 12, 24] as const;

interface SeasonStepProps {
  draft: CareerSetupDraft;
  hasDatabase: boolean;
  errors: Partial<Record<"startYear" | "startPhase", string>>;
  onChange: (patch: Partial<CareerSetupDraft>) => void;
}

/** When the career opens and how much help the player wants. Generation itself stays truthful and unstaged. */
export default function SeasonStep({ draft, hasDatabase, errors, onChange }: SeasonStepProps) {
  const { t } = useTranslation();
  const guidanceLabelId = useId();
  const historyLabelId = useId();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div id="create-manager-field-startYear">
          <label
            htmlFor="career-start-year"
            className="mb-1.5 block font-heading text-caption font-bold uppercase tracking-label text-fg-muted"
          >
            {t("createManager.startYear")}
          </label>
          <input
            id="career-start-year"
            aria-label={t("createManager.startYear")}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft.startYear}
            onChange={(event) => onChange({ startYear: event.target.value })}
            className={`w-full rounded-control border bg-sunken p-3 text-fg outline-none transition-colors focus:ring-2 focus:ring-focus ${errors.startYear ? "border-danger" : "border-line-strong"}`}
          />
          {errors.startYear ? (
            <p className="mt-1 flex items-center gap-1 text-caption text-danger">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              {errors.startYear}
            </p>
          ) : null}
        </div>
        <div id="create-manager-field-startPhase">
          <label
            htmlFor="career-start-phase"
            className="mb-1.5 block font-heading text-caption font-bold uppercase tracking-label text-fg-muted"
          >
            {t("createManager.startPhase")}
          </label>
          <Select
            id="career-start-phase"
            aria-label={t("createManager.startPhase")}
            fullWidth
            value={draft.startPhase}
            onChange={(event) =>
              onChange({ startPhase: event.target.value as CareerSetupDraft["startPhase"] })
            }
          >
            <option value="seasonStart">{t("createManager.phaseSeasonStart")}</option>
            <option value="midSeason">{t("createManager.phaseMidSeason")}</option>
          </Select>
          {errors.startPhase ? (
            <p className="mt-1 flex items-center gap-1 text-caption text-danger">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              {errors.startPhase}
            </p>
          ) : null}
        </div>
      </div>

      {!hasDatabase ? (
        <fieldset>
          <legend
            id={historyLabelId}
            className="mb-1 font-heading text-lead font-bold uppercase tracking-label text-fg"
          >
            {t("worldSelect.historyDepth.label")}
          </legend>
          <p className="mb-3 text-body text-fg-muted">{t("worldSelect.historyDepth.hint")}</p>
          <div
            role="radiogroup"
            aria-labelledby={historyLabelId}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {HISTORY_DEPTHS.map((value) => {
              const selected = draft.historyDepthYears === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onChange({ historyDepthYears: value })}
                  className={`rounded-panel border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page ${selected ? "border-selected bg-selected-tint text-selected" : "border-line bg-panel text-fg hover:bg-hover"}`}
                >
                  <span className="block font-heading text-title font-bold">
                    {value === 0
                      ? t("worldSelect.historyDepth.none")
                      : t("worldSelect.historyDepth.option", { count: value })}
                  </span>
                  {value === 12 ? (
                    <span className="mt-1 block text-caption text-fg-muted">
                      {t("worldSelect.historyDepth.recommended")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div>
        <p
          id={guidanceLabelId}
          className="mb-2 font-heading text-lead font-bold uppercase tracking-label text-fg"
        >
          {t("careerSetup.guidanceLabel")}
        </p>
        <SegmentedControl<GuidanceMode>
          labelledBy={guidanceLabelId}
          value={draft.guidance}
          onChange={(guidance) => onChange({ guidance })}
          options={[
            { value: "guided", label: t("careerSetup.guided") },
            { value: "quick", label: t("careerSetup.quick") },
          ]}
          emphasis="outlined"
          fill
        />
        <p className="mt-2 text-body text-fg-muted">
          {t(draft.guidance === "guided" ? "careerSetup.guidedDesc" : "careerSetup.quickDesc")}
        </p>
      </div>
    </div>
  );
}
