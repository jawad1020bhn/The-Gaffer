import { routeForActiveCareer } from "../services/careerService";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGameStore, type GameStateData } from "../store/gameStore";
import type { CareerStartPhase, CreateManagerFormData } from "../components/menu/CreateManagerForm";
import type { PackageInfo, PackageIssue } from "../components/menu/WorldSelect";
import { defaultActivePackageIds } from "../components/menu/packageSelection";
import type { ManagerProfile } from "../components/menu/types";
import { applyExtraTranslations } from "../lib/extraTranslations";
import { formatAppVersion } from "../lib/appVersion";
import { resolveBackendError } from "../utils/backendI18n";
import { prewarmManagerSquadPortraits } from "../services/portraitService";
import { FolderOpen, Settings, PlusCircle, ChevronRight, Power, Package } from "lucide-react";
import { ReportBugModal } from "../components/diagnostics/ReportBugModal";
import { CrashReportPrompt } from "../components/diagnostics/CrashReportPrompt";
import { showError } from "../lib/errorDialog";

const CreateManagerForm = lazy(() => import("../components/menu/CreateManagerForm"));
const ProfileSaveConfirm = lazy(() => import("../components/menu/ProfileSaveConfirm"));
const SavesList = lazy(() => import("../components/menu/SavesList"));
const PackageBuildStep = lazy(() => import("../components/menu/PackageBuildStep"));
const GenerationStep = lazy(() => import("../components/menu/WorldSelect"));

interface SaveEntry {
  id: string;
  name: string;
  manager_name: string;
  team_name: string;
  db_filename: string;
  checksum: string;
  created_at: string;
  last_played_at: string;
}

/**
 * Earliest year a career may start. Historical world packages recreate eras
 * decades before the modern game, so the floor only keeps the clock inside a
 * sane calendar range. Must match `MIN_START_YEAR` in `commands/game.rs`.
 */
const MIN_CAREER_START_YEAR = 1900;
const DEFAULT_GENERATED_HISTORY_DEPTH_YEARS = 12;
const MAX_GENERATED_HISTORY_DEPTH_YEARS = 24;
const GENERATED_HISTORY_DEPTH_STORAGE_KEY = "ofm-generated-history-depth-years";

type StartupOptionsPayload = {
  startYear: number;
  startPhase: CareerStartPhase;
  historyDepthYears: number;
};

function defaultCareerStartYear(): string {
  return String(new Date().getFullYear());
}

function parseCareerStartYear(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

function isCareerStartPhase(value: string): value is CareerStartPhase {
  return value === "seasonStart" || value === "midSeason";
}

function normalizeHistoryDepthYears(value: number): number | null {
  if (!Number.isInteger(value)) return null;
  if (value < 0 || value > MAX_GENERATED_HISTORY_DEPTH_YEARS) return null;
  return value;
}

function initialHistoryDepthYears(): number {
  if (typeof window === "undefined") {
    return DEFAULT_GENERATED_HISTORY_DEPTH_YEARS;
  }

  const storedValue = window.localStorage.getItem(GENERATED_HISTORY_DEPTH_STORAGE_KEY);
  if (storedValue === null) {
    return DEFAULT_GENERATED_HISTORY_DEPTH_YEARS;
  }

  const parsedValue = Number(storedValue);
  return normalizeHistoryDepthYears(parsedValue) ?? DEFAULT_GENERATED_HISTORY_DEPTH_YEARS;
}

function buildStartupOptions(
  formData: CreateManagerFormData,
  historyDepthYears: number,
): StartupOptionsPayload | null {
  const startYear = parseCareerStartYear(formData.startYear);
  if (startYear === null || startYear < MIN_CAREER_START_YEAR) {
    return null;
  }
  if (!isCareerStartPhase(formData.startPhase)) {
    return null;
  }
  const normalizedHistoryDepthYears = normalizeHistoryDepthYears(historyDepthYears);
  if (normalizedHistoryDepthYears === null) {
    return null;
  }

  return {
    startYear,
    startPhase: formData.startPhase,
    historyDepthYears: normalizedHistoryDepthYears,
  };
}

const CREATE_MANAGER_FIELD_ORDER = [
  "firstName",
  "lastName",
  "startYear",
  "startPhase",
  "nationality",
] as const satisfies ReadonlyArray<keyof CreateManagerFormData>;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function deferFocusToNextPaint(callback: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}

function focusFirstCreateManagerError(
  errors: Partial<Record<keyof CreateManagerFormData, string>>,
): void {
  const first = CREATE_MANAGER_FIELD_ORDER.find((k) => errors[k]);
  if (!first) return;
  const root = document.getElementById(`create-manager-field-${first}`);
  root?.scrollIntoView?.({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "center",
  });
  const focusable = root?.querySelector<HTMLElement>(
    "input:not([type=hidden]), button:not([disabled]), select, textarea",
  );
  focusable?.focus({ preventScroll: true });
}

function MenuPanelFallback() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-selected border-t-transparent" />
    </div>
  );
}

