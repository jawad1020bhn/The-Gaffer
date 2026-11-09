import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  ArrowLeft,
  ChevronRight,
  Package,
  PackagePlus,
  Trash2,
  Globe,
  Users,
  Trophy,
  Type,
  Flag,
  Layers,
  Shuffle,
  AlertTriangle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "../ui";
import type { PackageInfo, PackageIssue, StackConflictInfo } from "./packageTypes";

interface PackageBuildStepProps {
  installedPackages: PackageInfo[];
  activePackageIds: string[];
  isInstallingPackage: boolean;
  packageStackErrors?: PackageIssue[];
  onTogglePackage: (id: string) => void;
  onInstallPackage: () => void;
  onUninstallPackage: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  /** When hosted by the career setup frame, the frame owns the title, back and exit controls. */
  embedded?: boolean;
}

function StepIndicator({ current }: { current: 2 | 3 }) {
  const active =
    "flex items-center justify-center w-6 h-6 rounded-full bg-selected-fill text-on-brand text-caption font-bold";
  const done =
    "flex items-center justify-center w-6 h-6 rounded-full bg-selected-tint text-selected text-caption font-bold";
  const future =
    "flex items-center justify-center w-6 h-6 rounded-full bg-hover text-fg-subtle text-caption font-bold";
  const filledLine = "h-0.5 flex-1 bg-selected-fill";
  const emptyLine = "h-0.5 flex-1 bg-hover";

  return (
    <div className="flex items-center gap-2 mb-1">
      <div className={done}>1</div>
      <div className={filledLine} />
      <div className={current === 2 ? active : done}>2</div>
      <div className={current === 3 ? filledLine : emptyLine} />
      <div className={current === 3 ? active : future}>3</div>
    </div>
  );
}

interface PackageCardProps {
  pkg: PackageInfo;
  isActive: boolean;
  onToggle: () => void;
  onUninstall: () => void;
}

function PackageCard({ pkg, isActive, onToggle, onUninstall }: PackageCardProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-start gap-3 w-full p-3 rounded-panel border transition-all duration-200 text-left ${
        isActive
          ? "bg-warning-solid bg-warning-tint border-warning ring-1 ring-focus"
          : "bg-panel border-line hover:border-line-strong"
      }`}
    >
      {/* Toggle indicator */}
      <span
        className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors pointer-events-none ${
          isActive ? "bg-warning-solid border-warning" : "border-line-strong"
        }`}
        aria-hidden
      >
        {isActive && <span className="w-2 h-2 rounded-sm bg-panel" />}
      </span>

      {/* Logo or icon */}
      {pkg.logoDataUrl ? (
        <img
          src={pkg.logoDataUrl}
          alt=""
          className="w-8 h-8 rounded object-contain flex-shrink-0 mt-0.5 border border-line bg-panel"
        />
      ) : (
        <div className="w-8 h-8 rounded bg-selected-tint flex items-center justify-center flex-shrink-0 mt-0.5">
          <Package className="w-4 h-4 text-selected" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-heading font-bold text-body uppercase tracking-label text-fg truncate">
            {pkg.name || pkg.id}
          </p>
        </div>
        <p className="text-caption text-fg-subtle mt-0.5">
          {pkg.author && t("worldSelect.packageAuthor", { author: pkg.author })}
          {pkg.author && pkg.version && " · "}
          {pkg.version && t("worldSelect.packageVersion", { version: pkg.version })}
          {pkg.license && ` · ${pkg.license}`}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
          <span className="text-caption font-heading uppercase tracking-label text-fg-subtle flex items-center gap-1">
            <Globe className="w-3 h-3" />
            {t("worldSelect.teams", { count: pkg.teamCount })}
          </span>
          <span className="text-caption font-heading uppercase tracking-label text-fg-subtle flex items-center gap-1">
            <Users className="w-3 h-3" />
            {t("worldSelect.players", { count: pkg.playerCount })}
          </span>
          <span className="text-caption font-heading uppercase tracking-label text-fg-subtle flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            {t("worldSelect.competitions", { count: pkg.competitionCount })}
          </span>
          {/* Shown only when the package actually supplies them. A stack is
              usually clubs and competitions, and six badges on every card would
              bury the three that always matter — while a package that ships
              name pools still stops looking identical to one that does not. */}
          {pkg.namePoolCount > 0 && (
            <span className="text-caption font-heading uppercase tracking-label text-fg-subtle flex items-center gap-1">
              <Type className="w-3 h-3" />
              {t("worldSelect.namePools", { count: pkg.namePoolCount })}
            </span>
          )}
          {pkg.countryCount > 0 && (
            <span className="text-caption font-heading uppercase tracking-label text-fg-subtle flex items-center gap-1">
              <Flag className="w-3 h-3" />
              {t("worldSelect.countries", { count: pkg.countryCount })}
            </span>
          )}
          {pkg.confederationCount > 0 && (
            <span className="text-caption font-heading uppercase tracking-label text-fg-subtle flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {t("worldSelect.confederations", { count: pkg.confederationCount })}
            </span>
          )}
        </div>
      </div>

      {/* Uninstall */}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onUninstall();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            onUninstall();
          }
        }}
        className="text-fg-subtle hover:text-danger transition-colors flex-shrink-0 mt-0.5 p-0.5 rounded"
        title={t("worldSelect.removePackage")}
        aria-label={t("worldSelect.removePackage")}
      >
        <Trash2 className="w-4 h-4" />
      </span>
    </button>
  );
}

