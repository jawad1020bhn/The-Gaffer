import { useTranslation } from "react-i18next";

import { formatDateShort } from "../../lib/helpers";
import type { MessageData } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import type { ContextMenuItem } from "../ContextMenu";
import { Card, CardBody, CardHeader } from "../ui";
import { buildOpenMessageMenuItem } from "../inbox/inboxContextMenuItems";

interface HomeRecentMessagesCardProps {
  messages: MessageData[];
  lang: string;
  onNavigate?: (tab: string, context?: { messageId?: string }) => void;
  className?: string;
}

export default function HomeRecentMessagesCard({
  messages,
  lang,
  onNavigate,
  className = "",
}: HomeRecentMessagesCardProps) {
  const { t } = useTranslation();

  return (
    <Card className={className}>
      <CardHeader
        action={
          <button
            type="button"
            onClick={() => onNavigate?.("Inbox")}
            className="text-selected text-caption font-heading font-bold uppercase tracking-label hover:text-selected transition-colors"
          >
            {t("home.viewAll")}
          </button>
        }
      >
        {t("home.recentMessages")}
      </CardHeader>
      <CardBody className="p-0">
        <div className="divide-y divide-line">
          {messages.length === 0 ? (
            <p className="text-fg-muted p-6 text-body">{t("home.noMessages")}</p>
          ) : (
            messages.map((message) => {
              const contextItems: ContextMenuItem[] = [
                buildOpenMessageMenuItem(t, () => onNavigate?.("Inbox", { messageId: message.id })),
                {
                  label: t("home.viewAll"),
                  onClick: () => onNavigate?.("Inbox"),
                },
              ];

              return (
                <ContextMenu items={contextItems} key={message.id}>
                  <div
                    onClick={() => onNavigate?.("Inbox", { messageId: message.id })}
                    className={`flex gap-4 px-6 py-3.5 hover:bg-sunken cursor-pointer transition-colors ${
                      !message.read
                        ? "border-l-4 border-l-selected"
                        : "border-l-4 border-l-transparent"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-control flex items-center justify-center flex-shrink-0 font-heading font-bold text-body ${
                        message.read ? "bg-hover text-fg-subtle" : "bg-selected-tint text-selected"
                      }`}
                    >
                      {message.sender.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4
                        className={`font-semibold text-body ${
                          message.read ? "text-fg-muted" : "text-fg"
                        }`}
                      >
                        {message.subject}
                      </h4>
                      <p
                        className={`text-caption truncate mt-0.5 ${
                          message.read ? "text-fg-subtle" : "text-fg-muted"
                        }`}
                      >
                        {message.body}
                      </p>
                    </div>
                    <span className="text-caption text-fg-subtle flex-shrink-0 mt-1">
                      {formatDateShort(message.date, lang)}
                    </span>
                  </div>
                </ContextMenu>
              );
            })
          )}
        </div>
      </CardBody>
    </Card>
  );
}