export default function MainMenu() {
  const navigate = useNavigate();
  const setGameActive = useGameStore((state) => state.setGameActive);
  const setGameState = useGameStore((state) => state.setGameState);
  const { t } = useTranslation();

  const [menuState, setMenuState] = useState<
    "main" | "create" | "packages" | "generation" | "load"
  >("main");
  const [showProfileConfirm, setShowProfileConfirm] = useState(false);
  const [saves, setSaves] = useState<SaveEntry[]>([]);
  const [isLoadingSaves, setIsLoadingSaves] = useState(false);
  const [loadingSaveId, setLoadingSaveId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [reportingBug, setReportingBug] = useState(false);

  const [profiles, setProfiles] = useState<ManagerProfile[]>([]);
  const [loadedProfile, setLoadedProfile] = useState<ManagerProfile | null>(null);

  const [formData, setFormData] = useState<CreateManagerFormData>({
    firstName: "",
    lastName: "",
    startYear: defaultCareerStartYear(),
    startPhase: "seasonStart",
    nationality: "",
  });
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof CreateManagerFormData, string>>
  >({});

  // Installed packages state
  const [installedPackages, setInstalledPackages] = useState<PackageInfo[]>([]);
  const [activePackageIds, setActivePackageIds] = useState<string[]>([]);
  const [isInstallingPackage, setIsInstallingPackage] = useState(false);
  // Only ever applied once: after this the player's own toggles are the last word.
  const preselectedPackageRef = useRef(false);
  const [packageStackErrors, setPackageStackErrors] = useState<PackageIssue[]>([]);
  const [historyDepthYears, setHistoryDepthYears] = useState(initialHistoryDepthYears);

  useEffect(() => {
    window.localStorage.setItem(GENERATED_HISTORY_DEPTH_STORAGE_KEY, String(historyDepthYears));
  }, [historyDepthYears]);

  useEffect(() => {
    invoke<ManagerProfile[]>("get_manager_profiles")
      .then((p) => setProfiles(p ?? []))
      .catch((error) => console.error("Failed to load manager profiles:", error));
  }, []);

  // Check if a game is already active (e.g. loaded by MCP --mcp-auto-start before frontend mounted)
  useEffect(() => {
    invoke<GameStateData>("get_active_game")
      .then((state) => {
        const mgrName = state.manager.display_name;
        applyExtraTranslations(state.extra_translations);
        setGameState(state);
        setGameActive(true, mgrName);
        return routeForActiveCareer().then(navigate);
      })
      .catch(() => {
        // No active game — stay on menu
      });
  }, [setGameState, setGameActive, navigate]);

  // Listen for game loaded by MCP auto-start (event may arrive after mount)
  useEffect(() => {
    const unlisten = listen("game-state-changed", async () => {
      try {
        const state = await invoke<GameStateData>("get_active_game");
        const mgrName = state.manager.display_name;
        applyExtraTranslations(state.extra_translations);
        setGameState(state);
        setGameActive(true, mgrName);
        navigate(await routeForActiveCareer());
      } catch {
        // Game not actually active — ignore
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setGameState, setGameActive, navigate]);

  const updateFormField = (field: keyof CreateManagerFormData, value: string) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const clearFormError = (field: keyof CreateManagerFormData) => {
    setFormErrors((previous) => ({
      ...previous,
      [field]: "",
    }));
  };

  const validateForm = (): {
    ok: boolean;
    errors: Partial<Record<keyof CreateManagerFormData, string>>;
  } => {
    const errors: Partial<Record<keyof CreateManagerFormData, string>> = {};
    if (!formData.firstName.trim()) {
      errors.firstName = t("validation.required", {
        field: t("createManager.firstName"),
      });
    } else if (formData.firstName.length > 30) {
      errors.firstName = t("validation.maxLength", {
        field: t("createManager.firstName"),
        max: 30,
      });
    }

    if (!formData.lastName.trim()) {
      errors.lastName = t("validation.required", {
        field: t("createManager.lastName"),
      });
    } else if (formData.lastName.length > 30) {
      errors.lastName = t("validation.maxLength", {
        field: t("createManager.lastName"),
        max: 30,
      });
    }

    if (!formData.startYear.trim()) {
      errors.startYear = t("validation.required", {
        field: t("createManager.startYear"),
      });
    } else {
      const startYear = parseCareerStartYear(formData.startYear);
      if (startYear === null || startYear < MIN_CAREER_START_YEAR) {
        errors.startYear = t("validation.minStartYear", {
          min: MIN_CAREER_START_YEAR,
        });
      }
    }
    if (!isCareerStartPhase(formData.startPhase)) {
      errors.startPhase = t("validation.required", {
        field: t("createManager.startPhase"),
      });
    }
    if (!formData.nationality)
      errors.nationality = t("validation.required", {
        field: t("createManager.countryOfOrigin"),
      });
    setFormErrors(errors);
    return {
      ok: Object.keys(errors).length === 0,
      errors,
    };
  };

  const handleGoToWorldSelect = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateForm();
    if (!validation.ok) {
      deferFocusToNextPaint(() => focusFirstCreateManagerError(validation.errors));
      return;
    }
    if (loadedProfile && formDiffersFromProfile(formData, loadedProfile)) {
      setShowProfileConfirm(true);
      return;
    }
    void autoSaveProfile();
    proceedToPackages();
  };

  const loadInstalledPackages = async () => {
    try {
      const pkgs = await invoke<PackageInfo[]>("list_installed_packages");
      // Tauri commands can resolve to null; never let installedPackages become
      // null or downstream `.filter` calls (here and in PackageBuildStep) throw.
      setInstalledPackages(pkgs ?? []);

      // A portable build ships its world installed. Pre-selecting it keeps "New Game" from
      // generating a fictional world beside data the player just downloaded — and from
      // looking like the download was empty.
      if (!preselectedPackageRef.current) {
        preselectedPackageRef.current = true;
        const defaults = defaultActivePackageIds(pkgs ?? []);
        if (defaults.length > 0) setActivePackageIds(defaults);
      }
    } catch (err) {
      console.error("Failed to list packages:", err);
    }
  };

  useEffect(() => {
    if (menuState === "packages") {
      void loadInstalledPackages();
    }
  }, [menuState]);

  const handleInstallPackage = async () => {
    const selected = await open({
      filters: [{ name: "OFM Package", extensions: ["ofm"] }],
      multiple: false,
      title: t("worldSelect.installPackage"),
    });
    if (typeof selected !== "string") return;
    setIsInstallingPackage(true);
    try {
      await invoke<PackageInfo>("install_package", { path: selected });
      await loadInstalledPackages();
    } catch (err) {
      console.error("Failed to install package:", err);
      await showError(t("errors.title"), resolveBackendError(err));
    } finally {
      setIsInstallingPackage(false);
    }
  };

  const handleUninstallPackage = async (id: string) => {
    try {
      await invoke("uninstall_package", { id });
      setInstalledPackages((prev) => prev.filter((p) => p.id !== id));
      setActivePackageIds((prev) => prev.filter((pid) => pid !== id));
      setPackageStackErrors([]);
    } catch (err) {
      console.error("Failed to uninstall package:", err);
      await showError(t("errors.title"), resolveBackendError(err));
    }
  };

  const handleTogglePackage = (id: string) => {
    setActivePackageIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
    setPackageStackErrors([]);
  };

  const handleStartGame = async () => {
    const startupOptions = buildStartupOptions(formData, historyDepthYears);
    if (!startupOptions) {
      const validation = validateForm();
      if (validation.ok) {
        // The two disagreed: `buildStartupOptions` rejected something `validateForm` does not
        // check. Today that is only the generated-history depth, which lives on the world screen
        // and has no field on this form — so bouncing to the create step would put the player in
        // front of a form with no errors on it and no way to tell what was wrong. Say so instead.
        await showError(t("errors.title"), t("menu.startupOptionsRejected"));
        return;
      }
      setMenuState("create");
      deferFocusToNextPaint(() => focusFirstCreateManagerError(validation.errors));
      return;
    }

    setIsStarting(true);
    try {
      const game = await invoke<GameStateData>("start_new_game", {
        firstName: formData.firstName,
        lastName: formData.lastName,
        nationality: formData.nationality,
        startupOptions,
        packageIds: activePackageIds.length > 0 ? activePackageIds : undefined,
      });
      applyExtraTranslations(game.extra_translations);
      setGameState(game);
      navigate("/select-team");
    } catch (error) {
      console.error("Failed to start game:", error);
      await showError(
        t("errors.title"),
        t("menu.failedStartGame", { error: resolveBackendError(error) }),
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleOpenLoadMenu = async () => {
    setMenuState("load");
    setIsLoadingSaves(true);
    try {
      const dbSaves = await invoke<SaveEntry[]>("get_saves");
      setSaves(dbSaves);
    } catch (error) {
      console.error("Failed to load saves:", error);
    } finally {
      setIsLoadingSaves(false);
    }
  };

  const handleLoadGame = async (saveId: string) => {
    setLoadingSaveId(saveId);
    try {
      const managerName = await invoke<string>("load_game", { saveId });
      const activeGame = await invoke<GameStateData>("get_active_game");
      try {
        await prewarmManagerSquadPortraits(activeGame);
      } catch (portraitError) {
        console.warn("Portrait prewarm failed during save load:", portraitError);
      }
      setGameState(activeGame);
      setGameActive(true, managerName);
      navigate(await routeForActiveCareer());
    } catch (error) {
      console.error("Failed to load game:", error);
      setLoadingSaveId(null);
      await showError(
        t("errors.title"),
        t("menu.loadGameFailed", { error: resolveBackendError(error) }),
      );
    }
  };

  const handleDeleteSave = async (saveId: string) => {
    try {
      await invoke<boolean>("delete_save", { saveId });
      setSaves((prev) => prev.filter((s) => s.id !== saveId));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Failed to delete save:", error);
    }
  };

  const handleSelectProfile = (profile: ManagerProfile) => {
    setFormData((prev) => ({
      ...prev,
      firstName: profile.first_name,
      lastName: profile.last_name,
      nationality: profile.nationality,
    }));
    setFormErrors({});
    setLoadedProfile(profile);
    void invoke("touch_manager_profile", { id: profile.id });
  };

  const formDiffersFromProfile = (form: CreateManagerFormData, profile: ManagerProfile) =>
    form.firstName !== profile.first_name ||
    form.lastName !== profile.last_name ||
    form.nationality !== profile.nationality;

  const proceedToPackages = () => {
    setShowProfileConfirm(false);
    setMenuState("packages");
  };

  const handleUpdateProfile = async () => {
    if (!loadedProfile) return;
    try {
      const updated = await invoke<ManagerProfile | null>("update_manager_profile", {
        id: loadedProfile.id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        nationality: formData.nationality,
      });
      if (updated) {
        setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setLoadedProfile(updated);
      }
    } catch (error) {
      console.error("Failed to update manager profile:", error);
    }
    proceedToPackages();
  };

  const handleSaveAsNewProfile = () => {
    void autoSaveProfile(true);
    setLoadedProfile(null);
    proceedToPackages();
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      await invoke<boolean>("delete_manager_profile", { id });
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      if (loadedProfile?.id === id) setLoadedProfile(null);
    } catch (error) {
      console.error("Failed to delete manager profile:", error);
    }
  };

  const autoSaveProfile = async (forceNew = false) => {
    try {
      const saved = await invoke<ManagerProfile>("save_manager_profile", {
        firstName: formData.firstName,
        lastName: formData.lastName,
        nationality: formData.nationality,
        force: forceNew || undefined,
      });
      setProfiles((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        const next =
          !forceNew && exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
        return next.sort((a, b) => {
          const aDate = a.last_used_at ?? a.created_at;
          const bDate = b.last_used_at ?? b.created_at;
          return bDate.localeCompare(aDate);
        });
      });
    } catch (error) {
      console.error("Failed to auto-save manager profile:", error);
    }
  };

  const handleExitApp = async (): Promise<void> => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      await getCurrentWindow().destroy();
    } catch (error) {
      console.error("Failed to exit app:", error);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-page">
      {/* Background gradient accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-selected/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-info/5 blur-3xl" />
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Top accent bar */}
        <div className="h-1.5 rounded-t-panel bg-selected" />

        <div className="rounded-b-panel border border-t-0 border-line bg-panel p-8 shadow-xl">
          {/* Logo */}
          <img
            src="/openfootlogo.svg"
            alt={t("app.name")}
            className="text-center w-full h-full object-cover"
          />

          <div className="my-8 border-t border-line" />

          {/* Main Menu */}
          {menuState === "main" && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setMenuState("create")}
                className="group flex w-full items-center justify-between rounded-control bg-selected p-4 text-on-brand transition-colors hover:bg-selected/90"
              >
                <div className="flex items-center gap-3">
                  <PlusCircle className="w-6 h-6" />
                  <span className="font-heading text-lead font-bold uppercase tracking-label">
                    {t("menu.newGame")}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                onClick={handleOpenLoadMenu}
                className="group flex w-full items-center justify-between rounded-control border border-line bg-sunken p-4 text-fg transition-colors hover:border-selected hover:bg-hover"
              >
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-6 h-6 text-warning" />
                  <span className="font-heading text-lead font-bold uppercase tracking-label">
                    {t("menu.loadGame")}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all text-warning" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/world-editor")}
                className="group flex w-full items-center justify-between rounded-control border border-line bg-sunken p-4 text-fg transition-colors hover:border-selected hover:bg-hover"
              >
                <div className="flex items-center gap-3">
                  <Package className="w-6 h-6 text-warning" />
                  <span className="font-heading text-lead font-bold uppercase tracking-label">
                    {t("menu.worldEditor")}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all text-warning" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/settings", { state: { from: "/" } })}
                className="group flex w-full items-center justify-between rounded-control border border-line bg-sunken p-4 text-fg transition-colors hover:border-line-strong hover:bg-hover"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-6 h-6 text-fg-subtle" />
                  <span className="font-heading text-lead font-bold uppercase tracking-label">
                    {t("menu.settings")}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all text-fg-subtle" />
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleExitApp();
                }}
                className="group flex items-center justify-between w-full p-4 bg-panel hover:bg-danger-tint text-fg rounded-panel transition-all duration-300 border border-line hover:border-danger/40 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <Power className="w-6 h-6 text-danger" />
                  <span className="font-heading text-lead font-bold uppercase tracking-label">
                    {t("menu.exitGame")}
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Step 1: Create Manager Form */}
          {menuState === "create" && (
            <Suspense fallback={<MenuPanelFallback />}>
              <CreateManagerForm
                formData={formData}
                formErrors={formErrors}
                profiles={profiles}
                selectedProfileId={loadedProfile?.id}
                onChange={updateFormField}
                onClearError={clearFormError}
                onClose={() => {
                  setMenuState("main");
                  setFormErrors({});
                  setLoadedProfile(null);
                }}
                onSelectProfile={handleSelectProfile}
                onDeleteProfile={handleDeleteProfile}
                onSubmit={handleGoToWorldSelect}
              />
            </Suspense>
          )}

          {/* Profile save confirmation modal */}
          {showProfileConfirm && loadedProfile && (
            <Suspense fallback={null}>
              <ProfileSaveConfirm
                loadedProfile={loadedProfile}
                onUpdate={() => {
                  void handleUpdateProfile();
                }}
                onSaveNew={() => {
                  void handleSaveAsNewProfile();
                }}
                onSkip={proceedToPackages}
                onClose={() => setShowProfileConfirm(false)}
              />
            </Suspense>
          )}

          {/* Step 2a: Build Your World (package selection) */}
          {menuState === "packages" && (
            <Suspense fallback={<MenuPanelFallback />}>
              <PackageBuildStep
                installedPackages={installedPackages}
                activePackageIds={activePackageIds}
                isInstallingPackage={isInstallingPackage}
                packageStackErrors={packageStackErrors}
                onTogglePackage={handleTogglePackage}
                onInstallPackage={handleInstallPackage}
                onUninstallPackage={handleUninstallPackage}
                onNext={() => setMenuState("generation")}
                onBack={() => setMenuState("create")}
                onClose={() => setMenuState("main")}
              />
            </Suspense>
          )}

          {/* Step 2b: Generation & Completion */}
          {menuState === "generation" && (
            <Suspense fallback={<MenuPanelFallback />}>
              <GenerationStep
                isStarting={isStarting}
                startYear={parseCareerStartYear(formData.startYear) ?? MIN_CAREER_START_YEAR}
                startPhase={formData.startPhase}
                historyDepthYears={historyDepthYears}
                onChangeHistoryDepthYears={setHistoryDepthYears}
                onStart={handleStartGame}
                onBack={() => setMenuState("packages")}
                onClose={() => setMenuState("main")}
                activePackages={installedPackages.filter((p) => activePackageIds.includes(p.id))}
              />
            </Suspense>
          )}

          {/* Load Game List */}
          {menuState === "load" && (
            <Suspense fallback={<MenuPanelFallback />}>
              <SavesList
                loadingSaveId={loadingSaveId}
                saves={saves}
                isLoading={isLoadingSaves}
                confirmDeleteId={confirmDeleteId}
                onLoad={handleLoadGame}
                onDelete={handleDeleteSave}
                onConfirmDelete={setConfirmDeleteId}
                onClose={() => setMenuState("main")}
              />
            </Suspense>
          )}

          {/* Package Editor */}
        </div>
      </div>

      {/* Version */}
      <div className="absolute bottom-4 right-4 text-fg-subtle text-caption font-heading uppercase tracking-label transition-colors">
        {formatAppVersion()}
      </div>

      <CrashReportPrompt onReport={() => setReportingBug(true)} />
      {reportingBug && <ReportBugModal onClose={() => setReportingBug(false)} />}
    </div>
  );
}
