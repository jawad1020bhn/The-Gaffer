import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import type { GameStateData, MessageData } from "../../store/gameStore";
import { useGameStore } from "../../store/gameStore";
import {
  clearOldMessages,
  deleteMessage,
  deleteMessages,
  fetchMessages,
  markAllMessagesRead,
  markMessageRead,
  resolveMessageAction,
} from "../../services/inboxService";
import { resolveBackendText, resolveMessage } from "../../utils/backendI18n";
import { gameKnowledgeRevision } from "../../lib/playerKnowledge";
import ArchivedMessages from "./ArchivedMessages";
import InboxDeleteConfirmModal from "./InboxDeleteConfirmModal";
import InboxMessageDetailPane from "./InboxMessageDetailPane";
import InboxMessageListPane from "./InboxMessageListPane";
import InboxToolbar from "./InboxToolbar";
import {
  type DeleteModalState,
  getFilteredMessages,
  getNavigationTarget,
  isNavigateAction,
  type MessageSortOrder,
  sortInboxMessages,
  toggleVisibleSelection,
} from "./inboxHelpers";

const EMPTY_MESSAGES: MessageData[] = [];

interface InboxTabProps {
  gameState: GameStateData | null;
  onGameUpdate: (g: GameStateData) => void;
  initialMessageId?: string | null;
  onNavigate?: (tab: string, context?: { messageId?: string }) => void;
}

