import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog } from "../ui";
import type { ManagerProfile } from "./types";

interface ProfileSaveConfirmProps {
  loadedProfile: ManagerProfile;
  onUpdate: () => void;
  onSaveNew: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export default function ProfileSaveConfirm({
  loadedProfile,
  onUpdate,
  onSaveNew,
  onSkip,
  onClose,
}: ProfileSaveConfirmProps) {
  const { t } = useTranslation();
  const profileName = `${loadedProfile.first_name} ${loadedProfile.last_name}`;
  const titleId = useId();

  return (
    <Dialog labelledBy={titleId} onClose={onClose} className="w-full max-w-sm rounded-panel p-6">
      <h3
        id={titleId}
        className="text-heading font-heading font-bold uppercase tracking-label text-fg"
      >
        {t("managerProfiles.saveConfirm.title")}
      </h3>

      <p className="mt-2 text-body text-fg-muted">
        {t("managerProfiles.saveConfirm.body", { name: profileName })}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <Button variant="primary" size="lg" className="w-full" onClick={onUpdate}>
          {t("managerProfiles.saveConfirm.update", { name: profileName })}
        </Button>

        <Button variant="outline" size="lg" className="w-full" onClick={onSaveNew}>
          {t("managerProfiles.saveConfirm.saveNew")}
        </Button>

        <Button variant="ghost" size="lg" className="w-full" onClick={onSkip}>
          {t("managerProfiles.saveConfirm.skip")}
        </Button>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-6 w-full text-body text-fg-subtle hover:text-fg transition-colors text-center"
      >
        {t("menu.cancel")}
      </button>
    </Dialog>
  );
}
