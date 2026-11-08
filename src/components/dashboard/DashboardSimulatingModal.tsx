import type { JSX } from "react";
import { useEffect, useId, useRef } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  Calendar,
  CheckCircle2,
  Loader2,
  Newspaper,
  Square,
  Swords,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { DigestStopReason } from "../../hooks/useDigestAdvance";
import type { AttentionEventKind, DigestEntry, RecapMatch } from "./advanceRecap";
import { getCategoryIcon } from "../inbox/inboxHelpers";
import { formatVal } from "../../lib/valueFormatting";
import { resolveBackendText } from "../../utils/backendI18n";
import { getBlockerTabLabel } from "../../utils/blockerUtils";
import { Dialog } from "../ui";

interface DashboardSimulatingModalProps {
  // Digest-mode props (optional — omit for a plain single-advance spinner)
  digestEntries?: DigestEntry[];
  isDigestRunning?: boolean;
  /**
   * A batch advance is crunching behind a feed that stays on screen (resume
   * after a mid-advance blocker): present as in-progress, but without the
   * Stop button — only the streaming loop can be aborted.
   */
  isBatchAdvancing?: boolean;
  isDigestAborting?: boolean;
  stopReason?: DigestStopReason | null;
  onStop?: () => void;
  onDismiss?: () => void;
  onNavigate?: (tab: string) => void;
  onContinueAfterBlocker?: () => void;
  /** Resume the advance after an attention-event pause. */
  onResume?: () => void;
}

const EVENT_LABEL_KEYS: Record<AttentionEventKind, string> = {
  highPriorityInbox: "dashboard.digestEventInbox",
  userTransfer: "dashboard.digestEventUserTransfer",
  userNews: "dashboard.digestEventUserNews",
  transferWindow: "dashboard.digestEventTransferWindow",
};

function ResultBadge({ result }: { result: RecapMatch["userResult"] }): JSX.Element | null {
  const { t } = useTranslation();
  if (!result) return null;
  const styles = {
    win: "text-selected bg-selected-tint/40",
    draw: "bg-hover text-fg-muted",
    loss: "text-danger bg-danger-tint/40",
  } as const;
  const labels = {
    win: t("common.won"),
    draw: t("common.drawn"),
    loss: t("common.lost"),
  } as const;
  return (
    <span
      className={`shrink-0 text-caption font-bold px-1.5 py-0.5 rounded uppercase ${styles[result]}`}
    >
      {labels[result]}
    </span>
  );
}

function MatchCard({ match, idx }: { match: RecapMatch; idx: number }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      className="digest-event-item flex items-center gap-2.5 rounded-control px-3 py-2 bg-selected-tint/10"
      style={{ animationDelay: `${Math.min(idx, 5) * 80}ms` }}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-selected bg-selected-tint/40">
        <Swords className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-caption font-medium text-fg truncate">
          {match.home_team} {match.home_goals}–{match.away_goals} {match.away_team}
          {match.home_penalties != null && match.away_penalties != null && (
            <span className="ml-1.5 text-caption font-semibold text-fg-muted">
              {t("match.shootout.shootoutScore", {
                h: match.home_penalties,
                a: match.away_penalties,
              })}
            </span>
          )}
        </p>
        <p className="text-caption text-fg-muted truncate">{match.competition}</p>
      </div>
      {match.involves_user && <ResultBadge result={match.userResult} />}
    </div>
  );
}