export default function PackageBuildStep({
  installedPackages,
  activePackageIds,
  isInstallingPackage,
  packageStackErrors,
  onTogglePackage,
  onInstallPackage,
  onUninstallPackage,
  onNext,
  onBack,
  onClose,
  embedded = false,
}: PackageBuildStepProps) {
  const { t } = useTranslation();
  const [stackConflicts, setStackConflicts] = useState<StackConflictInfo[]>([]);

  useEffect(() => {
    if (!activePackageIds || activePackageIds.length < 2) {
      setStackConflicts([]);
      return;
    }
    let cancelled = false;
    invoke<StackConflictInfo[]>("check_package_stack", { packageIds: activePackageIds })
      .then((conflicts) => {
        if (!cancelled) setStackConflicts(conflicts);
      })
      .catch((err) => {
        if (cancelled) return;
        setStackConflicts([
          {
            severity: "error",
            code: typeof err === "string" ? err : "be.error.package.invalid",
            entityKind: "",
            entityId: "",
            packages: [],
          },
        ]);
      });
    return () => {
      cancelled = true;
    };
  }, [activePackageIds]);

  const dbPackages = installedPackages.filter((p) => p.packageType === "database");
  const patchPackages = installedPackages.filter((p) => p.packageType !== "database");
  const activePackages = installedPackages.filter((p) => activePackageIds.includes(p.id));
  const hasActiveDatabase = activePackages.some((p) => p.packageType === "database");
  const hasPatchOnly =
    activePackages.length > 0 && activePackages.every((p) => p.packageType !== "database");

  const hasPackageErrors = (packageStackErrors?.length ?? 0) > 0;
  const stackConflictErrors = stackConflicts.filter((c) => c.severity === "error");
  const stackConflictWarnings = stackConflicts.filter((c) => c.severity === "warning");
  const hasStackErrors = stackConflictErrors.length > 0;
  const canProceed = !hasPatchOnly && !hasPackageErrors && !hasStackErrors;

  // Show patches section when patches exist and at least one database is active,
  // or when patches exist and user may want to combine with random world.
  const showPatches = patchPackages.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      {!embedded && (
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="text-fg-subtle hover:text-fg transition-colors p-1 rounded-control hover:bg-hover"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-heading font-heading font-bold uppercase tracking-label text-fg">
              {t("packageBuild.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-subtle hover:text-fg transition-colors p-1 rounded-control hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {!embedded && <StepIndicator current={2} />}

      {/* Scrollable content */}
      <div
        className={`flex flex-col gap-4 overflow-y-auto pr-1 ${embedded ? "max-h-[58vh]" : "max-h-[52vh]"}`}
      >
        {/* Databases section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-heading font-bold uppercase tracking-[0.18em] text-body text-fg flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              {t("packageBuild.databases")}
            </p>
            <button
              type="button"
              onClick={onInstallPackage}
              disabled={isInstallingPackage}
              className="flex items-center gap-1 text-caption font-heading font-bold uppercase tracking-label text-selected hover:text-selected disabled:opacity-50 transition-colors"
            >
              {isInstallingPackage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <PackagePlus className="w-3.5 h-3.5" />
              )}
              {t("worldSelect.installPackage")}
            </button>
          </div>

          {dbPackages.length === 0 ? (
            <p className="text-caption text-fg-subtle text-center py-2">
              {t("packageBuild.noPackages")}
            </p>
          ) : (
            dbPackages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                isActive={activePackageIds.includes(pkg.id)}
                onToggle={() => onTogglePackage(pkg.id)}
                onUninstall={() => onUninstallPackage(pkg.id)}
              />
            ))
          )}
        </div>

        {/* Patches section */}
        {showPatches && (
          <div className="space-y-2">
            <p className="font-heading font-bold uppercase tracking-[0.18em] text-body text-fg flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              {t("packageBuild.patches")}
            </p>
            {patchPackages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                isActive={activePackageIds.includes(pkg.id)}
                onToggle={() => onTogglePackage(pkg.id)}
                onUninstall={() => onUninstallPackage(pkg.id)}
              />
            ))}
          </div>
        )}

        {/* Random world fallback notice */}
        {!hasActiveDatabase && (
          <div className="flex items-start gap-2.5 rounded-panel border border-line bg-sunken p-3">
            <Shuffle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-caption text-fg-muted">{t("packageBuild.randomFallback")}</p>
          </div>
        )}

        {/* Patch-only error */}
        {hasPatchOnly && (
          <div className="rounded-panel border border-warning/40 bg-warning-tint p-3 text-caption">
            <p className="font-heading font-bold uppercase tracking-label text-warning flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {t("packageBuild.patchOnlyError")}
            </p>
          </div>
        )}

        {/* Stack conflict warnings */}
        {stackConflictWarnings.length > 0 && (
          <div className="rounded-panel border border-warning/40 bg-warning-tint p-3 text-caption">
            <p className="font-heading font-bold uppercase tracking-label text-warning mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {t("worldSelect.stackConflictWarnings", { count: stackConflictWarnings.length })}
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-warning">
              {stackConflictWarnings.map((c, i) => (
                <li key={i}>
                  {t(c.code, {
                    entityKind: c.entityKind,
                    entityId: c.entityId,
                    packages: c.packages.join(", "),
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Stack errors */}
        {(hasPackageErrors || hasStackErrors) && (
          <div className="rounded-panel border border-danger/40 bg-danger-tint p-3 text-caption">
            <p className="font-heading font-bold uppercase tracking-label text-danger mb-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {t("worldSelect.packageStackErrors")}
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-danger">
              {packageStackErrors?.map((issue, i) => (
                <li key={`issue-${i}`}>
                  {issue.file ? `[${issue.file}] ` : ""}
                  {t(issue.code, issue.params)}
                </li>
              ))}
              {stackConflictErrors.map((c, i) => (
                <li key={`conflict-${i}`}>
                  {t(c.code, {
                    entityKind: c.entityKind,
                    entityId: c.entityId,
                    packages: c.packages.join(", "),
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Next */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        iconRight={<ChevronRight />}
        onClick={onNext}
        disabled={!canProceed}
      >
        {t("packageBuild.next")}
      </Button>
    </div>
  );
}
