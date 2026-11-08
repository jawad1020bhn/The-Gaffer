import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import type { ManagerProfile } from "./types";

interface ManagerProfileListProps {
  profiles: ManagerProfile[];
  selectedProfileId?: string;
  onSelect: (profile: ManagerProfile) => void;
  onDelete: (id: string) => void;
}

export default function ManagerProfileList({
  profiles,
  selectedProfileId,
  onSelect,
  onDelete,
}: ManagerProfileListProps) {
  const { t } = useTranslation();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (profiles.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 max-h-[13.5rem] overflow-y-auto pr-0.5">
      {profiles.map((profile) => {
        const isSelected = profile.id === selectedProfileId;
        return (
          <div
            key={profile.id}
            className={`group relative flex items-center w-full rounded-panel border transition-all duration-200 ${
              isSelected
                ? "bg-selected-tint border-selected ring-1 ring-selected/40"
                : "bg-panel border-line hover:border-selected hover:bg-hover"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setConfirmDeleteId(null);
                onSelect(profile);
              }}
              className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left min-w-0"
            >
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span
                  className={`font-heading font-bold text-body uppercase tracking-label truncate ${isSelected ? "text-selected" : "text-fg"}`}
                >
                  {profile.first_name} {profile.last_name}
                </span>
                <span className="text-caption text-fg-subtle ml-2 shrink-0">
                  {profile.nationality}
                </span>
              </div>
              <div
                className={`w-4 h-4 rounded-full bg-selected-fill flex items-center justify-center shrink-0 ${isSelected ? "visible" : "invisible"}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-panel" />
              </div>
            </button>

            <button
              type="button"
              aria-label={t("menu.delete")}
              onClick={() => setConfirmDeleteId(profile.id)}
              className="p-1.5 mr-2 rounded-control text-fg-subtle hover:text-danger hover:bg-danger-tint transition-all shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {confirmDeleteId === profile.id && (
              <div
                className={`absolute inset-0 flex items-center justify-end gap-1.5 px-3 rounded-panel ${isSelected ? "bg-selected-tint" : "bg-panel"}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onDelete(profile.id);
                    setConfirmDeleteId(null);
                  }}
                  className="px-2.5 py-1 bg-danger-tint hover:bg-danger-tint text-danger text-caption font-heading font-bold uppercase tracking-label rounded-control transition-colors"
                >
                  {t("menu.delete")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-2.5 py-1 bg-hover hover:bg-page text-fg text-caption font-heading font-bold uppercase tracking-label rounded-control transition-colors"
                >
                  {t("menu.cancel")}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