export default function InboxTab({
  gameState,
  onGameUpdate,
  initialMessageId,
  onNavigate,
}: InboxTabProps): JSX.Element {
  const { i18n } = useTranslation();
  const { sessionState } = useGameStore();
  const [fetchedMessages, setFetchedMessages] = useState<MessageData[] | null>(null);

  // Prefer live sessionState clock; fall back to prop snapshot while sessionState loads.
  const clockDate = sessionState?.clock.current_date ?? gameState?.clock.current_date ?? null;
  const currentTeamId = sessionState?.manager?.team_id ?? gameState?.manager?.team_id ?? null;
  const currentTeamName = sessionState?.team?.name ?? null;
  const knowledgeRevision = gameState ? gameKnowledgeRevision(gameState) : "no-game";

  useEffect(() => {
    let cancelled = false;
    fetchMessages()
      .then((msgs) => {
        if (!cancelled && Array.isArray(msgs)) setFetchedMessages(msgs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clockDate]);

  const messages = fetchedMessages ?? gameState?.messages ?? EMPTY_MESSAGES;
  const allMessages = useMemo(() => messages.map(resolveMessage), [messages]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    initialMessageId ?? null,
  );
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<MessageSortOrder>("newest");
  const [bulkSelectionEnabled, setBulkSelectionEnabled] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [deleteModalState, setDeleteModalState] = useState<DeleteModalState>(null);
  const [effectFeedback, setEffectFeedback] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const inboxSeqRef = useRef(0);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const message of allMessages) {
      const currentCount = counts.get(message.category) ?? 0;
      counts.set(message.category, currentCount + 1);
    }

    return counts;
  }, [allMessages]);

  const categories = useMemo(() => Array.from(categoryCounts.keys()), [categoryCounts]);

  const filteredMessages = useMemo(
    () => sortInboxMessages(getFilteredMessages(allMessages, categoryFilter), sortOrder),
    [allMessages, categoryFilter, sortOrder],
  );

  const unreadCount = useMemo(
    () => allMessages.filter((message) => !message.read).length,
    [allMessages],
  );

  const selectedMessage = useMemo(
    () => allMessages.find((message) => message.id === selectedMessageId) ?? null,
    [allMessages, selectedMessageId],
  );

  // Only what is on screen counts as selected: a message can leave the view without the filter
  // changing (reading one in the Unread view), and Delete must never remove it unseen.
  const visibleSelectedMessageIds = useMemo(() => {
    const visibleMessageIds = new Set(filteredMessages.map((message) => message.id));
    return selectedMessageIds.filter((messageId) => visibleMessageIds.has(messageId));
  }, [filteredMessages, selectedMessageIds]);

  useEffect(() => {
    const availableMessageIds = new Set(allMessages.map((message) => message.id));

    if (selectedMessageId && !availableMessageIds.has(selectedMessageId)) {
      setSelectedMessageId(null);
    }
  }, [allMessages, selectedMessageId]);

  /**
   * Open something rather than showing a "select a message" void.
   *
   * The first unread in the current view, or the newest when everything is read. This goes through
   * the same path as a click, so the message is marked read exactly as it would be if the player
   * had picked it — being opened is what marks it. It only fires when nothing is selected, so it
   * never overrides a choice, and closing a message leaves it closed until the view changes.
   */
  const autoOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedMessageId !== null || filteredMessages.length === 0) return;
    const candidate = filteredMessages.find((message) => !message.read) ?? filteredMessages[0];
    // One attempt per message: a failed mark-read must not retry on every render.
    if (autoOpenRef.current === candidate.id) return;
    autoOpenRef.current = candidate.id;
    void handleSelectMessage(candidate.id);
    // handleSelectMessage is re-created each render; the ref above is what makes this fire once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMessages, selectedMessageId]);

  useEffect(() => {
    if (effectFeedback === null) return;
    const id = setTimeout(() => setEffectFeedback(null), 4000);
    return () => clearTimeout(id);
  }, [effectFeedback]);

  async function handleSelectMessage(messageId: string): Promise<void> {
    setSelectedMessageId(messageId);
    const message = allMessages.find((currentMessage) => currentMessage.id === messageId);

    if (message && !message.read) {
      const seq = ++inboxSeqRef.current;
      try {
        const updated = await markMessageRead(messageId);
        if (seq !== inboxSeqRef.current) return;
        setFetchedMessages(updated);
        useGameStore.getState().setMessages(updated);
      } catch {}
    }
  }

  async function handleAction(
    messageId: string,
    actionId: string,
    optionId?: string,
  ): Promise<void> {
    const message = allMessages.find((currentMessage) => currentMessage.id === messageId);
    const action = message?.actions.find((currentAction) => currentAction.id === actionId);

    if (action && isNavigateAction(action.action_type)) {
      const navigationTarget = getNavigationTarget(action.action_type.NavigateTo.route);
      onNavigate?.(navigationTarget.tab, navigationTarget.context);

      if (!navigationTarget.shouldResolveAction) {
        return;
      }
    }

    try {
      const result = await resolveMessageAction(messageId, actionId, optionId);

      setFetchedMessages(result.game.messages);
      onGameUpdate(result.game);

      if (result.effect || result.effect_i18n_key) {
        const effectParams = result.effect_i18n_params
          ? Object.fromEntries(
              Object.entries(result.effect_i18n_params).map(([key, value]) => [key, String(value)]),
            )
          : undefined;
        const resolvedEffect = resolveBackendText(
          result.effect_i18n_key ?? undefined,
          result.effect ?? "",
          effectParams,
        );
        setEffectFeedback(resolvedEffect);
      }
    } catch {}
  }

  async function handleMarkAllRead(): Promise<void> {
    const seq = ++inboxSeqRef.current;
    try {
      const updated = await markAllMessagesRead();
      if (seq !== inboxSeqRef.current) return;
      setFetchedMessages(updated);
      useGameStore.getState().setMessages(updated);
    } catch {}
  }

  async function handleClearOld(): Promise<void> {
    const seq = ++inboxSeqRef.current;
    try {
      const updated = await clearOldMessages();
      if (seq !== inboxSeqRef.current) return;
      setFetchedMessages(updated);
      useGameStore.getState().setMessages(updated);
      setSelectedMessageId(null);
    } catch {}
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteModalState) {
      return;
    }

    setIsDeleting(true);
    const seq = ++inboxSeqRef.current;

    try {
      let updatedMessages: MessageData[];
      let deletedMessageIds: string[];

      if (deleteModalState.mode === "single") {
        deletedMessageIds = [deleteModalState.messageId];
        updatedMessages = await deleteMessage(deleteModalState.messageId);
      } else {
        deletedMessageIds = deleteModalState.messageIds;
        updatedMessages = await deleteMessages(deleteModalState.messageIds);
        setBulkSelectionEnabled(false);
      }

      if (seq !== inboxSeqRef.current) return;
      setFetchedMessages(updatedMessages);
      useGameStore.getState().setMessages(updatedMessages);
      setSelectedMessageIds((currentIds) =>
        currentIds.filter((messageId) => !deletedMessageIds.includes(messageId)),
      );

      if (selectedMessageId && deletedMessageIds.includes(selectedMessageId)) {
        setSelectedMessageId(null);
      }

      setDeleteModalState(null);
    } catch {
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCloseDeleteModal(): void {
    if (isDeleting) {
      return;
    }

    setDeleteModalState(null);
  }

  function handleSortOrderChange(nextSortOrder: MessageSortOrder): void {
    setSortOrder(nextSortOrder);
  }

  function handleToggleBulkSelectionMode(): void {
    setBulkSelectionEnabled((currentValue) => {
      if (currentValue) {
        setSelectedMessageIds([]);
      }

      return !currentValue;
    });
  }

  function handleToggleSelectAll(): void {
    setSelectedMessageIds((currentIds) =>
      toggleVisibleSelection(
        currentIds,
        filteredMessages.map((message) => message.id),
      ),
    );
  }

  function handleToggleMessageSelection(messageId: string): void {
    setSelectedMessageIds((currentIds) => {
      if (currentIds.includes(messageId)) {
        return currentIds.filter((currentId) => currentId !== messageId);
      }

      return [...currentIds, messageId];
    });
  }

  function handleRequestBulkDelete(): void {
    if (visibleSelectedMessageIds.length === 0) {
      return;
    }

    setDeleteModalState({
      mode: "bulk",
      messageIds: visibleSelectedMessageIds,
    });
  }

  function handleRequestSingleDelete(): void {
    if (!selectedMessage) {
      return;
    }

    setDeleteModalState({
      mode: "single",
      messageId: selectedMessage.id,
      subject: selectedMessage.subject,
    });
  }

  function handleRequestDeleteMessage(messageId: string, subject: string): void {
    setDeleteModalState({
      mode: "single",
      messageId,
      subject,
    });
  }

  // A new view starts with nothing ticked, so Delete only ever removes what is on screen.
  function handleShowAll(): void {
    setSelectedMessageIds([]);
    setCategoryFilter(null);
  }

  function handleShowUnread(): void {
    setSelectedMessageIds([]);
    setCategoryFilter("__unread");
  }

  function handleToggleCategory(category: string): void {
    setSelectedMessageIds([]);
    setCategoryFilter((currentFilter) => {
      if (currentFilter === category) {
        return null;
      }

      return category;
    });
  }

  function handleCloseSelectedMessage(): void {
    setSelectedMessageId(null);
  }

  function handleScoutPlayerClick(playerId: string): void {
    onNavigate?.("__selectPlayer", { messageId: playerId });
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <InboxToolbar
        allMessagesCount={allMessages.length}
        bulkSelectionEnabled={bulkSelectionEnabled}
        categories={categories}
        categoryCounts={categoryCounts}
        categoryFilter={categoryFilter}
        selectedMessageCount={visibleSelectedMessageIds.length}
        visibleMessageCount={filteredMessages.length}
        allVisibleSelected={
          filteredMessages.length > 0 &&
          visibleSelectedMessageIds.length === filteredMessages.length
        }
        someVisibleSelected={visibleSelectedMessageIds.length > 0}
        onToggleSelectAll={handleToggleSelectAll}
        sortOrder={sortOrder}
        unreadCount={unreadCount}
        onClearOld={() => {
          void handleClearOld();
        }}
        onDeleteSelected={handleRequestBulkDelete}
        onMarkAllRead={() => {
          void handleMarkAllRead();
        }}
        onShowAll={handleShowAll}
        onShowUnread={handleShowUnread}
        onSortOrderChange={handleSortOrderChange}
        onToggleBulkSelectionMode={handleToggleBulkSelectionMode}
        onToggleCategory={handleToggleCategory}
      />

      <div className="grid min-h-0 grid-cols-12 overflow-hidden rounded-panel border border-line bg-panel-glass surface-panel shadow-panel">
        <div className="col-span-4 flex min-h-0 flex-col border-r border-line">
          <InboxMessageListPane
            bulkSelectionEnabled={bulkSelectionEnabled}
            filteredMessages={filteredMessages}
            language={i18n.language}
            selectedMessageId={selectedMessageId}
            selectedMessageIds={selectedMessageIds}
            onRequestDeleteMessage={(message) => {
              handleRequestDeleteMessage(message.id, message.subject);
            }}
            onRequestMarkMessageRead={(messageId) => {
              void handleSelectMessage(messageId);
            }}
            onSelectMessage={(messageId) => {
              void handleSelectMessage(messageId);
            }}
            onToggleMessageSelection={handleToggleMessageSelection}
          />
          {/* Older mail lives in the list column, not under the whole screen where it sat below
              the fold. Its own scroll keeps a long archive from pushing the button out of reach. */}
          <div className="scrollbar-thin max-h-52 shrink-0 overflow-auto border-t border-line bg-sunken surface-well px-4 pb-3">
            <ArchivedMessages />
          </div>
        </div>

        <div className="col-span-8 flex min-h-0 min-w-0 flex-col">
          <InboxMessageDetailPane
            effectFeedback={effectFeedback}
            currentTeamId={currentTeamId}
            currentTeamName={currentTeamName}
            language={i18n.language}
            knowledgeRevision={knowledgeRevision}
            selectedMessage={selectedMessage}
            onAction={(messageId, actionId, optionId) => {
              void handleAction(messageId, actionId, optionId);
            }}
            onCloseSelectedMessage={handleCloseSelectedMessage}
            onRequestDelete={handleRequestSingleDelete}
            onScoutPlayerClick={handleScoutPlayerClick}
          />
        </div>
      </div>

      <InboxDeleteConfirmModal
        deleteModalState={deleteModalState}
        isDeleting={isDeleting}
        onCancel={handleCloseDeleteModal}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
      />
    </div>
  );
}
