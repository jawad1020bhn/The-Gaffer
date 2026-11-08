import { useTranslation } from "react-i18next";
import { formatDate } from "../../lib/helpers";
import { resolveBackendText } from "../../utils/backendI18n";
import { Play, Clock, Trash2, X, Loader2 } from "lucide-react";

/**
 * A save created by the game stores its name as a translation key plus the
 * manager's name; one the player renamed is plain text and resolves to itself,
 * as does every save written before the key existed.
 */
function saveDisplayName(name: string): string {
  return resolveBackendText(name, name);
}

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

interface SavesListProps {
  saves: SaveEntry[];
  isLoading: boolean;
  loadingSaveId?: string | null;
  confirmDeleteId: string | null;
  onLoad: (saveId: string) => void;
  onDelete: (saveId: string) => void;
  onConfirmDelete: (saveId: string | null) => void;
  onClose: () => void;
}

export default function SavesList({
  saves,
  isLoading,
  loadingSaveId,
  confirmDeleteId,
  onLoad,
  onDelete,
  onConfirmDelete,
  onClose,
}: SavesListProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-heading font-heading font-bold uppercase tracking-label text-fg transition-colors">
          {t("menu.loadGame")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-fg-subtle hover:text-fg transition-colors p-1 rounded-control hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
          aria-label={t("common.close")}
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-8 text-fg-muted">
            <Loader2 className="w-8 h-8 animate-spin text-selected" />
            <span className="text-body font-heading uppercase tracking-label">
              {t("menu.loadingSaves")}
            </span>
          </div>
        ) : saves.length === 0 ? (
          <div className="text-fg-muted text-center py-8">{t("menu.noSaves")}</div>
        ) : (
          saves.map((save) => (
            <div
              key={save.id}
              className="group relative flex flex-col gap-2 w-full p-4 bg-panel hover:bg-hover text-left rounded-panel transition-all duration-200 border border-line hover:border-selected shadow-sm"
            >
              {confirmDeleteId === save.id ? (
                <div className="flex flex-col gap-2">
                  {/* The string carries its own <strong> markup, so it has to
                      go through the HTML parser — but the save name is player
                      text and must not. `escapeValue` is globally false
                      (src/i18n/index.ts), so it is re-enabled for this one
                      interpolation. */}
                  <p
                    className="text-body text-fg"
                    dangerouslySetInnerHTML={{
                      __html: t("menu.deleteConfirm", {
                        name: saveDisplayName(save.name),
                        interpolation: { escapeValue: true },
                      }),
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onDelete(save.id)}
                      className="flex-1 py-2 bg-danger-tint hover:bg-danger-tint text-danger text-body font-heading font-bold uppercase tracking-label rounded-control transition-colors"
                    >
                      {t("menu.delete")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onConfirmDelete(null)}
                      className="flex-1 py-2 bg-hover hover:bg-hover text-fg text-body font-heading font-bold uppercase tracking-label rounded-control transition-colors"
                    >
                      {t("menu.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => onLoad(save.id)}
                    className="flex flex-col gap-2 flex-1 text-left min-w-0"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-heading font-bold text-fg text-heading uppercase tracking-label truncate">
                        {saveDisplayName(save.name)}
                      </span>
                      {loadingSaveId === save.id ? (
                        <Loader2 className="w-4 h-4 text-selected animate-spin flex-shrink-0" />
                      ) : (
                        <Play className="w-4 h-4 text-selected opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex justify-between items-center w-full text-body text-fg-muted">
                      <span>{save.team_name.trim() || t("managersWorld.unemployed")}</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(save.last_played_at, i18n.language)}</span>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirmDelete(save.id);
                    }}
                    className="p-1.5 rounded-control text-fg-subtle hover:text-danger hover:bg-danger-tint opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    title={t("menu.deleteSave")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
