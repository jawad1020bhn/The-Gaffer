import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Info, XCircle, Globe, ImagePlus, X } from "lucide-react";
import { InlineHelp, LabeledInput, LabeledSelect, labelClass, inputClass } from "./primitives";
import { useAssetPicker } from "./useAssetPicker";
import { COMPETITION_SCOPES, PACKAGE_TYPES, mergeFallbackLeague } from "./helpers";
import type { CompetitionScope, FallbackLeagueConfig, WorldMetaDef } from "./types";

// Sentinel for "leave it to the engine" in the optional fallback-league selects.
const ENGINE_DEFAULT = "";

const SPDX_LICENSES = [
  { id: "CC0-1.0", name: "CC0 1.0 Public Domain" },
  { id: "CC-BY-4.0", name: "CC BY 4.0" },
  { id: "CC-BY-SA-4.0", name: "CC BY-SA 4.0" },
  { id: "CC-BY-NC-4.0", name: "CC BY-NC 4.0" },
  { id: "MIT", name: "MIT" },
  { id: "Apache-2.0", name: "Apache 2.0" },
  { id: "GPL-2.0-only", name: "GPL 2.0" },
  { id: "__custom__", name: "Custom / Other" },
];

interface LicenseDetails {
  permissions: string[];
  conditions: string[];
  limitations: string[];
}

const LICENSE_DETAILS: Record<string, LicenseDetails> = {
  "CC0-1.0": {
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: [],
    limitations: ["No liability", "No warranty"],
  },
  "CC-BY-4.0": {
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: ["Attribution"],
    limitations: ["No liability"],
  },
  "CC-BY-SA-4.0": {
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: ["Attribution", "Share-alike"],
    limitations: ["No liability"],
  },
  "CC-BY-NC-4.0": {
    permissions: ["Modification", "Distribution", "Private use"],
    conditions: ["Attribution", "Non-commercial only"],
    limitations: ["Commercial use", "No liability"],
  },
  MIT: {
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: ["Attribution"],
    limitations: ["No liability", "No warranty"],
  },
  "Apache-2.0": {
    permissions: ["Commercial use", "Modification", "Distribution", "Private use", "Patent use"],
    conditions: ["Attribution", "State changes"],
    limitations: ["No trademark use", "No liability", "No warranty"],
  },
  "GPL-2.0-only": {
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: ["Disclose source", "Same license", "Attribution"],
    limitations: ["No liability", "No warranty"],
  },
};

interface EntityCounts {
  teams: number;
  players: number;
  confederations: number;
  countries: number;
  competitions: number;
  namePools: number;
}

interface MetadataFormProps {
  meta: WorldMetaDef;
  onChange: (m: WorldMetaDef) => void;
  /**
   * Like `onChange`, but also persists. Used for the logo, whose image is
   * copied into the package before the path is set — leaving that path pending
   * a Save press is what makes a picked logo look like it vanished.
   */
  onCommit?: (m: WorldMetaDef) => void;
  onAssetError: (err: unknown) => void;
  counts?: EntityCounts;
  projectDir?: string;
}

