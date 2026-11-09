import {
  Check,
  Save,
  Search,
  Settings,
  LogOut,
  Play,
  Compass,
  type LucideIcon,
} from "lucide-react";
import { type JSX, type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../ui";

interface PauseMenuProps {
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
  onOpenSearch: () => void;
  onNavigateSettings: () => void;
  onResumeGuide?: () => void;
  onExitClick: () => void;
  isSaving?: boolean;
  saveFlash?: boolean;
}

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel";

function MenuButton({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled = false,
  tone = "normal",
  buttonRef,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "normal" | "brand" | "danger";
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}): JSX.Element {
  const tones = {
    normal: "bg-sunken text-fg hover:bg-hover",
    brand: "bg-selected-tint text-selected hover:bg-selected-tint/80",
    danger: "bg-sunken text-danger hover:bg-danger-tint",
  } as const;

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 w-full items-center gap-3 rounded-control px-4 text-left font-heading text-body font-bold uppercase tracking-label transition-colors motion-reduce:transition-none disabled:cursor-wait disabled:opacity-60 ${tones[tone]} ${FOCUS_RING}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="flex-1 truncate">{label}</span>
      {hint ? <span className="kbd">{hint}</span> : null}
    </button>
  );
}

/**
 * Escape stops the career, the way it stops a console game: a short list of what can be done from
 * here, big enough to hit with a controller, and the keyboard hint beside each row. It replaces the
 * settings and logout icons that used to float in a page header.
 */
export default function PauseMenu({
  open,
  onClose,
  onSave,
  onOpenSearch,
  onNavigateSettings,
  onResumeGuide,
  onExitClick,
  isSaving = false,
  saveFlash = false,
}: PauseMenuProps): ReactNode {
  const { t } = useTranslation();
  const resumeButton = useRef<HTMLButtonElement>(null);

  // The dialog focuses its panel; the first action is where a keyboard or a controller starts.
  useEffect(() => {
    if (open) resumeButton.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <Dialog
      labelledBy="pause-menu-title"
      onClose={onClose}
      dismissOnBackdrop
      className="w-full max-w-sm rounded-panel p-4"
    >
      <h2
        id="pause-menu-title"
        className="mb-3 font-heading text-title font-bold uppercase tracking-label text-fg"
      >
        {t("pause.title")}
      </h2>
      <div className="flex flex-col gap-1.5">
        <MenuButton
          icon={Play}
          label={t("pause.resume")}
          hint="Esc"
          onClick={onClose}
          tone="brand"
          buttonRef={resumeButton}
        />
        {onSave ? (
          <MenuButton
            icon={saveFlash ? Check : Save}
            label={saveFlash ? t("dashboard.saved") : t("dashboard.saveGame")}
            hint="F5"
            onClick={onSave}
            disabled={isSaving}
          />
        ) : null}
        <MenuButton
          icon={Search}
          label={t("gameNav.search")}
          hint="Ctrl+K"
          onClick={() => {
            onClose();
            onOpenSearch();
          }}
        />
        {onResumeGuide ? (
          <MenuButton
            icon={Compass}
            label={t("firstDay.resume")}
            onClick={() => {
              onClose();
              onResumeGuide();
            }}
          />
        ) : null}
        <MenuButton
          icon={Settings}
          label={t("dashboard.settings")}
          onClick={() => {
            onClose();
            onNavigateSettings();
          }}
        />
        <MenuButton
          icon={LogOut}
          label={t("dashboard.exitToMenu")}
          onClick={() => {
            onClose();
            onExitClick();
          }}
          tone="danger"
        />
      </div>
    </Dialog>
  );
}
