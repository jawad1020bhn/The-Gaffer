import type { ReactNode } from "react";

export function QuickStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-panel p-3 text-center">
      <p className="text-caption text-fg-subtle font-heading uppercase tracking-label">{label}</p>
      <p className={`font-heading font-bold text-heading mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

export function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-line last:border-0">
      <div className="text-fg-subtle">{icon}</div>
      <span className="text-body text-fg-muted flex-1">{label}</span>
      <span className="text-body font-semibold text-fg">{value}</span>
    </div>
  );
}

export function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`p-2.5 rounded-control ${highlight ? "bg-selected-tint" : "bg-sunken"}`}>
      <p
        className={`font-heading font-bold text-heading tabular-nums ${highlight ? "text-selected" : "text-fg"}`}
      >
        {value}
      </p>
      <p className="text-caption text-fg-subtle font-heading uppercase tracking-label">{label}</p>
    </div>
  );
}