export function MetadataForm({
  meta,
  onChange,
  onCommit,
  onAssetError,
  counts,
  projectDir,
}: MetadataFormProps) {
  const { t } = useTranslation();
  const set = (patch: Partial<WorldMetaDef>) => onChange({ ...meta, ...patch });
  // The logo commit fires after an async copy, and this form applies its other
  // field edits by replacing the whole `meta`. Read the latest `meta` from a ref
  // at commit time so an edit made while the copy was in flight isn't clobbered
  // by a stale render snapshot.
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const {
    dataUrl: logoDataUrl,
    pick: pickLogo,
    clear: clearLogo,
  } = useAssetPicker({
    relPath: meta.logo,
    projectDir,
    entityId: () => metaRef.current.id || "package-logo",
    commit: (relPath) => (onCommit ?? onChange)({ ...metaRef.current, logo: relPath }),
    onError: onAssetError,
  });

  const isKnownLicense = SPDX_LICENSES.some((l) => l.id !== "__custom__" && l.id === meta.license);
  const [useCustom, setUseCustom] = useState(!isKnownLicense && meta.license !== "");

  const packageTypeLabels: Record<string, string> = {
    database: t("worldEditor.typeDatabase"),
    patch: t("worldEditor.typePatch"),
    assets: t("worldEditor.typeAssets"),
  };

  function handleLicenseSelect(val: string) {
    if (val === "__custom__") {
      setUseCustom(true);
    } else {
      setUseCustom(false);
      set({ license: val });
    }
  }

  const selectedLicenseKey = useCustom
    ? "__custom__"
    : (SPDX_LICENSES.find((l) => l.id === meta.license)?.id ?? "__custom__");

  const licenseDetails = LICENSE_DETAILS[meta.license];

  // The engine synthesises a single-division league when a package ships teams
  // but no competitions; these fields override its name/legs/scope. Any field
  // left blank falls back to the engine default, and clearing them all drops the
  // config entirely rather than writing an empty object into the manifest.
  const fallbackLeague = meta.fallbackLeague ?? {};
  const setFallbackLeague = (patch: Partial<FallbackLeagueConfig>) =>
    set({ fallbackLeague: mergeFallbackLeague(meta.fallbackLeague, patch) });

  // Mirrors `build_world_data_from_package`: any package with teams and no
  // competitions gets the fallback. A single-team package qualifies too — the
  // thin-package fill tops it up with procedural opponents first.
  const fallbackLeagueInUse = !!counts && counts.teams >= 1 && counts.competitions === 0;

  const fallbackScopeLabels: Record<string, string> = {
    [ENGINE_DEFAULT]: t("worldEditor.fallbackLeagueDefault"),
    Domestic: t("teamSelect.scopes.Domestic"),
    Regional: t("teamSelect.scopes.Regional"),
    Continental: t("teamSelect.scopes.Continental"),
    International: t("teamSelect.scopes.International"),
  };

  const fallbackLegsLabels: Record<string, string> = {
    [ENGINE_DEFAULT]: t("worldEditor.fallbackLeagueDefault"),
    "1": t("worldEditor.legsSingle"),
    "2": t("worldEditor.legsDouble"),
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* Left: form fields */}
      <div className="flex flex-col gap-3">
        <LabeledInput
          label={t("worldEditor.packageId")}
          value={meta.id}
          onChange={(v) => set({ id: v })}
          placeholder="my-world"
          help={t("worldEditor.help.packageId")}
        />
        <LabeledInput
          label={t("worldEditor.packageName")}
          value={meta.name}
          onChange={(v) => set({ name: v })}
        />
        <LabeledInput
          label={t("worldEditor.description")}
          value={meta.description}
          onChange={(v) => set({ description: v })}
          multiline
          rows={3}
        />
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput
            label={t("worldEditor.version")}
            value={meta.version}
            onChange={(v) => set({ version: v })}
            placeholder="1.0.0"
          />
          <LabeledInput
            label={t("worldEditor.baseYear")}
            value={meta.baseYear?.toString() ?? ""}
            type="number"
            onChange={(v) => set({ baseYear: v === "" ? null : parseInt(v, 10) })}
            placeholder="2026"
          />
        </div>
        <LabeledInput
          label={t("worldEditor.author")}
          value={meta.author}
          onChange={(v) => set({ author: v })}
        />

        {projectDir && (
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t("worldEditor.packageLogo")}</label>
            <div className="flex items-center gap-3">
              {logoDataUrl ? (
                <img
                  src={logoDataUrl}
                  alt=""
                  className="w-12 h-12 rounded-control object-contain border border-line bg-panel flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-control border border-dashed border-line-strong bg-sunken flex items-center justify-center flex-shrink-0">
                  <ImagePlus className="w-5 h-5 text-fg-subtle" />
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void pickLogo();
                  }}
                  className="px-3 py-1.5 text-caption font-heading font-bold uppercase tracking-label rounded-control border border-line bg-panel text-fg hover:bg-sunken transition"
                >
                  {t("worldEditor.chooseLogo")}
                </button>
                {meta.logo && (
                  <button
                    type="button"
                    onClick={() => {
                      clearLogo();
                    }}
                    className="px-2 py-1.5 text-caption rounded-control border border-line text-fg-subtle hover:text-danger transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* License picker */}
        <div className="flex flex-col gap-1">
          <label className={labelClass}>{t("worldEditor.license")}</label>
          <LabeledSelect
            label=""
            value={selectedLicenseKey}
            options={SPDX_LICENSES.map((l) => l.id)}
            optionLabels={Object.fromEntries(SPDX_LICENSES.map((l) => [l.id, l.name]))}
            onChange={handleLicenseSelect}
          />
          {useCustom && (
            <input
              type="text"
              value={meta.license}
              onChange={(e) => set({ license: e.target.value })}
              placeholder="e.g. Proprietary"
              className={inputClass}
            />
          )}
        </div>

        <LabeledSelect
          label={t("worldEditor.packageType")}
          value={meta.packageType}
          options={PACKAGE_TYPES}
          optionLabels={packageTypeLabels}
          onChange={(v) => set({ packageType: v })}
          help={t("worldEditor.help.packageType")}
        />
        <LabeledInput
          label={t("worldEditor.gameMinVersion")}
          value={meta.gameMinVersion}
          onChange={(v) => set({ gameMinVersion: v })}
          placeholder="0.3.0"
        />

        <div className="mt-2 flex flex-col gap-3 rounded-panel border border-line p-3">
          <div className="flex items-center gap-1.5">
            <p className={labelClass}>{t("worldEditor.fallbackLeague")}</p>
            <InlineHelp text={t("worldEditor.help.fallbackLeague")} />
          </div>
          {fallbackLeagueInUse && (
            <p className="text-caption text-fg-muted">{t("worldEditor.fallbackLeagueInUse")}</p>
          )}
          <LabeledInput
            label={t("worldEditor.competitionName")}
            value={fallbackLeague.name ?? ""}
            onChange={(v) => setFallbackLeague({ name: v || null })}
            placeholder={t("worldEditor.fallbackLeagueDefault")}
          />
          <LabeledSelect
            label={t("worldEditor.fallbackLeagueLegs")}
            value={fallbackLeague.legs ? String(fallbackLeague.legs) : ENGINE_DEFAULT}
            options={[ENGINE_DEFAULT, "1", "2"]}
            optionLabels={fallbackLegsLabels}
            onChange={(v) => setFallbackLeague({ legs: v === ENGINE_DEFAULT ? null : Number(v) })}
          />
          <LabeledSelect
            label={t("worldEditor.competitionScope")}
            value={fallbackLeague.scope ?? ENGINE_DEFAULT}
            options={[ENGINE_DEFAULT, ...COMPETITION_SCOPES]}
            optionLabels={fallbackScopeLabels}
            onChange={(v) =>
              setFallbackLeague({
                scope: v === ENGINE_DEFAULT ? null : (v as CompetitionScope),
              })
            }
          />
        </div>
      </div>

      {/* Right: preview card + license card */}
      <div className="flex flex-col gap-4">
        {/* Package preview card */}
        <div className="flex flex-col gap-1.5">
          <p className={labelClass}>{t("worldEditor.licensePreview")}</p>
          <div className="rounded-panel border border-line bg-panel p-4 flex items-start gap-3">
            {logoDataUrl ? (
              <img
                src={logoDataUrl}
                alt=""
                className="w-9 h-9 rounded-control object-contain border border-line bg-panel flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-control bg-gradient-to-br from-selected-fill to-selected-fill flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-on-brand" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-heading font-bold text-body uppercase tracking-label text-fg truncate">
                  {meta.name || meta.id || "—"}
                </p>
                {meta.packageType && meta.packageType !== "database" && (
                  <span className="text-caption font-heading uppercase tracking-label px-1.5 py-0.5 rounded bg-warning-tint/40 text-warning flex-shrink-0">
                    {packageTypeLabels[meta.packageType] ?? meta.packageType}
                  </span>
                )}
              </div>
              <p className="text-caption text-fg-subtle mt-0.5">
                {meta.author && `${meta.author}`}
                {meta.author && meta.version && " · "}
                {meta.version && `v${meta.version}`}
                {(meta.author || meta.version) && meta.license && " · "}
                {meta.license && meta.license}
              </p>
              {meta.description && (
                <p className="text-caption text-fg-muted mt-1 line-clamp-2">{meta.description}</p>
              )}
              {counts && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(
                    [
                      { n: counts.teams, key: "sectionTeams" },
                      { n: counts.players, key: "sectionPlayers" },
                      { n: counts.confederations, key: "sectionConfederations" },
                      { n: counts.countries, key: "sectionCountries" },
                      { n: counts.competitions, key: "sectionCompetitions" },
                      { n: counts.namePools, key: "sectionNames" },
                    ] as const
                  )
                    .filter(({ n }) => n > 0)
                    .map(({ n, key }) => (
                      <span
                        key={key}
                        className="text-caption px-1.5 py-0.5 rounded bg-hover text-fg-muted"
                      >
                        {n} {t(`worldEditor.${key}`)}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* License permissions card */}
        {licenseDetails && !useCustom && (
          <div className="flex flex-col gap-2 rounded-panel border border-line bg-panel p-4">
            <p className="text-caption font-heading font-bold uppercase tracking-[0.15em] text-fg-subtle">
              {SPDX_LICENSES.find((l) => l.id === meta.license)?.name}
            </p>

            {licenseDetails.permissions.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-caption font-heading font-bold uppercase tracking-[0.12em] text-positive">
                  {t("worldEditor.licensePermissions")}
                </p>
                {licenseDetails.permissions.map((p) => (
                  <div key={p} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-positive flex-shrink-0" />
                    <span className="text-caption text-fg">{p}</span>
                  </div>
                ))}
              </div>
            )}

            {licenseDetails.conditions.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-caption font-heading font-bold uppercase tracking-[0.12em] text-warning">
                  {t("worldEditor.licenseConditions")}
                </p>
                {licenseDetails.conditions.map((c) => (
                  <div key={c} className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                    <span className="text-caption text-fg">{c}</span>
                  </div>
                ))}
              </div>
            )}

            {licenseDetails.limitations.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-caption font-heading font-bold uppercase tracking-[0.12em] text-danger">
                  {t("worldEditor.licenseLimitations")}
                </p>
                {licenseDetails.limitations.map((l) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-danger flex-shrink-0" />
                    <span className="text-caption text-fg">{l}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
