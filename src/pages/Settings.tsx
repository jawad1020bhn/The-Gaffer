import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useSettingsStore, type AppSettings } from "../store/settingsStore";
import { SegmentedControl, Switch, Select } from "../components/ui";
import { changeAppLanguage } from "../i18n";
import { languageOptions } from "../i18n/languageOptions";
import { formatAppVersion } from "../lib/appVersion";
import { Section, SettingRow } from "./Settings.components";
import { ReportBugModal } from "../components/diagnostics/ReportBugModal";
import { SubmittedReports } from "../components/diagnostics/SubmittedReports";
import {
  ArrowLeft,
  Monitor,
  Gamepad2,
  Save,
  Zap,
  Trash2,
  Download,
  Globe,
  Type,
  Maximize,
  Minimize,
  Bug,
  Rows3,
} from "lucide-react";

const CURRENCY_OPTIONS = [
  { value: "EUR", labelKey: "settings.currencyOptions.eur", symbol: "€" },
  { value: "GBP", labelKey: "settings.currencyOptions.gbp", symbol: "£" },
  { value: "USD", labelKey: "settings.currencyOptions.usd", symbol: "$" },
] as const;

const MATCH_MODE_KEYS = ["live", "spectator", "delegate"] as const;
const MATCH_SPEED_KEYS = ["slow", "normal", "fast"] as const;
const UI_SCALE_KEYS = ["small", "normal", "large", "xlarge"] as const;
const UI_DENSITY_KEYS = ["comfortable", "compact"] as const;

