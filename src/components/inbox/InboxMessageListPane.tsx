import { Mail, MailOpen } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { formatDateShort } from "../../lib/helpers";
import type { MessageData } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import { Checkbox } from "../ui";
import {
  buildDeleteMessageMenuItem,
  buildMarkMessageReadMenuItem,
  buildOpenMessageMenuItem,
} from "./inboxContextMenuItems";
import {
  getCategoryColor,
  getCategoryIcon,
  getListPaneClassName,
  getMessageIconClassName,
  getMessageRowClassName,
  getMessageSubjectClassName,
} from "./inboxHelpers";

interface InboxMessageListPaneProps {
  bulkSelectionEnabled: boolean;
  filteredMessages: MessageData[];
  language: string;
  selectedMessageId: string | null;
  selectedMessageIds: string[];
  onSelectMessage: (messageId: string) => void;
  onToggleMessageSelection: (messageId: string) => void;
  onRequestDeleteMessage: (message: MessageData) => void;
  onRequestMarkMessageRead: (messageId: string) => void;
}

export default function InboxMessageListPane({
  bulkSelectionEnabled,
  filteredMessages,
  language,
  selectedMessageId,
  selectedMessageIds,
  onSelectMessage,
  onToggleMessageSelection,
  onRequestDeleteMessage,
  onRequestMarkMessageRead,
}: InboxMessageListPaneProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className={getListPaneClassName()}>
      <div className="bg-panel shrink-0 border-b border-line p-4">
        <h3 className="text-body font-heading font-bold text-fg flex items-center gap-2 uppercase tracking-label">
          <Mail className="w-4 h-4 text-warning" />
          {t("inbox.title")}
        </h3>
        <p className="text-caption text-fg-subtle mt-0.5 font-heading uppercase tracking-label">
          {t("inbox.nMessages", { count: filteredMessages.length })}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredMessages.length === 0 ? (
          <div className="p-6 text-center">
            <MailOpen className="w-8 h-8 text-fg-subtle mx-auto mb-2" />
            <p className="text-body text-fg-subtle">{t("inbox.noMessages")}</p>
          </div>
        ) : (
          filteredMessages.map((message) => {
            const categoryIcon = getCategoryIcon(message.category);
            const categoryColor = getCategoryColor(message.category);
            const isSelected = selectedMessageId === message.id;
            const contextItems = [
              buildOpenMessageMenuItem(t, () => onSelectMessage(message.id)),
              buildMarkMessageReadMenuItem(t, message.read, () =>
                onRequestMarkMessageRead(message.id),
              ),
              buildDeleteMessageMenuItem(t, () => onRequestDeleteMessage(message)),
            ];

            return (
              <ContextMenu items={contextItems} key={message.id}>
                <div
                  onClick={() => onSelectMessage(message.id)}
                  className={getMessageRowClassName(isSelected, message.read)}
                  data-testid={`inbox-row-${message.id}`}
                >
                  {bulkSelectionEnabled ? (
                    <div
                      className="mt-1 flex shrink-0 items-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedMessageIds.includes(message.id)}
                        onChange={() => onToggleMessageSelection(message.id)}
                        aria-label={t("inbox.selectMessageForDeletion", {
                          subject: message.subject,
                        })}
                        data-testid={`inbox-select-message-${message.id}`}
                      />
                    </div>
                  ) : null}
                  <div className={getMessageIconClassName(categoryColor, isSelected, message.read)}>
                    {categoryIcon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className={getMessageSubjectClassName(message.read)}>
                        {message.subject}
                      </h4>
                      {!message.read ? (
                        <span className="w-2 h-2 rounded-full bg-selected-fill shrink-0" />
                      ) : null}
                    </div>
                    <p className="text-caption text-fg-subtle truncate mt-0.5">{message.sender}</p>
                    <p className="text-caption text-fg-subtle mt-0.5">
                      {formatDateShort(message.date, language)}
                    </p>
                  </div>
                </div>
              </ContextMenu>
            );
          })
        )}
      </div>
    </div>
  );
}
