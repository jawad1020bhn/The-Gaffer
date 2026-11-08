import { useEffect, useRef, type JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button, Dialog } from "../ui";

interface TacticsDeleteDialogProps {
  /** The tactic's name, shown so the player knows which one is going. */
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Asks before a saved tactic is deleted. Focus starts on Cancel: the safe answer is one key away. */
export default function TacticsDeleteDialog({
  name,
  onCancel,
  onConfirm,
}: TacticsDeleteDialogProps): JSX.Element {
  const { t } = useTranslation();
  const buttonsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    buttonsRef.current?.querySelector("button")?.focus();
  }, []);

  return (
    <Dialog
      labelledBy="delete-tactic-title"
      describedBy="delete-tactic-body"
      onClose={onCancel}
      dismissOnBackdrop
      className="w-full max-w-md rounded-panel p-6"
    >
      <h2
        id="delete-tactic-title"
        className="font-heading font-bold uppercase tracking-label text-title text-gray-900 dark:text-gray-100"
      >
        {t("tactics.deleteTacticTitle")}
      </h2>
      <p id="delete-tactic-body" className="mt-2 text-body text-fg">
        {t("tactics.deleteTacticBody", { name })}
      </p>
      <div ref={buttonsRef} className="mt-6 flex gap-3">
        <Button variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button className="flex-1" onClick={onConfirm}>
          {t("tactics.deleteTacticConfirm")}
        </Button>
      </div>
    </Dialog>
  );
}