export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { settings, loaded, loadSettings, updateSettings } = useSettingsStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [reportingBug, setReportingBug] = useState(false);
  // Bumped whenever the report dialog closes, so a code it just received is listed straight away.
  const [reportsRefresh, setReportsRefresh] = useState(0);
  const [clearSuccess, setClearSuccess] = useState(false);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  // Where to go back to
  const returnTo = (location.state as { from?: string })?.from || "/";

  useEffect(() => {
    if (!loaded) loadSettings();
  }, [loaded, loadSettings]);

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  };

  // Sync language with i18n when settings are loaded
  useEffect(() => {
    if (loaded && settings.language && settings.language !== i18n.language) {
      void changeAppLanguage(settings.language);
    }
  }, [loaded, settings.language, i18n]);

  const handleUpdate = (partial: Partial<AppSettings>) => {
    updateSettings(partial);

    // Sync language with i18n
    if (partial.language) {
      void changeAppLanguage(partial.language);
    }
  };

  const handleClearSaves = async () => {
    try {
      await invoke("clear_all_saves");
      setClearSuccess(true);
      setConfirmClear(false);
      setTimeout(() => setClearSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to clear saves:", err);
    }
  };

  const handleExportWorld = async () => {
    try {
      // Simple export to app data dir
      const path = await invoke<string>("export_world_database", {
        exportPath: "exported_world.json",
      });
      setExportPath(path);
      setTimeout(() => setExportPath(null), 5000);
    } catch (err) {
      console.error("Failed to export world:", err);
    }
  };

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <div className="w-8 h-8 border-4 border-selected border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <header className="border-b border-line bg-panel">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(returnTo)}
              aria-label={t("common.back")}
              className="rounded-control p-2 text-fg-muted transition-colors hover:bg-hover hover:text-fg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-heading text-title font-bold uppercase tracking-label text-fg">
              {t("settings.title")}
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* ─── Display ─── */}
        <Section title={t("settings.display")} icon={<Monitor className="w-5 h-5" />}>
          <SettingRow label={t("settings.language")} description={t("settings.languageDesc")}>
            {(labelId) => (
              <Select
                value={settings.language}
                onChange={(e) => handleUpdate({ language: e.target.value })}
                icon={<Globe className="w-4 h-4" />}
                className="min-w-48"
                aria-labelledby={labelId}
              >
                {languageOptions(t)}
              </Select>
            )}
          </SettingRow>

          <SettingRow label={t("settings.currency")} description={t("settings.currencyDesc")}>
            <Select
              value={settings.currency}
              onChange={(e) =>
                handleUpdate({
                  currency: e.target.value as AppSettings["currency"],
                })
              }
              className="min-w-48"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.symbol} {t(c.labelKey)}
                </option>
              ))}
            </Select>
          </SettingRow>

          <SettingRow label={t("settings.uiScale")} description={t("settings.uiScaleDesc")}>
            {(labelId) => (
              <div className="flex max-w-full items-center gap-2">
                <Type aria-hidden="true" className="w-4 h-4 shrink-0 text-fg-subtle" />
                <SegmentedControl
                  labelledBy={labelId}
                  options={UI_SCALE_KEYS.map((key) => ({
                    value: key,
                    label: t(`settings.uiScaleOptions.${key}`),
                  }))}
                  value={settings.ui_scale}
                  onChange={(ui_scale) => handleUpdate({ ui_scale })}
                />
              </div>
            )}
          </SettingRow>

          <SettingRow label={t("settings.uiDensity")} description={t("settings.uiDensityDesc")}>
            {(labelId) => (
              <div className="flex max-w-full items-center gap-2">
                <Rows3 aria-hidden="true" className="w-4 h-4 shrink-0 text-fg-subtle" />
                <SegmentedControl
                  labelledBy={labelId}
                  options={UI_DENSITY_KEYS.map((key) => ({
                    value: key,
                    label: t(`settings.uiDensityOptions.${key}`),
                  }))}
                  value={settings.ui_density}
                  onChange={(ui_density) => handleUpdate({ ui_density })}
                />
              </div>
            )}
          </SettingRow>

          <SettingRow
            label={t("settings.highContrast")}
            description={t("settings.highContrastDesc")}
          >
            {(labelId) => (
              <Switch
                labelledBy={labelId}
                checked={settings.high_contrast}
                onChange={(high_contrast) => handleUpdate({ high_contrast })}
              />
            )}
          </SettingRow>

          <SettingRow label={t("settings.fullscreen")} description={t("settings.fullscreenDesc")}>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center gap-2 rounded-control border border-line bg-sunken px-4 py-2 font-heading text-caption font-bold uppercase tracking-label text-fg transition-colors hover:bg-hover"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              {isFullscreen ? t("settings.exitFullscreen") : t("settings.enterFullscreen")}
            </button>
          </SettingRow>
        </Section>

        {/* ─── Gameplay ─── */}
        <Section title={t("settings.gameplay")} icon={<Gamepad2 className="w-5 h-5" />}>
          <SettingRow
            label={t("settings.defaultMatchMode")}
            description={t("settings.defaultMatchModeDesc")}
          >
            <Select
              value={settings.default_match_mode}
              onChange={(e) =>
                handleUpdate({
                  default_match_mode: e.target.value as AppSettings["default_match_mode"],
                })
              }
              className="min-w-48"
            >
              {MATCH_MODE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t(`settings.matchModes.${k}`)}
                </option>
              ))}
            </Select>
          </SettingRow>

          <SettingRow label={t("settings.matchSpeed")} description={t("settings.matchSpeedDesc")}>
            {(labelId) => (
              <SegmentedControl
                labelledBy={labelId}
                options={MATCH_SPEED_KEYS.map((k) => ({
                  value: k,
                  label: t(`settings.speeds.${k}`),
                }))}
                value={settings.match_speed}
                onChange={(match_speed) => handleUpdate({ match_speed })}
              />
            )}
          </SettingRow>

          <SettingRow
            label={t("settings.matchCommentary")}
            description={t("settings.matchCommentaryDesc")}
          >
            {(labelId) => (
              <Switch
                labelledBy={labelId}
                checked={settings.show_match_commentary}
                onChange={(show_match_commentary) => handleUpdate({ show_match_commentary })}
              />
            )}
          </SettingRow>

          <SettingRow
            label={t("settings.confirmAdvance")}
            description={t("settings.confirmAdvanceDesc")}
          >
            {(labelId) => (
              <Switch
                labelledBy={labelId}
                checked={settings.confirm_advance}
                onChange={(confirm_advance) => handleUpdate({ confirm_advance })}
              />
            )}
          </SettingRow>

          <SettingRow
            label={t("settings.continueToNextEvent")}
            description={t("settings.continueToNextEventDesc")}
          >
            {(labelId) => (
              <Switch
                labelledBy={labelId}
                checked={settings.continue_to_next_event}
                onChange={(continue_to_next_event) => handleUpdate({ continue_to_next_event })}
              />
            )}
          </SettingRow>

          <SettingRow
            label={t("settings.skipShootoutPicker")}
            description={t("settings.skipShootoutPickerDesc")}
          >
            {(labelId) => (
              <Switch
                labelledBy={labelId}
                checked={settings.skip_shootout_picker}
                onChange={(skip_shootout_picker) => handleUpdate({ skip_shootout_picker })}
              />
            )}
          </SettingRow>
        </Section>

        {/* ─── Saves & Data ─── */}
        <Section title={t("settings.savesData")} icon={<Save className="w-5 h-5" />}>
          <SettingRow label={t("settings.autoSave")} description={t("settings.autoSaveDesc")}>
            {(labelId) => (
              <Switch
                labelledBy={labelId}
                checked={settings.auto_save}
                onChange={(auto_save) => handleUpdate({ auto_save })}
              />
            )}
          </SettingRow>

          <SettingRow label={t("settings.exportWorld")} description={t("settings.exportWorldDesc")}>
            <button
              type="button"
              onClick={handleExportWorld}
              className="flex items-center gap-2 rounded-control bg-selected-tint px-4 py-2 font-heading text-caption font-bold uppercase tracking-label text-selected transition-colors hover:bg-selected/20"
            >
              <Download className="w-4 h-4" />
              {t("settings.export")}
            </button>
          </SettingRow>
          {exportPath && (
            <p className="-mt-2 ml-1 text-caption text-selected">
              {t("settings.exportedTo", { path: exportPath })}
            </p>
          )}

          <div className="mt-2 border-t border-line pt-4">
            <SettingRow
              label={t("settings.clearSaves")}
              description={t("settings.clearSavesDesc")}
              danger
            >
              {confirmClear ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearSaves}
                    className="rounded-control border border-danger bg-danger-tint px-4 py-2 font-heading text-caption font-bold uppercase tracking-label text-danger transition-colors hover:bg-danger-solid/20"
                  >
                    {t("common.confirm")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="rounded-control border border-line bg-sunken px-4 py-2 font-heading text-caption font-bold uppercase tracking-label text-fg transition-colors hover:bg-hover"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              ) : clearSuccess ? (
                <span className="font-heading text-caption font-bold uppercase tracking-label text-positive">
                  {t("settings.savesCleared")}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-2 rounded-control bg-danger-tint px-4 py-2 font-heading text-caption font-bold uppercase tracking-label text-danger transition-colors hover:bg-danger-solid/20"
                >
                  <Trash2 className="w-4 h-4" />
                  {t("settings.clear")}
                </button>
              )}
            </SettingRow>
          </div>
        </Section>

        {/* ─── Help ─── */}
        <Section title={t("settings.help")} icon={<Bug className="w-5 h-5" />}>
          <SettingRow label={t("settings.reportBug")} description={t("settings.reportBugDesc")}>
            <button
              type="button"
              onClick={() => setReportingBug(true)}
              className="flex items-center gap-2 rounded-control bg-selected-tint px-4 py-2 font-heading text-caption font-bold uppercase tracking-label text-selected transition-colors hover:bg-selected/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            >
              <Bug className="w-4 h-4" />
              {t("settings.report")}
            </button>
          </SettingRow>
          <SubmittedReports refreshKey={reportsRefresh} />
        </Section>

        {/* ─── About ─── */}
        <Section title={t("settings.about")} icon={<Zap className="w-5 h-5" />}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-body font-medium text-fg">{t("app.name")}</p>
              <p className="mt-0.5 text-caption text-fg-muted">{formatAppVersion()}</p>
            </div>
            <span className="font-heading text-caption uppercase tracking-label text-fg-subtle">
              {t("app.publisher")}
            </span>
          </div>
        </Section>
      </div>

      {reportingBug && (
        <ReportBugModal
          onClose={() => {
            setReportingBug(false);
            setReportsRefresh((count) => count + 1);
          }}
          onUploaded={() => setReportsRefresh((count) => count + 1)}
        />
      )}
    </div>
  );
}
