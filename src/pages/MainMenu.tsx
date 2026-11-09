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
import type { PackageInfo, PackageIssue } from "../components/menu/packageTypes";
import { defaultActivePackageIds } from "../components/menu/packageSelection";
import type { ManagerProfile } from "../components/menu/types";
import { applyExtraTranslations } from "../lib/extraTranslations";
import { formatAppVersion } from "../lib/appVersion";
import { resolveBackendError } from "../utils/backendI18n";
import { prewarmManagerSquadPortraits } from "../services/portraitService";
import {
  FolderOpen,
  Settings,
  PlusCircle,
  ChevronRight,
  Power,
  Bug,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { ReportBugModal } from "../components/diagnostics/ReportBugModal";
import { CrashReportPrompt } from "../components/diagnostics/CrashReportPrompt";
import { showError } from "../lib/errorDialog";
import { Button } from "../components/ui";
import CareerSetupLayout from "../components/careerSetup/CareerSetupLayout";
import CareerPassport from "../components/careerSetup/CareerPassport";
import SeasonStep from "../components/careerSetup/SeasonStep";
import PhilosophyStep from "../components/careerSetup/PhilosophyStep";
import {
  beatIndex,
  createSetupDraft,
  nextSetupStep,
  presentationOf,
  previousSetupStep,
  type CareerSetupDraft,
  type CareerSetupStep,
} from "../components/careerSetup/careerSetupModel";

const CreateManagerForm = lazy(() => import("../components/menu/CreateManagerForm"));
const ProfileSaveConfirm = lazy(() => import("../components/menu/ProfileSaveConfirm"));
const SavesList = lazy(() => import("../components/menu/SavesList"));
const PackageBuildStep = lazy(() => import("../components/menu/PackageBuildStep"));

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

const MIN_CAREER_START_YEAR = 1900;
const MAX_GENERATED_HISTORY_DEPTH_YEARS = 24;
const GENERATED_HISTORY_DEPTH_STORAGE_KEY = "ofm-generated-history-depth-years";
const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page";

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
  return Number.isInteger(parsed) ? parsed : null;
}

function isCareerStartPhase(value: string): value is CareerStartPhase {
  return value === "seasonStart" || value === "midSeason";
}

function normalizeHistoryDepthYears(value: number): number | null {
  if (!Number.isInteger(value) || value < 0 || value > MAX_GENERATED_HISTORY_DEPTH_YEARS)
    return null;
  return value;
}

function initialHistoryDepthYears(): number {
  if (typeof window === "undefined") return 12;
  const storedValue = window.localStorage.getItem(GENERATED_HISTORY_DEPTH_STORAGE_KEY);
  if (storedValue === null) return 12;
  return normalizeHistoryDepthYears(Number(storedValue)) ?? 12;
}

function buildStartupOptions(draft: CareerSetupDraft): StartupOptionsPayload | null {
  const startYear = parseCareerStartYear(draft.startYear);
  if (
    startYear === null ||
    startYear < MIN_CAREER_START_YEAR ||
    !isCareerStartPhase(draft.startPhase)
  )
    return null;
  const historyDepthYears = normalizeHistoryDepthYears(draft.historyDepthYears);
  if (historyDepthYears === null) return null;
  return { startYear, startPhase: draft.startPhase, historyDepthYears };
}

