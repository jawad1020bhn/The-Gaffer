import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Volume2, VolumeX } from "lucide-react";

import { isUiSoundEnabled, playUiCue, setUiSoundEnabled } from "../../lib/uiSound";

/** Small persisted sound preference for the setup/ceremony scenes. */
export default function SoundToggle() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(isUiSoundEnabled);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setUiSoundEnabled(next);
    if (next) playUiCue("confirm");
  }

  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={t(enabled ? "careerSetup.soundOn" : "careerSetup.soundOff")}
      onClick={toggle}
      className="rounded-control p-2 text-fg-subtle transition-colors hover:bg-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-chrome"
    >
      {enabled ? (
        <Volume2 className="h-4 w-4" aria-hidden="true" />
      ) : (
        <VolumeX className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
