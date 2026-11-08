import { useTranslation } from "react-i18next";

import { formatDateShort } from "../../lib/helpers";
import type { NewsArticle } from "../../store/gameStore";
import { Badge, Card, CardBody, CardHeader } from "../ui";

interface HomeLeagueDigestCardProps {
  articles: NewsArticle[];
  lang: string;
  onNavigate?: (tab: string) => void;
  className?: string;
}

export default function HomeLeagueDigestCard({
  articles,
  lang,
  onNavigate,
  className = "",
}: HomeLeagueDigestCardProps) {
  const { t } = useTranslation();

  return (
    <Card className={className}>
      <CardHeader
        action={
          <button
            type="button"
            onClick={() => onNavigate?.("News")}
            className="text-selected text-caption font-heading font-bold uppercase tracking-label hover:text-selected transition-colors"
          >
            {t("dashboard.news")}
          </button>
        }
      >
        {t("home.leagueDigest")}
      </CardHeader>
      <CardBody padded={false}>
        {articles.length === 0 ? (
          <p className="text-body text-fg-muted p-6 text-center">{t("home.noLeagueDigest")}</p>
        ) : (
          <div className="divide-y divide-line">
            {articles.map((article) => (
              <button
                type="button"
                key={article.id}
                onClick={() => onNavigate?.("News")}
                className="w-full text-left px-4 py-3 hover:bg-hover/50 transition-colors [@media(max-height:820px)]:py-2"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="neutral" size="sm">
                    {t(`news.categories.${article.category}`)}
                  </Badge>
                  <span className="text-caption text-fg-subtle">
                    {formatDateShort(article.date, lang)} - {article.source}
                  </span>
                </div>
                <p className="text-body font-heading font-bold text-fg leading-snug">
                  {article.headline}
                </p>
              </button>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
