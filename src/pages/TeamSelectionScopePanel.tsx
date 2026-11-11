import { useTranslation } from "react-i18next";

import type { LeagueData, WorldRegionData } from "../store/gameStore";
import { countryName } from "../lib/countries";
import { competitionDisplayName } from "../lib/competitionName";
import { buildRegionLabel } from "../lib/teamRegions";
import { Badge, Card, CardBody, Checkbox, CompetitionLogo, Select } from "../components/ui";
import { ChevronRight, Globe, Trophy } from "lucide-react";
import {
  competitionKindLabel,
  competitionRequiredRegions,
  competitionScopeLabel,
} from "./TeamSelection.helpers";

interface TeamSelectionScopePanelProps {
  scopeExpanded: boolean;
  onToggleScopeExpanded: () => void;
  regions: WorldRegionData[];
  selectedHomeRegionId: string | null;
  onSelectHomeRegion: (regionId: string | null) => void;
  selectedCountryCode: string | null;
  onSelectCountry: (countryCode: string | null) => void;
  regionCountries: string[];
  regionSelection: Record<string, boolean>;
  onRegionToggle: (regionId: string) => void;
  availableCompetitions: LeagueData[];
  competitionSelection: Record<string, boolean>;
  mandatoryCompetitionIds: Set<string>;
  activeRegionIds: string[];
  onCompetitionToggle: (competition: LeagueData) => void;
}

export default function TeamSelectionScopePanel({
  scopeExpanded,
  onToggleScopeExpanded,
  regions,
  selectedHomeRegionId,
  onSelectHomeRegion,
  selectedCountryCode,
  onSelectCountry,
  regionCountries,
  regionSelection,
  onRegionToggle,
  availableCompetitions,
  competitionSelection,
  mandatoryCompetitionIds,
  activeRegionIds,
  onCompetitionToggle,
}: TeamSelectionScopePanelProps) {
  const { t, i18n } = useTranslation();
  const compName = (c: LeagueData) => competitionDisplayName(c, t);

  return (
    <Card>
      <button
        type="button"
        onClick={onToggleScopeExpanded}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span className="font-heading text-body font-bold uppercase tracking-label text-fg">
          {t("teamSelect.simulationScope")}
        </span>
        <span className="flex items-center gap-2">
          {!scopeExpanded && (
            <span className="text-caption text-fg-muted">
              {[
                selectedHomeRegionId ? buildRegionLabel(t, selectedHomeRegionId) : null,
                selectedCountryCode
                  ? countryName(selectedCountryCode, i18n.language)
                  : t("teamSelect.allCountries"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
          <ChevronRight
            className={`h-4 w-4 text-fg-subtle transition-transform ${
              scopeExpanded ? "rotate-90" : ""
            }`}
          />
        </span>
      </button>
      {scopeExpanded && (
        <CardBody className="grid gap-4 lg:grid-cols-4">
          <div>
            <p className="mb-2 text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
              {t("teamSelect.homeRegion")}
            </p>
            <Select
              value={selectedHomeRegionId ?? ""}
              onChange={(e) => {
                onSelectHomeRegion(e.target.value || null);
              }}
              fullWidth
              aria-label={t("teamSelect.homeRegion")}
            >
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {buildRegionLabel(t, region.id, region.name)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <p className="mb-2 text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
              {t("teamSelect.homeCountry")}
            </p>
            <Select
              value={selectedCountryCode ?? ""}
              onChange={(event) => onSelectCountry(event.target.value || null)}
              fullWidth
              aria-label={t("teamSelect.homeCountry")}
            >
              <option value="">{t("teamSelect.allCountries")}</option>
              {regionCountries.map((countryCode) => (
                <option key={countryCode} value={countryCode}>
                  {countryName(countryCode, i18n.language)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <p className="mb-2 text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
              {t("teamSelect.simulatedRegions")}
            </p>
            <div className="space-y-2">
              {regions.map((region) => {
                const enabled =
                  region.id === selectedHomeRegionId || Boolean(regionSelection[region.id]);
                const isLocked = region.id === selectedHomeRegionId;
                return (
                  <div
                    key={region.id}
                    role="button"
                    aria-pressed={enabled}
                    aria-disabled={isLocked}
                    tabIndex={isLocked ? -1 : 0}
                    onClick={() => !isLocked && onRegionToggle(region.id)}
                    onKeyDown={(e) => {
                      if (!isLocked && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onRegionToggle(region.id);
                      }
                    }}
                    className={`flex items-center justify-between rounded-control border border-line bg-sunken px-3 py-2 text-body ${!isLocked ? "cursor-pointer" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-selected" />
                      <span>{buildRegionLabel(t, region.id, region.name)}</span>
                      {isLocked && (
                        <Badge variant="primary" size="sm">
                          {t("teamSelect.homeBadge")}
                        </Badge>
                      )}
                    </span>
                    <span
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={enabled}
                        disabled={isLocked}
                        onChange={() => onRegionToggle(region.id)}
                        aria-label={buildRegionLabel(t, region.id, region.name)}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
              {t("teamSelect.simulatedCompetitions")}
            </p>
            <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {availableCompetitions.map((competition) => {
                const enabled =
                  Boolean(competitionSelection[competition.id]) ||
                  mandatoryCompetitionIds.has(competition.id);
                const isLocked = mandatoryCompetitionIds.has(competition.id);
                const requiredRegions = competitionRequiredRegions(competition);
                const missingRegions = requiredRegions.filter(
                  (regionId) => !activeRegionIds.includes(regionId),
                );

                return (
                  <div
                    key={competition.id}
                    role="button"
                    aria-pressed={enabled}
                    aria-disabled={isLocked}
                    tabIndex={isLocked ? -1 : 0}
                    onClick={() => !isLocked && onCompetitionToggle(competition)}
                    onKeyDown={(e) => {
                      if (!isLocked && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onCompetitionToggle(competition);
                      }
                    }}
                    className={`block rounded-control border border-line bg-sunken px-3 py-2 text-body ${!isLocked ? "cursor-pointer" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <CompetitionLogo
                          logo={competition.logo}
                          className="h-6 w-6"
                          fallback={<Trophy className="h-4 w-4 shrink-0 text-warning" />}
                        />
                        <span className="truncate">{compName(competition)}</span>
                      </span>
                      <span
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={enabled}
                          disabled={isLocked}
                          onChange={() => onCompetitionToggle(competition)}
                          aria-label={compName(competition)}
                        />
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {competitionScopeLabel(t, competition.scope) && (
                        <Badge variant="neutral" size="sm">
                          {competitionScopeLabel(t, competition.scope)}
                        </Badge>
                      )}
                      {competition.kind &&
                        competition.kind !== "League" &&
                        competitionKindLabel(t, competition.kind) && (
                          <Badge variant="accent" size="sm">
                            {competitionKindLabel(t, competition.kind)}
                          </Badge>
                        )}
                      {isLocked && (
                        <Badge variant="primary" size="sm">
                          {t("teamSelect.yourClubBadge")}
                        </Badge>
                      )}
                    </div>
                    {missingRegions.length > 0 && (
                      <p className="mt-2 text-caption text-warning">
                        {t("teamSelect.requiresRegions", {
                          regions: missingRegions
                            .map((regionId) => buildRegionLabel(t, regionId))
                            .join(", "),
                        })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardBody>
      )}
    </Card>
  );
}