function TransferCard({
  player,
  from,
  to,
  fee,
  involvesUser,
  idx,
}: {
  player: string;
  from: string;
  to: string;
  fee: number;
  involvesUser?: boolean;
  idx: number;
}): JSX.Element {
  const feeLabel = fee > 0 ? formatVal(fee) : null;
  return (
    <div
      className="digest-event-item flex items-center gap-2.5 rounded-control px-3 py-2 bg-info-tint/10"
      style={{ animationDelay: `${Math.min(idx, 5) * 80}ms` }}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-info bg-info-tint/40">
        <ArrowRightLeft className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-caption truncate ${involvesUser ? "font-bold text-selected" : "font-medium text-fg"}`}
        >
          {player}
        </p>
        <p className="text-caption text-fg-muted truncate">
          {from} → {to}
        </p>
      </div>
      {feeLabel && (
        <span className="shrink-0 text-caption font-semibold px-1.5 py-0.5 rounded text-info bg-info-tint/40">
          {feeLabel}
        </span>
      )}
    </div>
  );
}

function NewsCard({ text, idx }: { text: string; idx: number }): JSX.Element {
  return (
    <div
      className="digest-event-item flex items-center gap-2.5 rounded-control px-3 py-2 bg-sunken"
      style={{ animationDelay: `${Math.min(idx, 5) * 80}ms` }}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hover text-fg-muted">
        <Newspaper className="h-3.5 w-3.5" />
      </div>
      <p className="min-w-0 flex-1 text-caption text-fg line-clamp-2">{text}</p>
    </div>
  );
}

function InboxCard({
  text,
  category,
  idx,
}: {
  text: string;
  category?: string;
  idx: number;
}): JSX.Element {
  // Always go through getCategoryIcon so the fallback (System/Info) stays consistent with the inbox
  const icon = getCategoryIcon(category ?? "System");
  return (
    <div
      className="digest-event-item flex items-center gap-2.5 rounded-control px-3 py-2 bg-warning-tint/15"
      style={{ animationDelay: `${Math.min(idx, 5) * 80}ms` }}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-warning bg-warning-tint/40">
        {icon}
      </div>
      <p className="min-w-0 flex-1 text-caption font-medium text-warning line-clamp-2">{text}</p>
      <Square className="h-2 w-2 shrink-0 fill-current text-warning" />
    </div>
  );
}

function DigestDayRow({ entry }: { entry: DigestEntry }): JSX.Element {
  const { t } = useTranslation();
  const { recap } = entry;
  const hasContent =
    recap.matches.length > 0 ||
    recap.transfers.length > 0 ||
    recap.news.length > 0 ||
    recap.inbox.length > 0;

  const formattedDate = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(`${entry.date}T00:00:00Z`));

  // Declarative stagger offsets per section to avoid mutable counter in render
  const matchOffset = 0;
  const transferOffset = recap.matches.length;
  const newsOffset = transferOffset + recap.transfers.length;
  const inboxOffset = newsOffset + recap.news.length;

  return (
    <div className="border-b border-line pb-3 last:border-0">
      <div className="flex items-center gap-1.5 text-caption font-semibold text-fg-muted mb-2">
        <Calendar className="h-3 w-3" />
        {formattedDate}
      </div>

      {!hasContent && (
        <p className="text-caption text-fg-subtle italic px-1">{t("dashboard.digestQuietDay")}</p>
      )}

      <div className="space-y-1">
        {recap.matches.map((match, i) => (
          <MatchCard
            key={`${match.date}-${match.home_team}-${match.away_team}`}
            match={match}
            idx={matchOffset + i}
          />
        ))}

        {recap.transfers.map((transfer, i) => (
          <TransferCard
            key={`${transfer.date}-${transfer.player}`}
            player={transfer.player}
            from={transfer.from}
            to={transfer.to}
            fee={transfer.fee}
            involvesUser={transfer.involvesUser}
            idx={transferOffset + i}
          />
        ))}

        {recap.news.map((article, i) => (
          <NewsCard key={article.id} text={article.text} idx={newsOffset + i} />
        ))}

        {recap.inbox.map((item, i) => (
          <InboxCard
            key={item.id}
            text={item.text}
            category={item.category}
            idx={inboxOffset + i}
          />
        ))}
      </div>
    </div>
  );
}

export default function DashboardSimulatingModal({
  digestEntries,
  isDigestRunning,
  isBatchAdvancing,
  isDigestAborting,
  stopReason,
  onStop,
  onDismiss,
  onNavigate,
  onContinueAfterBlocker,
  onResume,
}: DashboardSimulatingModalProps): JSX.Element {
  const { t } = useTranslation();
  const titleId = useId();
  const listEndRef = useRef<HTMLDivElement>(null);
  const isDigestMode =
    digestEntries !== undefined || isDigestRunning === true || stopReason != null;
  const isRunning = isDigestRunning ?? false;
  const isInProgress = isRunning || (isBatchAdvancing ?? false);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [digestEntries?.length]);

  // Plain single-advance spinner (no digest data yet)
  if (!isDigestMode) {
    // A single day is advancing and can't be stopped: no onClose, so Escape asks for nothing.
    return (
      <Dialog labelledBy={titleId} busy className="w-full max-w-sm rounded-panel p-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full text-selected bg-selected-tint/15">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <h3
            id={titleId}
            className="mt-4 text-heading font-heading font-bold uppercase tracking-label text-fg"
          >
            {t("dashboard.simulating")}
          </h3>
          <p className="mt-2 text-body text-fg-muted">{t("dashboard.simulatingMessage")}</p>
        </div>
      </Dialog>
    );
  }

  // Digest mode: scrollable feed with action buttons at the bottom. While the advance runs, Escape
  // asks for nothing (Stop is the way to end it); once it has stopped, Escape closes it.
  return (
    <Dialog
      labelledBy={titleId}
      onClose={isInProgress ? undefined : onDismiss}
      busy={isInProgress}
      className="w-full max-w-2xl rounded-panel p-6"
    >
      <div className="flex flex-col" style={{ maxHeight: "80vh" }}>
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-line shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full text-selected bg-selected-tint/15">
            {isInProgress ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </div>
          <h3
            id={titleId}
            className="flex-1 text-body font-heading font-bold uppercase tracking-label text-fg"
          >
            {isInProgress ? t("dashboard.digestAdvancing") : t("dashboard.digestDone")}
          </h3>
          {isRunning && onStop && (
            <button
              type="button"
              onClick={onStop}
              disabled={isDigestAborting}
              className="flex items-center gap-1.5 rounded-control border border-line-strong px-3 py-1.5 text-caption font-medium text-fg hover:bg-sunken disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDigestAborting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {isDigestAborting ? t("dashboard.digestStopping") : t("dashboard.digestStop")}
            </button>
          )}
        </div>

        {/* Scrollable event feed */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 min-h-0">
          {digestEntries && digestEntries.length === 0 && !isInProgress && !stopReason && (
            <p className="text-caption text-fg-subtle italic text-center py-4">
              {t("dashboard.digestEmpty")}
            </p>
          )}

          {digestEntries?.map((entry) => (
            <DigestDayRow key={entry.date} entry={entry} />
          ))}

          {isInProgress && (
            <div className="flex items-center gap-2 text-caption text-fg-subtle py-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("dashboard.digestSimulating")}
            </div>
          )}

          <div ref={listEndRef} />
        </div>

        {/* Close button when digest finished with no specific stop reason (natural end or user-aborted) */}
        {!isInProgress && !stopReason && digestEntries && digestEntries.length > 0 && (
          <div className="border-t border-line pt-4 shrink-0">
            <button
              type="button"
              onClick={onDismiss}
              className="w-full rounded-control border border-line-strong px-4 py-2 text-body font-medium text-fg hover:bg-sunken"
            >
              {t("common.close")}
            </button>
          </div>
        )}

        {/* Action buttons pinned at the bottom */}
        {stopReason && (
          <div className="border-t border-line pt-4 shrink-0">
            {stopReason.kind === "match_day" && (
              <div className="rounded-control px-4 py-3 bg-selected-tint/20">
                <div className="flex items-center gap-2 mb-2">
                  <Swords className="h-4 w-4 text-selected" />
                  <span className="text-body font-semibold text-selected">
                    {t("dashboard.digestMatchDay")}
                  </span>
                </div>
                <p className="text-caption text-selected mb-3">
                  {t("dashboard.digestMatchDayDesc")}
                </p>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="w-full rounded-control bg-selected-fill px-4 py-2.5 text-body font-semibold text-on-brand hover:bg-selected-fill"
                >
                  {t("dashboard.digestReturnHome")}
                </button>
              </div>
            )}

            {stopReason.kind === "event" && (
              <div className="rounded-control px-4 py-3 bg-info-tint/20">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="h-4 w-4 text-info" />
                  <span className="text-body font-semibold text-info">
                    {t("dashboard.digestEventStop")}
                  </span>
                </div>
                <p className="text-caption text-info mb-2">{t("dashboard.digestEventStopDesc")}</p>
                <ul className="mb-3 flex flex-col gap-1">
                  {stopReason.events.map((event) => (
                    <li
                      key={event}
                      className="flex items-center gap-1.5 text-caption font-medium text-info"
                    >
                      <Square className="h-1.5 w-1.5 shrink-0 fill-current" />
                      {t(EVENT_LABEL_KEYS[event])}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={onResume}
                    className="w-full rounded-control bg-info-tint px-3 py-2 text-caption font-semibold text-info hover:bg-info-tint"
                  >
                    {t("dashboard.digestContinue")}
                  </button>
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="rounded-control border border-line-strong px-3 py-2 text-caption font-medium text-fg hover:bg-sunken"
                  >
                    {t("dashboard.digestClose")}
                  </button>
                </div>
              </div>
            )}

            {stopReason.kind === "blocked" && (
              <div className="rounded-control px-4 py-3 bg-warning-tint/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span className="text-body font-semibold text-warning">
                    {t("dashboard.digestBlocked")}
                  </span>
                </div>
                <p className="text-caption text-warning mb-3">{t("dashboard.digestBlockedDesc")}</p>
                {stopReason.blockers.length > 0 && (
                  <div className="mb-3 flex flex-col gap-1.5">
                    {stopReason.blockers.map((blocker) => (
                      <button
                        key={blocker.id}
                        type="button"
                        onClick={() => {
                          onDismiss?.();
                          onNavigate?.(blocker.tab);
                        }}
                        className="w-full rounded-control border border-warning/40 bg-warning-tint px-3 py-2 text-left hover:bg-warning-tint transition-colors"
                      >
                        <p className="text-caption font-medium text-warning">
                          {resolveBackendText(blocker.text_key, blocker.text, blocker.text_params)}
                        </p>
                        <p className="mt-0.5 text-caption font-heading uppercase tracking-label text-warning/70">
                          {t("notifications.goTo")} {getBlockerTabLabel(t, blocker.tab)} →
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={onContinueAfterBlocker}
                    className="w-full rounded-control bg-warning-tint px-3 py-2 text-caption font-semibold text-warning hover:bg-warning-tint"
                  >
                    {t("dashboard.digestContinueAnyway")}
                  </button>
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="rounded-control border border-line-strong px-3 py-2 text-caption font-medium text-fg hover:bg-sunken"
                  >
                    {t("dashboard.digestClose")}
                  </button>
                </div>
              </div>
            )}

            {stopReason.kind === "fired" && (
              <div className="bg-danger-tint rounded-control px-4 py-3">
                <p className="text-body font-semibold text-danger mb-3">
                  {t("dashboard.digestFired")}
                </p>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="w-full rounded-control border border-line-strong px-3 py-2 text-caption font-medium text-fg hover:bg-sunken"
                >
                  {t("dashboard.digestClose")}
                </button>
              </div>
            )}

            {stopReason.kind === "stopped" && (
              <div className="bg-sunken rounded-control px-4 py-3">
                <p className="text-body font-semibold text-fg mb-3">
                  {t("dashboard.digestStopped")}
                </p>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="w-full rounded-control border border-line-strong px-3 py-2 text-caption font-medium text-fg hover:bg-sunken"
                >
                  {t("dashboard.digestClose")}
                </button>
              </div>
            )}

            {stopReason.kind === "error" && (
              <div className="bg-sunken rounded-control px-4 py-3">
                <p className="text-body font-semibold text-fg mb-3">{t("dashboard.digestError")}</p>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="w-full rounded-control border border-line-strong px-3 py-2 text-caption font-medium text-fg hover:bg-sunken"
                >
                  {t("dashboard.digestClose")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
