import { useTranslation } from "react-i18next";

import ChoiceCards from "./ChoiceCards";
import { PHILOSOPHY_OPTIONS, type TacticalPhilosophy } from "./careerSetupModel";

interface PhilosophyStepProps {
  value: TacticalPhilosophy;
  onChange: (value: TacticalPhilosophy) => void;
}

/** A starting tactical identity, applied through the existing play-style command when the appointment is signed. */
export default function PhilosophyStep({ value, onChange }: PhilosophyStepProps) {
  const { t } = useTranslation();
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <ChoiceCards
        label={t("careerSetup.philosophyLabel")}
        options={PHILOSOPHY_OPTIONS.map((entry) => ({
          value: entry.id,
          label: t(entry.labelKey),
          description: t(entry.descriptionKey),
        }))}
        value={value}
        onChange={onChange}
      />
      <p className="text-body text-fg-muted">{t("careerSetup.philosophyNote")}</p>
    </div>
  );
}
