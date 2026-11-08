import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n, { SUPPORTED_LANGUAGES } from "../../i18n";
import {
  ArrowLeft,
  CheckCircle,
  Package,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Undo2,
  Redo2,
  Save,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Select } from "../ui/Select";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface WorldEditorTopBarProps {
  packageName: string;
  packageDir: string;
  saveState: SaveState;
  isBusy: boolean;
  issueCount: number;
  warningCount: number;
  autoSave: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  onValidate: () => void;
  onBuild: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleAutoSave: () => void;
}

export function WorldEditorTopBar({
  packageName,
  packageDir,
  saveState,
  isBusy,
  issueCount,
  warningCount,
  autoSave,
  canUndo,
  canRedo,
  isDirty,
  onValidate,
  onBuild,
  onSave,
  onUndo,
  onRedo,
  onToggleAutoSave,
}: WorldEditorTopBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex-shrink-0 h-game-top flex items-center justify-between px-4 gap-2 border-b border-line bg-panel">
      {/* Left: back + identity */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-body text-fg-muted hover:text-fg transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("menu.mainMenu")}
        </button>
        <span className="text-fg-subtle flex-shrink-0">·</span>
        <span className="font-heading font-bold text-body uppercase tracking-label text-fg truncate">
          {packageName || t("worldEditor.title")}
        </span>
        {packageDir && (
          <span className="text-caption text-fg-subtle truncate hidden md:block max-w-[200px]">
            {packageDir}
          </span>
        )}
        {isDirty && saveState === "idle" && (
          <span className="text-caption text-warning font-medium flex-shrink-0">●</span>
        )}
      </div>

      {/* Right: undo/redo + save indicator + actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || isBusy}
            title={t("worldEditor.undo")}
            className="p-1.5 rounded-control text-fg-muted hover:bg-hover hover:text-fg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo || isBusy}
            title={t("worldEditor.redo")}
            className="p-1.5 rounded-control text-fg-muted hover:bg-hover hover:text-fg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <span className="w-px h-5 bg-line" />

        {/* Auto-save toggle */}
        <button
          type="button"
          onClick={onToggleAutoSave}
          title={autoSave ? t("worldEditor.autoSaveOn") : t("worldEditor.autoSaveOff")}
          className="flex items-center gap-1 text-caption text-fg-muted hover:text-fg transition-colors"
        >
          {autoSave ? (
            <ToggleRight className="w-4 h-4 text-selected" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          <span className="hidden sm:inline text-caption">{t("worldEditor.autoSave")}</span>
        </button>

        {/* Save indicator + manual save */}
        <button
          type="button"
          onClick={onSave}
          disabled={isBusy}
          title={t("worldEditor.save")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-control border border-line bg-panel text-caption font-heading font-bold uppercase tracking-label text-fg hover:border-selected hover:text-selected transition-all disabled:opacity-40"
        >
          {saveState === "saving" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : saveState === "saved" ? (
            <Save className="w-3.5 h-3.5 text-positive" />
          ) : saveState === "error" ? (
            <AlertCircle className="w-3.5 h-3.5 text-danger" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saveState === "saving" ? (
            <span>{t("worldEditor.saving")}</span>
          ) : saveState === "saved" ? (
            <span className="text-positive">{t("worldEditor.saved")}</span>
          ) : saveState === "error" ? (
            <span className="text-danger">{t("worldEditor.unsaved")}</span>
          ) : (
            <span>{t("worldEditor.save")}</span>
          )}
        </button>

        <span className="w-px h-5 bg-line" />

        <button
          type="button"
          onClick={onValidate}
          disabled={isBusy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-control border border-line bg-panel text-caption font-heading font-bold uppercase tracking-label text-fg hover:border-selected hover:text-selected transition-all disabled:opacity-50"
        >
          {isBusy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : issueCount > 0 ? (
            <AlertCircle className="w-3.5 h-3.5 text-danger" />
          ) : warningCount > 0 ? (
            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
          ) : (
            <CheckCircle className="w-3.5 h-3.5" />
          )}
          {t("worldEditor.validate")}
          {issueCount > 0 && (
            <span className="ml-0.5 bg-danger-tint text-danger text-caption rounded-full px-1.5 py-0.5 leading-none">
              {issueCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="ml-0.5 bg-warning-tint text-warning text-caption rounded-full px-1.5 py-0.5 leading-none">
              {warningCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onBuild}
          disabled={isBusy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-control bg-gradient-to-r from-warning-solid to-warning-solid hover:from-warning-solid hover:to-warning-solid text-on-brand text-caption font-heading font-bold uppercase tracking-label transition-all disabled:opacity-50"
        >
          {isBusy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Package className="w-3.5 h-3.5" />
          )}
          {t("worldEditor.build")}
        </button>

        <span className="w-px h-5 bg-line" />

        {/* Language picker */}
        <Select
          value={i18n.language}
          onChange={(e) => {
            void i18n.changeLanguage(e.target.value);
          }}
          selectSize="sm"
          title={t("settings.language")}
        >
          {SUPPORTED_LANGUAGES.map(({ code, labelKey }) => (
            <option key={code} value={code}>
              {t(labelKey)}
            </option>
          ))}
        </Select>

        {/* Theme toggle */}
      </div>
    </div>
  );
}
