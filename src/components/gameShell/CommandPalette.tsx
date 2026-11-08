import { Command } from "lucide-react";
import { type JSX, type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../ui";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Ctrl+K, or the magnifier in the top bar: the career search over the canvas, wider than the page
 * header's toolbar ever was. Escape or a click on the backdrop closes it, and the field takes focus
 * on open so the palette is a keyboard away.
 */
export default function CommandPalette({
  open,
  onClose,
  children,
}: CommandPaletteProps): JSX.Element | null {
  const { t } = useTranslation();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector("input")?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <Dialog
      labelledBy="command-palette-title"
      onClose={onClose}
      dismissOnBackdrop
      panelRef={panel}
      overlayClassName="bg-overlay p-4"
      className="w-full max-w-xl self-start rounded-panel"
    >
      <h2
        id="command-palette-title"
        className="flex items-center gap-2 border-b border-line px-4 py-2.5 font-heading text-lead font-bold uppercase tracking-label text-fg"
      >
        <Command className="h-4 w-4 text-selected" aria-hidden="true" />
        {t("gameNav.search")}
        <span className="kbd ml-auto">Esc</span>
      </h2>
      <div className="p-2">{children}</div>
    </Dialog>
  );
}
