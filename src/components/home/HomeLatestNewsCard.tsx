import { Newspaper } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatDateShort, getTeamName } from "../../lib/helpers";
import type { NewsArticle, TeamData } from "../../store/gameStore";
import { Card, CardBody, CardHeader } from "../ui";

interface HomeLatestNewsCardProps {
  articles: NewsArticle[];
  teams: TeamData[];
  lang: string;
  onNavigate?: (tab: string) => void;
}

export default function HomeLatestNewsCard({
  articles,
  teams,
  lang,
  onNavigate,
}: HomeLatestNewsCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader
        action={
          <button
            type="button"
            onClick={() => onNavigate?.("News")}
            className="text-primary-500 dark:text-primary-400 text-caption font-heading font-bold uppercase tracking-label hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
          >
            {t("home.allNews")}
          </button>
        }
      >
        {t("home.latestNews")}
      </CardHeader>
      <CardBody className="p-0">
        {articles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <Newspaper className="w-8 h-8 text-gray-300 dark:text-navy-600" />
            <p className="text-caption text-fg-muted">{t("home.noNews")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-navy-600">
            {articles.map((article) => (
              <button
                type="button"
                key={article.id}
                onClick={() => onNavigate?.("News")}
                className="w-full text-left px-4 py-3 hover:bg-hover/50 transition-colors"
              >
                <p className="text-caption text-fg-subtle mb-0.5">
                  {formatDateShort(article.date, lang)} - {article.source}
                </p>
                <p className="text-body font-heading font-bold text-fg leading-snug line-clamp-2">
                  {article.headline}
                </p>
                {article.match_score && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-caption text-fg-muted">
                      {getTeamName(teams, article.match_score.home_team_id)}
                    </span>
                    <span className="text-caption font-heading font-bold text-primary-500">
                      {article.match_score.home_goals}-{article.match_score.away_goals}
                    </span>
                    <span className="text-caption text-fg-muted">
                      {getTeamName(teams, article.match_score.away_team_id)}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