const CREATE_MANAGER_FIELD_ORDER = [
  "firstName",
  "lastName",
  "startYear",
  "startPhase",
  "nationality",
] as const satisfies ReadonlyArray<keyof CreateManagerFormData>;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function deferFocusToNextPaint(callback: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

function focusFirstCreateManagerError(
  errors: Partial<Record<keyof CreateManagerFormData, string>>,
): void {
  const first = CREATE_MANAGER_FIELD_ORDER.find((key) => errors[key]);
  if (!first) return;
  const root = document.getElementById(`create-manager-field-${first}`);
  root?.scrollIntoView?.({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
  root
    ?.querySelector<HTMLElement>(
      "input:not([type=hidden]), button:not([disabled]), select, textarea",
    )
    ?.focus({ preventScroll: true });
}

function MenuPanelFallback() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-64 items-center justify-center"
      role="status"
      aria-label={t("dashboard.loading")}
    >
      <Loader2 className="h-8 w-8 animate-spin text-selected" aria-hidden="true" />
    </div>
  );
}

export default function MainMenu() {
  const navigate = useNavigate();
  const setGameActive = useGameStore((state) => state.setGameActive);
  const setGameState = useGameStore((state) => state.setGameState);
  const { t } = useTranslation();

  const [screen, setScreen] = useState<"title" | "setup" | "load">("title");
  const [draft, setDraft] = useState<CareerSetupDraft>(() => ({
    ...createSetupDraft(Number(defaultCareerStartYear())),
    historyDepthYears: initialHistoryDepthYears(),
  }));
  const [showProfileConfirm, setShowProfileConfirm] = useState(false);
  const [saves, setSaves] = useState<SaveEntry[]>([]);
  const [isLoadingSaves, setIsLoadingSaves] = useState(false);
  const [loadingSaveId, setLoadingSaveId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [reportingBug, setReportingBug] = useState(false);
  const [profiles, setProfiles] = useState<ManagerProfile[]>([]);
  const [loadedProfile, setLoadedProfile] = useState<ManagerProfile | null>(null);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof CreateManagerFormData, string>>
  >({});
  const [installedPackages, setInstalledPackages] = useState<PackageInfo[]>([]);
  const [isInstallingPackage, setIsInstallingPackage] = useState(false);
  const preselectedPackageRef = useRef(false);
  const [packageStackErrors, setPackageStackErrors] = useState<PackageIssue[]>([]);
  const titleActionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const formData: CreateManagerFormData = {
    firstName: draft.firstName,
    lastName: draft.lastName,
    startYear: draft.startYear,
    startPhase: draft.startPhase,
    nationality: draft.nationality,
  };

  useEffect(() => {
    window.localStorage.setItem(
      GENERATED_HISTORY_DEPTH_STORAGE_KEY,
      String(draft.historyDepthYears),
    );
  }, [draft.historyDepthYears]);

  useEffect(() => {
    invoke<ManagerProfile[]>("get_manager_profiles")
      .then((entries) => setProfiles(entries ?? []))
      .catch((error) => console.error("Failed to load manager profiles:", error));
  }, []);

  useEffect(() => {
    invoke<GameStateData>("get_active_game")
      .then((state) => {
        applyExtraTranslations(state.extra_translations);
        setGameState(state);
        setGameActive(true, state.manager.display_name);
        return routeForActiveCareer().then(navigate);
      })
      .catch(() => {
        // No active career: the title screen remains the front door.
      });
  }, [setGameState, setGameActive, navigate]);

  useEffect(() => {
    const unlisten = listen("game-state-changed", async () => {
      try {
        const state = await invoke<GameStateData>("get_active_game");
        applyExtraTranslations(state.extra_translations);
        setGameState(state);
        setGameActive(true, state.manager.display_name);
        navigate(await routeForActiveCareer());
      } catch {
        // The event can arrive before a career is active.
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setGameState, setGameActive, navigate]);

  const patchDraft = (patch: Partial<CareerSetupDraft>) =>
    setDraft((previous) => ({ ...previous, ...patch }));

  const goToStep = (step: CareerSetupStep) => {
    setDraft((previous) => ({
      ...previous,
      step,
      furthestStep:
        beatIndex(step) > beatIndex(previous.furthestStep) ? step : previous.furthestStep,
    }));
  };

  const updateFormField = (field: keyof CreateManagerFormData, value: string) => {
    patchDraft({ [field]: value } as Partial<CareerSetupDraft>);
  };

  const clearFormError = (field: keyof CreateManagerFormData) => {
    setFormErrors((previous) => ({ ...previous, [field]: "" }));
  };

  const validateForm = () => {
    const errors: Partial<Record<keyof CreateManagerFormData, string>> = {};
    if (!formData.firstName.trim())
      errors.firstName = t("validation.required", { field: t("createManager.firstName") });
    else if (formData.firstName.length > 30)
      errors.firstName = t("validation.maxLength", {
        field: t("createManager.firstName"),
        max: 30,
      });
    if (!formData.lastName.trim())
      errors.lastName = t("validation.required", { field: t("createManager.lastName") });
    else if (formData.lastName.length > 30)
      errors.lastName = t("validation.maxLength", { field: t("createManager.lastName"), max: 30 });
    if (!formData.startYear.trim())
      errors.startYear = t("validation.required", { field: t("createManager.startYear") });
    else {
      const startYear = parseCareerStartYear(formData.startYear);
      if (startYear === null || startYear < MIN_CAREER_START_YEAR)
        errors.startYear = t("validation.minStartYear", { min: MIN_CAREER_START_YEAR });
    }
    if (!isCareerStartPhase(formData.startPhase))
      errors.startPhase = t("validation.required", { field: t("createManager.startPhase") });
    if (!formData.nationality)
      errors.nationality = t("validation.required", { field: t("createManager.countryOfOrigin") });
    const meaningfulErrors = Object.fromEntries(
      Object.entries(errors).filter(([, value]) => Boolean(value)),
    );
    setFormErrors(meaningfulErrors);
    return { ok: Object.keys(meaningfulErrors).length === 0, errors: meaningfulErrors };
  };

  const loadInstalledPackages = async () => {
    try {
      const pkgs = (await invoke<PackageInfo[]>("list_installed_packages")) ?? [];
      setInstalledPackages(pkgs);
      if (!preselectedPackageRef.current) {
        preselectedPackageRef.current = true;
        const defaults = defaultActivePackageIds(pkgs);
        if (defaults.length > 0) patchDraft({ packageIds: defaults });
      }
    } catch (err) {
      console.error("Failed to list packages:", err);
    }
  };

  useEffect(() => {
    if (screen === "setup" && draft.step === "world") void loadInstalledPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, draft.step]);

  const autoSaveProfile = async (forceNew = false) => {
    try {
      const saved = await invoke<ManagerProfile>("save_manager_profile", {
        firstName: formData.firstName,
        lastName: formData.lastName,
        nationality: formData.nationality,
        force: forceNew || undefined,
      });
      setProfiles((prev) => {
        const exists = prev.some((profile) => profile.id === saved.id);
        const next =
          !forceNew && exists
            ? prev.map((profile) => (profile.id === saved.id ? saved : profile))
            : [...prev, saved];
        return next.sort((a, b) =>
          (b.last_used_at ?? b.created_at).localeCompare(a.last_used_at ?? a.created_at),
        );
      });
      setLoadedProfile(saved);
    } catch (err) {
      console.error("Failed to auto-save manager profile:", err);
    }
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
        setProfiles((prev) =>
          prev.map((profile) => (profile.id === updated.id ? updated : profile)),
        );
        setLoadedProfile(updated);
      }
    } catch (error) {
      console.error("Failed to update manager profile:", error);
    }
    setShowProfileConfirm(false);
    proceedAfterIdentity();
  };

  const handleStartGame = async () => {
    const startupOptions = buildStartupOptions(draft);
    if (!startupOptions) {
      const validation = validateForm();
      if (!validation.ok) {
        const seasonError = validation.errors.startYear || validation.errors.startPhase;
        goToStep(seasonError ? "season" : "identity");
        deferFocusToNextPaint(() => focusFirstCreateManagerError(validation.errors));
        return;
      }
      await showError(t("errors.title"), t("menu.startupOptionsRejected"));
      return;
    }
    setIsStarting(true);
    try {
      const game = await invoke<GameStateData>("start_new_game", {
        firstName: formData.firstName,
        lastName: formData.lastName,
        nationality: formData.nationality,
        startupOptions,
        packageIds: draft.packageIds.length > 0 ? draft.packageIds : undefined,
      });
      applyExtraTranslations(game.extra_translations);
      setGameState(game);
      navigate("/select-team", { state: { careerSetup: presentationOf(draft) } });
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

  const proceedAfterIdentity = () => {
    const next = nextSetupStep(draft);
    if (next === "club") void handleStartGame();
    else if (next) goToStep(next);
  };

  const finishIdentity = () => {
    void autoSaveProfile();
    proceedAfterIdentity();
  };

  const validateSeasonFields = () => {
    const errors: Partial<Record<keyof CreateManagerFormData, string>> = {};
    if (!draft.startYear.trim())
      errors.startYear = t("validation.required", { field: t("createManager.startYear") });
    else {
      const startYear = parseCareerStartYear(draft.startYear);
      if (startYear === null || startYear < MIN_CAREER_START_YEAR)
        errors.startYear = t("validation.minStartYear", { min: MIN_CAREER_START_YEAR });
    }
    if (!isCareerStartPhase(draft.startPhase))
      errors.startPhase = t("validation.required", { field: t("createManager.startPhase") });
    setFormErrors((previous) => ({
      ...previous,
      startYear: errors.startYear ?? "",
      startPhase: errors.startPhase ?? "",
    }));
    return errors;
  };

  const handleIdentitySubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateForm();
    if (!validation.ok) {
      if (validation.errors.startYear || validation.errors.startPhase) goToStep("season");
      deferFocusToNextPaint(() => focusFirstCreateManagerError(validation.errors));
      return;
    }
    if (loadedProfile && formDiffersFromProfile(formData, loadedProfile)) {
      setShowProfileConfirm(true);
      return;
    }
    finishIdentity();
  };

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
      setInstalledPackages((prev) => prev.filter((pkg) => pkg.id !== id));
      patchDraft({ packageIds: draft.packageIds.filter((packageId) => packageId !== id) });
      setPackageStackErrors([]);
    } catch (err) {
      console.error("Failed to uninstall package:", err);
      await showError(t("errors.title"), resolveBackendError(err));
    }
  };

  const handleTogglePackage = (id: string) => {
    patchDraft({
      packageIds: draft.packageIds.includes(id)
        ? draft.packageIds.filter((packageId) => packageId !== id)
        : [...draft.packageIds, id],
    });
    setPackageStackErrors([]);
  };

  const handleOpenLoadMenu = async () => {
    setScreen("load");
    setIsLoadingSaves(true);
    try {
      setSaves(await invoke<SaveEntry[]>("get_saves"));
    } catch (error) {
      console.error("Failed to load saves:", error);
    } finally {
      setIsLoadingSaves(false);
    }
  };

  const handleLoadSave = async (saveId: string) => {
    setLoadingSaveId(saveId);
    try {
      const state = await invoke<GameStateData>("load_game", { saveId });
      applyExtraTranslations(state.extra_translations);
      setGameState(state);
      setGameActive(true, state.manager.display_name);
      navigate(await routeForActiveCareer());
      void prewarmManagerSquadPortraits(state);
    } catch (error) {
      console.error("Failed to load save:", error);
      await showError(
        t("errors.title"),
        t("menu.loadGameFailed", { error: resolveBackendError(error) }),
      );
    } finally {
      setLoadingSaveId(null);
    }
  };

  const handleDeleteSave = async (saveId: string) => {
    try {
      await invoke("delete_save", { saveId });
      setSaves((prev) => prev.filter((save) => save.id !== saveId));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Failed to delete save:", error);
    }
  };

  const handleExit = async () => {
    try {
      await getCurrentWindow().close();
    } catch (error) {
      console.error("Failed to close window:", error);
    }
  };

  const handleSelectProfile = (profile: ManagerProfile) => {
    setLoadedProfile(profile);
    patchDraft({
      firstName: profile.first_name,
      lastName: profile.last_name,
      nationality: profile.nationality,
    });
    setFormErrors({});
    void invoke("touch_manager_profile", { id: profile.id });
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      await invoke("delete_manager_profile", { id });
      setProfiles((prev) => prev.filter((profile) => profile.id !== id));
      if (loadedProfile?.id === id) setLoadedProfile(null);
    } catch (err) {
      console.error("Failed to delete manager profile:", err);
    }
  };

  const handleTitleKeys = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const buttons = titleActionRefs.current.filter((button): button is HTMLButtonElement =>
      Boolean(button && !button.disabled),
    );
    if (buttons.length === 0) return;
    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    buttons[(current + delta + buttons.length) % buttons.length]?.focus();
  };

  const setupTitles: Record<CareerSetupStep, { title: string; subtitle: string }> = {
    world: { title: "packageBuild.title", subtitle: "careerSetup.world.subtitle" },
    season: { title: "careerSetup.season.title", subtitle: "careerSetup.season.subtitle" },
    identity: { title: "careerSetup.identity.title", subtitle: "careerSetup.identity.subtitle" },
    philosophy: {
      title: "careerSetup.philosophy.title",
      subtitle: "careerSetup.philosophy.subtitle",
    },
    club: { title: "teamSelect.title", subtitle: "teamSelect.subtitle" },
    board: { title: "arrival.board.title", subtitle: "arrival.board.subtitle" },
    sign: { title: "arrival.sign.title", subtitle: "arrival.sign.subtitle" },
    welcome: { title: "arrival.welcome.title", subtitle: "arrival.welcome.subtitleShort" },
  };

  const primaryAction = (() => {
    if (draft.step === "season") {
      return (
        <Button
          variant="primary"
          size="lg"
          iconRight={<ChevronRight />}
          onClick={() => {
            const errors = validateSeasonFields();
            if (errors.startYear || errors.startPhase) {
              deferFocusToNextPaint(() => focusFirstCreateManagerError(errors));
              return;
            }
            goToStep("identity");
          }}
        >
          {t("careerSetup.continue")}
        </Button>
      );
    }
    if (draft.step === "identity") {
      return (
        <Button
          type="submit"
          form="career-identity-form"
          variant="primary"
          size="lg"
          iconRight={<ChevronRight />}
        >
          {t("careerSetup.continue")}
        </Button>
      );
    }
    if (draft.step === "philosophy") {
      return (
        <Button
          variant="primary"
          size="lg"
          disabled={isStarting}
          iconRight={<ChevronRight />}
          onClick={() => void handleStartGame()}
        >
          {isStarting ? t("menu.startingGame") : t("careerSetup.findClub")}
        </Button>
      );
    }
    return null;
  })();

  return (
    <div className="h-dvh overflow-hidden bg-page text-fg">
      {screen === "title" ? (
        <div className="relative flex h-full flex-col overflow-hidden">
          <img
            src="/assets/onboarding/stadium-night.jpg"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-page via-page/85 to-transparent" />
          <main
            aria-label={t("menu.title")}
            className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-8 py-10 sm:px-16"
          >
            <img
              src="/openfootlogo.svg"
              alt={t("app.name")}
              className="h-20 w-96 max-w-full object-contain object-left sm:h-28 sm:w-[30rem]"
            />
            <p className="mt-3 max-w-md font-heading text-lead font-bold uppercase tracking-label text-fg-muted">
              {t("menu.tagline")}
            </p>
            <nav
              aria-label={t("menu.title")}
              onKeyDown={handleTitleKeys}
              className="mt-10 flex w-full max-w-sm flex-col gap-2"
            >
              {[
                {
                  label: t("menu.newGame"),
                  icon: <PlusCircle />,
                  onClick: () => {
                    setDraft((previous) => ({ ...previous, step: "world", furthestStep: "world" }));
                    setScreen("setup");
                  },
                  primary: true,
                },
                {
                  label: t("menu.loadGame"),
                  icon: <FolderOpen />,
                  onClick: () => void handleOpenLoadMenu(),
                },
                {
                  label: t("menu.settings"),
                  icon: <Settings />,
                  onClick: () => navigate("/settings"),
                },
                {
                  label: t("diagnostics.reportBug"),
                  icon: <Bug />,
                  onClick: () => setReportingBug(true),
                },
              ].map((action, index) => (
                <button
                  key={action.label}
                  ref={(node) => {
                    titleActionRefs.current[index] = node;
                  }}
                  type="button"
                  onClick={action.onClick}
                  className={`group flex min-h-14 items-center justify-between gap-4 rounded-control border-l-4 px-5 py-3 text-left font-heading text-title font-bold uppercase tracking-label transition-colors duration-150 motion-reduce:transition-none ${FOCUS_RING} ${action.primary ? "border-selected bg-selected-fill text-on-brand hover:bg-selected-hover" : "border-line bg-panel/80 text-fg hover:border-selected hover:bg-hover"}`}
                >
                  <span className="flex items-center gap-3">
                    {action.icon}
                    {action.label}
                  </span>
                  <ChevronRight
                    className="h-5 w-5 opacity-60 transition-transform group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </nav>
          </main>
          <footer className="relative z-10 flex items-center justify-between gap-4 border-t border-line bg-chrome/90 px-6 py-3">
            <p className="text-caption text-fg-subtle">{formatAppVersion()}</p>
            <div className="flex items-center gap-3">
              <span className="hidden text-caption text-fg-subtle sm:inline">
                {t("menu.keyboardHint")}
              </span>
              <Button variant="ghost" size="sm" icon={<Power />} onClick={() => void handleExit()}>
                {t("menu.quit")}
              </Button>
            </div>
          </footer>
        </div>
      ) : null}

      {screen === "setup" ? (
        <CareerSetupLayout
          step={draft.step}
          furthestStep={draft.furthestStep}
          titleKey={setupTitles[draft.step].title}
          subtitleKey={setupTitles[draft.step].subtitle}
          busy={isStarting}
          onBack={() => {
            const previous = previousSetupStep(draft);
            if (previous) goToStep(previous);
            else setScreen("title");
          }}
          onExit={() => setScreen("title")}
          onSelectStep={goToStep}
          primaryAction={primaryAction}
          summary={<CareerPassport draft={draft} />}
        >
          {draft.step === "world" ? (
            <Suspense fallback={<MenuPanelFallback />}>
              <PackageBuildStep
                embedded
                installedPackages={installedPackages}
                activePackageIds={draft.packageIds}
                isInstallingPackage={isInstallingPackage}
                packageStackErrors={packageStackErrors}
                onTogglePackage={handleTogglePackage}
                onInstallPackage={handleInstallPackage}
                onUninstallPackage={handleUninstallPackage}
                onNext={() => goToStep("season")}
                onBack={() => setScreen("title")}
                onClose={() => setScreen("title")}
              />
            </Suspense>
          ) : null}
          {draft.step === "season" ? (
            <SeasonStep
              draft={draft}
              hasDatabase={installedPackages.some(
                (pkg) => draft.packageIds.includes(pkg.id) && pkg.packageType === "database",
              )}
              errors={formErrors}
              onChange={patchDraft}
            />
          ) : null}
          {draft.step === "identity" ? (
            <Suspense fallback={<MenuPanelFallback />}>
              <CreateManagerForm
                embedded
                formId="career-identity-form"
                hideSubmit
                showSeasonFields={false}
                formData={formData}
                formErrors={formErrors}
                profiles={profiles}
                selectedProfileId={loadedProfile?.id}
                background={draft.background}
                onBackgroundChange={(background) => patchDraft({ background })}
                onChange={updateFormField}
                onClearError={clearFormError}
                onClose={() => setScreen("title")}
                onSelectProfile={handleSelectProfile}
                onDeleteProfile={handleDeleteProfile}
                onSubmit={handleIdentitySubmit}
              />
            </Suspense>
          ) : null}
          {draft.step === "philosophy" ? (
            <PhilosophyStep
              value={draft.philosophy}
              onChange={(philosophy) => patchDraft({ philosophy })}
            />
          ) : null}
        </CareerSetupLayout>
      ) : null}

      {screen === "load" ? (
        <div className="relative flex h-full flex-col overflow-hidden">
          <img
            src="/assets/onboarding/stadium-night.jpg"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
          />
          <header className="relative z-10 flex items-center gap-3 border-b border-line bg-chrome/90 px-6 py-4">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft />}
              onClick={() => setScreen("title")}
            >
              {t("common.back")}
            </Button>
            <img
              src="/openfootlogo.svg"
              alt={t("app.name")}
              className="h-8 w-40 object-contain object-left"
            />
          </header>
          <main
            aria-label={t("menu.loadGame")}
            className="scrollbar-thin relative z-10 min-h-0 flex-1 overflow-y-auto px-6 py-8"
          >
            <div className="mx-auto w-full max-w-3xl rounded-panel border border-line bg-panel/95 p-6">
              <Suspense fallback={<MenuPanelFallback />}>
                <SavesList
                  saves={saves}
                  isLoading={isLoadingSaves}
                  loadingSaveId={loadingSaveId}
                  confirmDeleteId={confirmDeleteId}
                  onLoad={handleLoadSave}
                  onDelete={handleDeleteSave}
                  onConfirmDelete={setConfirmDeleteId}
                  onClose={() => setScreen("title")}
                />
              </Suspense>
            </div>
          </main>
        </div>
      ) : null}

      {isStarting ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 grid place-items-center bg-overlay p-4"
        >
          <div className="flex flex-col items-center gap-4 rounded-panel border border-line bg-panel p-8">
            <Loader2 className="h-10 w-10 animate-spin text-selected" aria-hidden="true" />
            <p className="font-heading text-title font-bold uppercase tracking-label text-fg">
              {t("menu.startingGame")}
            </p>
            <p className="max-w-sm text-center text-body text-fg-muted">
              {t("careerSetup.generatingNote")}
            </p>
          </div>
        </div>
      ) : null}

      {showProfileConfirm && loadedProfile ? (
        <Suspense fallback={<MenuPanelFallback />}>
          <ProfileSaveConfirm
            loadedProfile={loadedProfile}
            onUpdate={() => void handleUpdateProfile()}
            onSaveNew={() => {
              setShowProfileConfirm(false);
              void autoSaveProfile(true);
              proceedAfterIdentity();
            }}
            onSkip={() => {
              setShowProfileConfirm(false);
              proceedAfterIdentity();
            }}
            onClose={() => setShowProfileConfirm(false)}
          />
        </Suspense>
      ) : null}
      {reportingBug ? <ReportBugModal onClose={() => setReportingBug(false)} /> : null}
      <CrashReportPrompt onReport={() => setReportingBug(true)} />
    </div>
  );
}

function formDiffersFromProfile(formData: CreateManagerFormData, profile: ManagerProfile): boolean {
  return (
    formData.firstName !== profile.first_name ||
    formData.lastName !== profile.last_name ||
    formData.nationality !== profile.nationality
  );
}
