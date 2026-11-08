import { ArrowLeft, CheckCircle2, MailOpen, MessageCircle, Trash2 } from "lucide-react";
import type { TFunction } from "i18next";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatDateFull } from "../../lib/helpers";
import type { MessageData } from "../../store/gameStore";
import ScoutPlayerCard from "../ScoutPlayerCard";
import SwitchClubConfirmModal from "../SwitchClubConfirmModal";
import { Badge, Button } from "../ui";
import InboxDelegatedRenewalReport from "./InboxDelegatedRenewalReport";
import InboxYouthProspectCard from "./InboxYouthProspectCard";
import { useYouthProspectOpinions } from "../../hooks/useYouthProspectOpinions";
import {
  getActionButtonClassName,
  getCategoryColor,
  getCategoryIcon,
  isChooseOptionAction,
  isPlayerEventMessage,
  renderMessageBodyLine,
} from "./inboxHelpers";

interface PendingSwitch {
  messageId: string;
  actionId: string;
  optionId: string;
  newClubName: string;
}

interface InboxMessageDetailPaneProps {
  effectFeedback: string | null;
  currentTeamId: string | null;
  currentTeamName: string | null;
  language: string;
  /** The game's knowledge revision (`gameKnowledgeRevision`): the scout's opinions are asked again when it moves. */
  knowledgeRevision: string;
  selectedMessage: MessageData | null;
  onAction: (messageId: string, actionId: string, optionId?: string) => void;
  onCloseSelectedMessage: () => void;
  onRequestDelete: () => void;
  onScoutPlayerClick: (playerId: string) => void;
}

