import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  Package,
  FolderOpen,
  Folder,
  Loader2,
  Zap,
  Clock,
  ChevronRight,
  Package2,
} from "lucide-react";
import type { WorldMetaDef } from "../menu/PackageEditor/types";
import { SAMPLE_PACKAGES, type SamplePackage } from "../menu/PackageEditor/sampleData";
import type { PackageInfo } from "../menu/packageTypes";

export interface RecentProject {
  path: string;
  name: string;
  openedAt: string;
}

type HomeView = "home" | "new-form";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

interface WorldEditorHomeProps {
  isBusy: boolean;
  errorMsg: string | null;
  recentProjects: RecentProject[];
  onNewPackage: (meta: WorldMetaDef, sample: SamplePackage | null) => void;
  onOpenPackageFile: () => void;
  onOpenPackageFolder: () => void;
  onOpenRecent: (path: string) => void;
  /**
   * Open an installed package. Deliberately separate from `onOpenRecent`: a
   * recent project is a *directory*, an installed package is a `.ofm`
   * *archive*, and they are opened by different means. Routing both through one
   * callback is what made "Open in Editor" hand an archive path to the
   * directory reader, which found no files and opened an empty editor.
   */
  onOpenInstalled: (ofmPath: string) => void;
}

export function WorldEditorHome({
  isBusy,
  errorMsg,
  recentProjects,
  onNewPackage,
  onOpenPackageFile,
  onOpenPackageFolder,
  onOpenRecent,
  onOpenInstalled,
}: WorldEditorHomeProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [view, setView] = useState<HomeView>("home");
  const [formName, setFormName] = useState("");
  const [formAuthor, setFormAuthor] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [pendingSample, setPendingSample] = useState<SamplePackage | null>(null);
  const [installedPackages, setInstalledPackages] = useState<PackageInfo[]>([]);

  useEffect(() => {
    invoke<PackageInfo[]>("list_installed_packages")
      .then(setInstalledPackages)
      .catch(() => {});
  }, []);

  const derivedSlug = toSlug(formName);

  function openNewForm(sample?: SamplePackage) {
    if (sample) {
      setFormName(sample.meta.name);
      setFormAuthor(sample.meta.author);
      setFormDesc(sample.meta.description);
      setPendingSample(sample);
    } else {
      setFormName("");
      setFormAuthor("");
      setFormDesc("");
      setPendingSample(null);
    }
    setView("new-form");
  }

  function handleCreate() {
    if (!derivedSlug) return;
    const meta: WorldMetaDef = {
      id: derivedSlug,
      name: formName.trim() || derivedSlug,
      description: formDesc.trim(),
      version: "1.0.0",
      author: formAuthor.trim(),
      license: "CC0-1.0",
      packageType: "database",
      gameMinVersion: "0.3.0",
      baseYear: new Date().getFullYear(),
      formatVersion: 1,
      defaultActiveRegions: [],
      defaultActiveCompetitions: pendingSample?.meta.defaultActiveCompetitions ?? [],
      logo: null,
    };
    onNewPackage(meta, pendingSample);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Top bar (shared across views)
  // ──────────────────────────────────────────────────────────────────────────
  const topBar = (
    <div className="flex-shrink-0 h-12 flex items-center px-4 border-b border-line bg-panel">
      <button
        type="button"
        onClick={() => (view === "new-form" ? setView("home") : navigate("/"))}
        className="flex items-center gap-1.5 text-body text-fg-muted hover:text-fg transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {view === "new-form" ? t("common.back") : t("menu.mainMenu")}
      </button>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // New-form view
  // ──────────────────────────────────────────────────────────────────────────
  if (view === "new-form") {
    return (
      <div className="min-h-screen flex flex-col bg-sunken">
        {topBar}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <h2 className="text-title font-heading font-bold uppercase tracking-label text-fg mb-6">
              {t("worldEditor.newWorldForm")}
            </h2>

            {errorMsg && (
              <div className="mb-4 text-body text-danger bg-danger-tint border border-danger/40 rounded-panel px-4 py-3">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-caption font-semibold text-fg-muted uppercase tracking-label mb-1">
                  {t("worldEditor.worldName")} *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("worldEditor.worldNamePlaceholder")}
                  // biome-ignore lint/a11y/noAutofocus: this is the new-world form, reached by clicking through from the home view.
                  autoFocus
                  className="w-full px-3 py-2 rounded-control border border-line bg-panel text-fg text-body focus:outline-none focus:ring-2 focus:ring-selected"
                />
              </div>

              <div>
                <label className="block text-caption font-semibold text-fg-muted uppercase tracking-label mb-1">
                  {t("worldEditor.worldId")}
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-control border border-line bg-sunken text-fg-muted text-body font-mono truncate">
                    {derivedSlug || "—"}
                  </div>
                </div>
                <p className="text-caption text-fg-subtle mt-1">{t("worldEditor.worldIdHint")}</p>
              </div>

              <div>
                <label className="block text-caption font-semibold text-fg-muted uppercase tracking-label mb-1">
                  {t("worldEditor.worldAuthor")}
                </label>
                <input
                  type="text"
                  value={formAuthor}
                  onChange={(e) => setFormAuthor(e.target.value)}
                  className="w-full px-3 py-2 rounded-control border border-line bg-panel text-fg text-body focus:outline-none focus:ring-2 focus:ring-selected"
                />
              </div>

              <div>
                <label className="block text-caption font-semibold text-fg-muted uppercase tracking-label mb-1">
                  {t("worldEditor.worldDesc")}
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-control border border-line bg-panel text-fg text-body focus:outline-none focus:ring-2 focus:ring-selected resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setView("home")}
                disabled={isBusy}
                className="px-4 py-2 text-body font-heading font-bold uppercase tracking-label text-fg-muted hover:text-fg transition-colors disabled:opacity-60"
              >
                {t("common.back")}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isBusy || !derivedSlug}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-selected-fill to-selected-fill text-on-brand rounded-panel font-heading font-bold uppercase tracking-label text-body transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                {isBusy ? t("worldEditor.creating") : t("worldEditor.createWorld")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Home view
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-sunken">
      {topBar}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-6 py-10 flex flex-col gap-8">
          {/* Hero */}
          <div className="text-center">
            <Package className="w-12 h-12 text-selected mx-auto mb-3" />
            <h1 className="text-title font-heading font-bold uppercase tracking-label text-fg">
              {t("worldEditor.title")}
            </h1>
            <p className="text-body text-fg-muted mt-1">{t("worldEditor.homeSubtitle")}</p>
          </div>

          {errorMsg && (
            <div className="text-body text-danger bg-danger-tint border border-danger/40 rounded-panel px-4 py-3">
              {errorMsg}
            </div>
          )}

          {/* Primary actions */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => openNewForm()}
              disabled={isBusy}
              className="flex items-center gap-4 w-full p-5 bg-gradient-to-r from-selected-fill to-selected-fill text-on-brand rounded-panel transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Package className="w-7 h-7 flex-shrink-0" />
              <div className="text-left">
                <p className="font-heading font-bold text-lead uppercase tracking-label">
                  {t("worldEditor.newPackage")}
                </p>
                <p className="text-body text-selected mt-0.5">{t("worldEditor.newPackageDesc")}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenPackageFile}
              disabled={isBusy}
              className="flex items-center gap-4 w-full p-5 bg-panel hover:bg-hover text-fg rounded-panel transition-all duration-200 border border-line hover:border-warning shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FolderOpen className="w-7 h-7 text-warning flex-shrink-0" />
              <div className="text-left">
                <p className="font-heading font-bold text-lead uppercase tracking-label">
                  {t("worldEditor.openPackageFile")}
                </p>
                <p className="text-body text-fg-subtle mt-0.5">
                  {t("worldEditor.openPackageFileDesc")}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenPackageFolder}
              disabled={isBusy}
              className="flex items-center gap-4 w-full p-5 bg-panel hover:bg-hover text-fg rounded-panel transition-all duration-200 border border-line hover:border-warning shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Folder className="w-7 h-7 text-warning flex-shrink-0" />
              <div className="text-left">
                <p className="font-heading font-bold text-lead uppercase tracking-label">
                  {t("worldEditor.openPackageFolder")}
                </p>
                <p className="text-body text-fg-subtle mt-0.5">
                  {t("worldEditor.openPackageFolderDesc")}
                </p>
              </div>
            </button>

            <div className="flex flex-col gap-2">
              <p className="text-caption font-heading font-bold uppercase tracking-[0.18em] text-fg-subtle flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-warning" />
                {t("worldEditor.startFromExample")}
              </p>
              {SAMPLE_PACKAGES.map((sample) => (
                <button
                  type="button"
                  key={sample.meta.id}
                  onClick={() => openNewForm(sample)}
                  disabled={isBusy}
                  className="flex items-start gap-3 w-full px-4 py-3 bg-panel hover:bg-warning-tint text-fg rounded-panel transition-all duration-200 border border-line hover:border-warning/40 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold uppercase tracking-label text-body truncate">
                      {sample.meta.name}
                    </p>
                    <p className="text-caption text-fg-subtle mt-0.5 line-clamp-1">
                      {sample.meta.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent projects */}
          {recentProjects.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-caption font-semibold text-fg-subtle uppercase tracking-label mb-2">
                <Clock className="w-3.5 h-3.5" />
                {t("worldEditor.recentProjects")}
              </h3>
              <div className="flex flex-col gap-1">
                {recentProjects.map((proj) => (
                  <button
                    type="button"
                    key={proj.path}
                    onClick={() => onOpenRecent(proj.path)}
                    disabled={isBusy}
                    className="flex items-center gap-3 w-full px-4 py-3 bg-panel hover:bg-hover rounded-panel border border-line transition-colors text-left disabled:opacity-60"
                  >
                    <Package2 className="w-4 h-4 text-fg-subtle flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-body font-medium text-fg truncate">{proj.name}</p>
                      <p className="text-caption text-fg-subtle truncate font-mono">{proj.path}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-fg-subtle flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Installed packages */}
          {installedPackages.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-caption font-semibold text-fg-subtle uppercase tracking-label mb-2">
                <Package2 className="w-3.5 h-3.5" />
                {t("worldSelect.installedPackages")}
              </h3>
              <div className="flex flex-col gap-1">
                {installedPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="flex items-center gap-3 px-4 py-3 bg-panel rounded-panel border border-line"
                  >
                    <Package2 className="w-4 h-4 text-fg-subtle flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-body font-medium text-fg truncate">{pkg.name}</p>
                      <p className="text-caption text-fg-subtle">
                        v{pkg.version}
                        {pkg.author ? ` · ${pkg.author}` : ""}
                        {" · "}
                        {pkg.teamCount} teams
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenInstalled(pkg.installedPath)}
                      disabled={isBusy}
                      className="text-caption font-semibold text-selected hover:text-selected transition-colors disabled:opacity-60 flex-shrink-0"
                    >
                      {t("worldEditor.openInEditor")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
