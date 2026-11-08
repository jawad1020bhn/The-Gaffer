import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { usePositionTable } from "../../hooks/usePositionGroups";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import { Card, Select } from "../ui";

interface TacticsFiltersProps {
  onClear: () => void;
  onPlayerSearchChange: (value: string) => void;
  onPositionFilterChange: (value: string) => void;
  playerSearch: string;
  positionFilter: string;
}

function getClearButtonClassName(isEnabled: boolean): string {
  if (isEnabled) {
    return "rounded-control bg-gray-100 px-3 py-2 text-caption font-heading font-bold uppercase tracking-label text-gray-600 transition-all hover:bg-hover dark:text-gray-300 dark:hover:bg-navy-600";
  }

  return "cursor-not-allowed rounded-control bg-gray-100 px-3 py-2 text-caption font-heading font-bold uppercase tracking-label text-gray-400 transition-all dark:bg-navy-700";
}

export default function TacticsFilters({
  onClear,
  onPlayerSearchChange,
  onPositionFilterChange,
  playerSearch,
  positionFilter,
}: TacticsFiltersProps): JSX.Element {
  const { t } = useTranslation();
  const positionTable = usePositionTable();
  const canClear = playerSearch.trim().length > 0 || positionFilter !== "All";

  return (
    <Card>
      <div className="flex flex-col gap-2 p-3">
        <input
          type="text"
          value={playerSearch}
          onChange={(event) => onPlayerSearchChange(event.target.value)}
          placeholder={t("squad.filterPlayers")}
          className="w-full rounded-control border border-gray-200 bg-white px-3 py-2 text-body text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-200"
        />
        <div className="flex gap-2">
          <Select
            value={positionFilter}
            onChange={(event) => onPositionFilterChange(event.target.value)}
            fullWidth
          >
            <option value="All">{t("common.all")}</option>
            {positionTable.lines().map((position) => (
              <option key={position} value={position}>
                {translatePositionAbbreviation(t, position)}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={onClear}
            disabled={!canClear}
            className={getClearButtonClassName(canClear)}
          >
            {t("common.clear")}
          </button>
        </div>
      </div>
    </Card>
  );
}