export default function InboxMessageDetailPane({
  effectFeedback,
  currentTeamId,
  currentTeamName,
  language,
  knowledgeRevision,
  selectedMessage,
  onAction,
  onCloseSelectedMessage,
  onRequestDelete,
  onScoutPlayerClick,
}: InboxMessageDetailPaneProps): JSX.Element {
  const { t } = useTranslation();
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);

  // Drop any in-flight switch-confirm when the selected message changes —
  // otherwise the modal can survive selection changes and confirm an action
  // captured against a now-unrelated message.
  useEffect(() => {
    setPendingSwitch(null);
  }, [selectedMessage?.id]);

  const currentClubName = currentTeamName ?? "";
  const hasYouthProspects = Boolean(selectedMessage?.context?.youth_prospects?.length);
  const prospectOpinions = useYouthProspectOpinions(
    hasYouthProspects && selectedMessage ? selectedMessage.id : null,
    knowledgeRevision,
  );
  const linkedPlayerId = selectedMessage?.context?.player_id ?? null;

  const handleOptionClick = (messageId: string, actionId: string, optionId: string) => {
    const offerTeamId = selectedMessage?.context?.team_id ?? null;
    const isSwitch =
      messageId.startsWith("job_offer_") &&
      optionId === "accept" &&
      !!currentTeamId &&
      !!selectedMessage &&
      // Skip the "leave your current club?" modal when the offer points at
      // the manager's own current club — the backend treats that as a no-op
      // and the warning would otherwise misleadingly suggest a real switch.
      offerTeamId !== currentTeamId;
    if (!isSwitch) {
      onAction(messageId, actionId, optionId);
      return;
    }
    const newClubName = selectedMessage.context?.team_name ?? "";
    setPendingSwitch({ messageId, actionId, optionId, newClubName });
  };

  if (!selectedMessage) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <MailOpen className="w-12 h-12 text-fg-subtle mx-auto mb-3" />
          <p className="text-body text-fg-subtle font-heading uppercase tracking-label">
            {t("inbox.selectMessage")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="shrink-0 border-b border-line p-5">
        <button
          type="button"
          onClick={onCloseSelectedMessage}
          className="md:hidden flex items-center gap-1.5 text-caption text-fg-muted hover:text-fg mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {t("inbox.backToInbox")}
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className={`w-10 h-10 rounded-control flex items-center justify-center shrink-0 ${getCategoryColor(selectedMessage.category)} bg-selected-tint`}
            >
              {getCategoryIcon(selectedMessage.category)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading font-bold text-lead text-fg">
                {selectedMessage.subject}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-body font-medium text-fg-muted">
                  {selectedMessage.sender}
                  {selectedMessage.sender_role ? ` — ${selectedMessage.sender_role}` : ""}
                </span>
                <span className="text-caption text-fg-subtle">
                  {formatDateFull(selectedMessage.date, language)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="neutral" size="sm">
                  {t(`inbox.categories.${selectedMessage.category}`)}
                </Badge>
                {selectedMessage.priority === "Urgent" ? (
                  <Badge variant="danger" size="sm">
                    {t("inbox.urgent")}
                  </Badge>
                ) : null}
                {selectedMessage.priority === "High" ? (
                  <Badge variant="accent" size="sm">
                    {t("inbox.important")}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={onRequestDelete}
            icon={<Trash2 className="w-4 h-4" />}
            className="bg-danger-solid hover:bg-danger-solid active:bg-danger-solid focus-visible:ring-focus"
            data-testid="inbox-delete-message"
          >
            {t("inbox.deleteMessage")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          {selectedMessage.body
            .split("\n")
            .map((line, index) => renderMessageBodyLine(line, index))}

          {linkedPlayerId &&
          !selectedMessage.context?.scout_report &&
          !hasYouthProspects &&
          !selectedMessage.context?.delegated_renewal_report ? (
            <div className="mt-4 flex">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onScoutPlayerClick(linkedPlayerId)}
              >
                {t("squad.viewProfile")}
              </Button>
            </div>
          ) : null}

          <InboxDelegatedRenewalReport
            message={selectedMessage}
            onPlayerClick={onScoutPlayerClick}
          />

          {selectedMessage.context?.scout_report ? (
            <ScoutPlayerCard
              report={selectedMessage.context.scout_report}
              onPlayerClick={onScoutPlayerClick}
            />
          ) : null}

          {selectedMessage.category === "ScoutReport" && !selectedMessage.context?.scout_report ? (
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 rounded-panel border border-line bg-sunken px-4 py-3">
                <span className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
                  {t("scouting.youthTargetLabel")}
                </span>
                <Badge variant="neutral" size="sm">
                  {selectedMessage.context?.youth_target_position
                    ? t(`common.positions.${selectedMessage.context.youth_target_position}`)
                    : t("scouting.youthAnyPosition")}
                </Badge>
                {selectedMessage.context?.youth_search_region ? (
                  <Badge variant="neutral" size="sm">
                    {translateYouthSearchRegion(t, selectedMessage.context.youth_search_region)}
                  </Badge>
                ) : null}
                {selectedMessage.context?.youth_search_objective ? (
                  <Badge variant="neutral" size="sm">
                    {translateYouthSearchObjective(
                      t,
                      selectedMessage.context.youth_search_objective,
                    )}
                  </Badge>
                ) : null}
              </div>

              {selectedMessage.context?.youth_prospects?.length ? (
                <div className="grid gap-3">
                  {selectedMessage.context.youth_prospects.map((prospect) => (
                    <InboxYouthProspectCard
                      key={prospect.id}
                      prospect={prospect}
                      opinion={prospectOpinions[prospect.id] ?? null}
                      action={selectedMessage.actions.find(
                        (candidate) => candidate.id === `prospect:${prospect.id}`,
                      )}
                      messageId={selectedMessage.id}
                      currentTeamId={currentTeamId}
                      language={language}
                      t={t}
                      onAction={onAction}
                      onScoutPlayerClick={onScoutPlayerClick}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {selectedMessage.context?.match_result ? (
            <div className="mt-6 p-4 bg-sunken rounded-panel flex items-center justify-center gap-8 border border-line">
              <span className="font-heading font-bold text-body text-fg">
                {selectedMessage.context.match_result.home_team_name ||
                  selectedMessage.context.match_result.home_team_id}
              </span>
              <span className="font-heading font-bold text-title text-fg">
                {selectedMessage.context.match_result.home_goals} -{" "}
                {selectedMessage.context.match_result.away_goals}
              </span>
              <span className="font-heading font-bold text-body text-fg">
                {selectedMessage.context.match_result.away_team_name ||
                  selectedMessage.context.match_result.away_team_id}
              </span>
            </div>
          ) : null}

          {effectFeedback ? (
            <div className="mt-4 p-3 bg-selected-tint border border-selected/40 rounded-panel flex items-center gap-2 animate-pulse">
              <CheckCircle2 className="w-4 h-4 text-selected shrink-0" />
              <span className="text-body font-medium text-selected">
                {t("inbox.effectOutcomeLabel")}: {effectFeedback}
              </span>
            </div>
          ) : null}

          {selectedMessage.actions.length > 0 && !hasYouthProspects ? (
            <div className="mt-6">
              {selectedMessage.actions.map((action) => {
                if (isChooseOptionAction(action.action_type)) {
                  const options = action.action_type.ChooseOption.options;

                  if (action.resolved) {
                    return (
                      <div
                        key={action.id}
                        className="flex items-center gap-2 text-body text-fg-subtle mt-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-selected" />
                        <span className="font-heading font-bold uppercase tracking-label text-caption">
                          {t("inbox.responded")}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div key={action.id} className="space-y-2">
                      <p className="text-caption font-heading font-bold uppercase tracking-labelst text-fg-subtle flex items-center gap-1.5 mb-3">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {isPlayerEventMessage(selectedMessage.id)
                          ? t("inbox.chooseResponseOutcomeVaries")
                          : t("inbox.chooseResponse")}
                      </p>
                      {options.map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          onClick={() =>
                            handleOptionClick(selectedMessage.id, action.id, option.id)
                          }
                          className="w-full text-left p-4 rounded-panel border border-line hover:border-selected hover:bg-selected-tint transition-all group"
                        >
                          <p className="text-body font-heading font-bold text-fg group-hover:text-selected transition-colors">
                            {option.label}
                          </p>
                          <p className="text-caption text-fg-muted mt-1">{option.description}</p>
                        </button>
                      ))}
                    </div>
                  );
                }

                return (
                  <button
                    type="button"
                    key={action.id}
                    disabled={action.resolved}
                    onClick={() => onAction(selectedMessage.id, action.id)}
                    className={getActionButtonClassName(action)}
                  >
                    {action.resolved ? `✓ ${action.label}` : action.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      <SwitchClubConfirmModal
        open={pendingSwitch !== null}
        currentClubName={currentClubName}
        newClubName={pendingSwitch?.newClubName ?? ""}
        onCancel={() => setPendingSwitch(null)}
        onConfirm={() => {
          if (!pendingSwitch) return;
          const { messageId, actionId, optionId } = pendingSwitch;
          setPendingSwitch(null);
          onAction(messageId, actionId, optionId);
        }}
      />
    </>
  );
}

function translateYouthSearchRegion(t: TFunction, value: string): string {
  if (value === "International") {
    return t("scouting.regionInternational");
  }

  return t("scouting.regionDomestic");
}

function translateYouthSearchObjective(t: TFunction, value: string): string {
  if (value === "HighPotential") {
    return t("scouting.objectiveHighPotential");
  }
  if (value === "ReadySoon") {
    return t("scouting.objectiveReadySoon");
  }

  return t("scouting.objectiveBalanced");
}
