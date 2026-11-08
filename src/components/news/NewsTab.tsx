import { useState, useEffect } from "react";
import type { GameStateData, NewsArticle } from "../../store/gameStore";
import {
  Newspaper,
  Trophy,
  BarChart3,
  TrendingUp,
  ArrowLeftRight,
  FileText,
  ArrowLeft,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { resolveNewsArticle } from "../../utils/backendI18n";
import ContextMenu, { type ContextMenuItem } from "../ContextMenu";
import { buildViewTeamMenuItem } from "../playerActions/playerContextMenuItems";
import AwardsCeremonyScreen from "../season/AwardsCeremonyScreen";
import { Select } from "../ui";
import { fetchNewsFeed, type NewsFeed } from "../../services/newsService";
import { isNewsArticleVisible } from "../../utils/newsVisibility";
import { formatMatchDate as fmtMatchDate } from "../../lib/helpers";

const CAT_ICONS: Record<string, React.ReactNode> = {
  MatchReport: <Newspaper className="w-4 h-4" />,
  LeagueRoundup: <Trophy className="w-4 h-4" />,
  StandingsUpdate: <BarChart3 className="w-4 h-4" />,
  TransferRumour: <TrendingUp className="w-4 h-4" />,
  TransferRoundup: <ArrowLeftRight className="w-4 h-4" />,
  InjuryNews: <FileText className="w-4 h-4" />,
  SeasonPreview: <FileText className="w-4 h-4" />,
  Editorial: <FileText className="w-4 h-4" />,
  ManagerialChange: <FileText className="w-4 h-4" />,
};
const CAT_COLORS: Record<string, string> = {
  MatchReport: "text-primary-500",
  LeagueRoundup: "text-accent-500",
  StandingsUpdate: "text-blue-500",
  TransferRumour: "text-purple-500",
  TransferRoundup: "text-fuchsia-500",
  InjuryNews: "text-red-500",
  SeasonPreview: "text-emerald-500",
  Editorial: "text-gray-500",
  ManagerialChange: "text-orange-500",
};
const CAT_BG: Record<string, string> = {
  MatchReport: "bg-primary-500/10",
  LeagueRoundup: "bg-accent-500/10",
  StandingsUpdate: "bg-blue-500/10",
  TransferRumour: "bg-purple-500/10",
  TransferRoundup: "bg-fuchsia-500/10",
  InjuryNews: "bg-red-500/10",
  SeasonPreview: "bg-emerald-500/10",
  Editorial: "bg-gray-500/10",
  ManagerialChange: "bg-orange-500/10",
};

interface NewsTabProps {
  gameState: GameStateData;
  onSelectTeam?: (id: string) => void;
}

const PAGE_SIZE = 13; // 1 hero + 12 grid (4x3)

function buildArticleTeamMenuItems(
  t: ReturnType<typeof useTranslation>["t"],
  article: NewsArticle,
  teamNames: Record<string, string>,
  onSelectTeam?: (id: string) => void,
): ContextMenuItem[] {
  if (!onSelectTeam) {
    return [];
  }

  return (article.team_ids ?? []).map((teamId) => ({
    ...buildViewTeamMenuItem(t, () => onSelectTeam(teamId)),
    label: `${t("common.viewTeam")}: ${teamNames[teamId] ?? teamId}`,
  }));
}

function isSeasonAwardsArticle(article: NewsArticle): boolean {
  return article.id.startsWith("season_awards_");
}

function seasonFromArticle(article: NewsArticle): number {
  const seasonParam = article.i18n_params?.season;
  if (seasonParam) {
    const parsed = Number.parseInt(seasonParam, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const suffix = article.id.replace("season_awards_", "");
  const parsed = Number.parseInt(suffix, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function NewsTab({ gameState, onSelectTeam }: NewsTabProps) {
  const { t } = useTranslation();
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterTeamId, setFilterTeamId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [feed, setFeed] = useState<NewsFeed | null>(null);

  const currentDate = gameState.clock?.current_date;

  useEffect(() => {
    let cancelled = false;
    fetchNewsFeed()
      .then((result) => {
        if (!cancelled) setFeed(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentDate]);

  // Use slice data when available; fall back to gameState while loading. The
  // fallback is unfiltered, so drop future-dated articles (e.g. a World Cup
  // kickoff dated at kickoff) the way the backend feed already does.
  const rawArticles = (feed?.articles ?? gameState.news ?? []).filter((a) =>
    isNewsArticleVisible(a.date, currentDate),
  );
  const fallbackTeamNames: Record<string, string> = Object.fromEntries(
    (gameState.teams ?? []).map((t) => [t.id, t.name]),
  );
  const teamNames: Record<string, string> = feed?.team_names ?? fallbackTeamNames;
  const leagueName = feed?.league_name ?? gameState.league?.name ?? "";

  const news = rawArticles.map(resolveNewsArticle);
  const sortedNews = [...news].sort((a, b) => b.date.localeCompare(a.date));
  const categories = Array.from(new Set(sortedNews.map((n) => n.category)));

  // Collect teams that appear in news for the team filter
  const newsTeamIds = Array.from(new Set(sortedNews.flatMap((n) => n.team_ids || [])));
  const teamsInNews = newsTeamIds
    .map((id) => ({ id, name: teamNames[id] ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let filtered = sortedNews;
  if (filterCategory) filtered = filtered.filter((n) => n.category === filterCategory);
  if (filterTeamId) filtered = filtered.filter((n) => (n.team_ids || []).includes(filterTeamId));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageArticles = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const selectedArticle = selectedId
    ? filtered.find((a) => a.id === selectedId) || sortedNews.find((a) => a.id === selectedId)
    : null;

  // Empty state
  if (sortedNews.length === 0) {
    return (
      <div className="text-center py-16">
        <Newspaper className="w-12 h-12 text-gray-300 dark:text-navy-600 mx-auto mb-3" />
        <p className="text-fg-muted text-body">{t("news.noNews")}</p>
        <p className="text-fg-subtle text-caption mt-1">{t("news.newsWillAppear")}</p>
      </div>
    );
  }

  // Article detail view
  if (selectedArticle) {
    if (isSeasonAwardsArticle(selectedArticle)) {
      return (
        <AwardsCeremonyScreen
          season={seasonFromArticle(selectedArticle)}
          leagueName={leagueName}
          gameState={gameState}
          article={selectedArticle}
          onBack={() => setSelectedId(null)}
          onSelectTeam={onSelectTeam}
        />
      );
    }

    return (
      <ArticleDetail
        article={selectedArticle}
        teamNames={teamNames}
        onBack={() => setSelectedId(null)}
        onSelectTeam={onSelectTeam}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Category pills */}
        <button
          type="button"
          onClick={() => {
            setFilterCategory(null);
            setPage(0);
          }}
          className={`px-3 py-1.5 rounded-full text-caption font-heading font-bold uppercase tracking-label transition-colors ${
            !filterCategory
              ? "bg-primary-500 text-white shadow-sm"
              : "bg-gray-100 dark:bg-navy-700 text-fg-muted hover:bg-hover"
          }`}
        >
          {t("common.all")}
        </button>
        {categories.map((cat) => (
          <button
            type="button"
            key={cat}
            onClick={() => {
              setFilterCategory(filterCategory === cat ? null : cat);
              setPage(0);
            }}
            className={`px-3 py-1.5 rounded-full text-caption font-heading font-bold uppercase tracking-label transition-colors ${
              filterCategory === cat
                ? "bg-primary-500 text-white shadow-sm"
                : "bg-gray-100 dark:bg-navy-700 text-fg-muted hover:bg-hover"
            }`}
          >
            {t(`news.categories.${cat}`)}
          </button>
        ))}

        {/* Team filter dropdown */}
        {teamsInNews.length > 1 && (
          <div className="relative ml-auto flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <Select
              value={filterTeamId || ""}
              onChange={(e) => {
                setFilterTeamId(e.target.value || null);
                setPage(0);
              }}
              variant="subtle"
              selectSize="sm"
              className="min-w-40 font-heading font-bold uppercase tracking-label"
            >
              <option value="">{t("players.allTeams")}</option>
              {teamsInNews.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {!teamsInNews.length && (
          <span className="text-caption text-fg-subtle ml-auto">
            {t("news.nArticles", { count: filtered.length })}
          </span>
        )}
      </div>

      {/* Hero article — latest/featured */}
      {pageArticles.length > 0 && (
        <HeroArticle
          article={pageArticles[0]}
          teamNames={teamNames}
          onSelect={() => setSelectedId(pageArticles[0].id)}
          onSelectTeam={onSelectTeam}
        />
      )}

      {/* Article grid */}
      {pageArticles.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageArticles.slice(1).map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              teamNames={teamNames}
              onSelect={() => setSelectedId(article.id)}
              onSelectTeam={onSelectTeam}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="p-2 rounded-control bg-gray-100 dark:bg-navy-700 text-fg-muted hover:bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-caption font-heading font-bold uppercase tracking-label text-fg-muted">
            {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="p-2 rounded-control bg-gray-100 dark:bg-navy-700 text-fg-muted hover:bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function HeroArticle({
  article,
  teamNames,
  onSelect,
  onSelectTeam,
}: {
  article: NewsArticle;
  teamNames: Record<string, string>;
  onSelect: () => void;
  onSelectTeam?: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const formatNewsDate = (d: string) => fmtMatchDate(d, i18n.language);
  const contextItems = buildArticleTeamMenuItems(t, article, teamNames, onSelectTeam);
  const meta = {
    icon: CAT_ICONS[article.category] || <FileText className="w-4 h-4" />,
    color: CAT_COLORS[article.category] || "text-gray-500",
    bg: CAT_BG[article.category] || "bg-gray-500/10",
    label: t(`news.categories.${article.category}`),
  };

  const articleButton = (
    <button
      type="button"
      data-testid={`news-article-${article.id}`}
      onClick={onSelect}
      className="w-full text-left bg-panel rounded-panel border border-line shadow-sm overflow-hidden hover:shadow-md dark:hover:border-navy-600 transition-all group"
    >
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 text-caption font-heading font-bold uppercase tracking-labelst px-2.5 py-1 rounded-full ${meta.color} ${meta.bg}`}
          >
            {meta.icon}
            {meta.label}
          </span>
          <span className="text-caption text-fg-subtle flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatNewsDate(article.date)}
          </span>
        </div>

        <h2 className="text-title font-heading font-bold text-fg leading-tight mb-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {article.headline}
        </h2>

        {/* Match score badge */}
        {article.match_score && (
          <div className="flex items-center gap-3 mb-3 p-3 bg-gray-50 dark:bg-navy-700/50 rounded-control">
            <span className="text-body font-heading font-bold text-fg">
              {teamNames[article.match_score.home_team_id] ?? article.match_score.home_team_id}
            </span>
            <span className="text-lead font-heading font-bold text-primary-500 bg-primary-500/10 px-3 py-1 rounded-control">
              {article.match_score.home_goals} – {article.match_score.away_goals}
            </span>
            <span className="text-body font-heading font-bold text-fg">
              {teamNames[article.match_score.away_team_id] ?? article.match_score.away_team_id}
            </span>
          </div>
        )}

        <p className="text-body text-fg-muted line-clamp-3 leading-relaxed">{article.body}</p>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-line">
          <p className="text-caption text-gray-400 dark:text-gray-600 font-heading uppercase tracking-labelst">
            — {article.source}
          </p>
          {(article.team_ids ?? []).length > 0 && onSelectTeam && (
            <div className="flex gap-1.5">
              {(article.team_ids ?? []).slice(0, 3).map((tid) => (
                <span
                  key={tid}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTeam(tid);
                  }}
                  className="text-caption font-heading font-bold uppercase tracking-label text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 bg-primary-500/5 hover:bg-primary-500/10 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                >
                  {teamNames[tid] ?? tid}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );

  if (contextItems.length > 0) {
    return <ContextMenu items={contextItems}>{articleButton}</ContextMenu>;
  }

  return articleButton;
}

function ArticleCard({
  article,
  teamNames,
  onSelect,
  onSelectTeam,
}: {
  article: NewsArticle;
  teamNames: Record<string, string>;
  onSelect: () => void;
  onSelectTeam?: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const formatNewsDate = (d: string) => fmtMatchDate(d, i18n.language);
  const contextItems = buildArticleTeamMenuItems(t, article, teamNames, onSelectTeam);
  const meta = {
    icon: CAT_ICONS[article.category] || <FileText className="w-4 h-4" />,
    color: CAT_COLORS[article.category] || "text-gray-500",
    bg: CAT_BG[article.category] || "bg-gray-500/10",
    label: t(`news.categories.${article.category}`),
  };

  const articleButton = (
    <button
      type="button"
      data-testid={`news-article-${article.id}`}
      onClick={onSelect}
      className="w-full text-left bg-panel rounded-panel border border-line shadow-sm overflow-hidden hover:shadow-md dark:hover:border-navy-600 transition-all group flex flex-col"
    >
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center gap-1 text-[9px] font-heading font-bold uppercase tracking-labelst px-2 py-0.5 rounded-full ${meta.color} ${meta.bg}`}
          >
            {meta.icon}
            {meta.label}
          </span>
        </div>

        <h3 className="text-body font-heading font-bold text-fg leading-snug mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {article.headline}
        </h3>

        {article.match_score && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-caption font-medium text-fg-muted">
              {teamNames[article.match_score.home_team_id] ?? article.match_score.home_team_id}
            </span>
            <span className="text-caption font-heading font-bold text-primary-500 bg-primary-500/10 px-1.5 py-0.5 rounded">
              {article.match_score.home_goals} – {article.match_score.away_goals}
            </span>
            <span className="text-caption font-medium text-fg-muted">
              {teamNames[article.match_score.away_team_id] ?? article.match_score.away_team_id}
            </span>
          </div>
        )}

        <p className="text-caption text-fg-muted line-clamp-2 leading-relaxed flex-1">
          {article.body}
        </p>

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-line">
          <span className="text-caption text-gray-400 dark:text-gray-600 font-heading uppercase tracking-labelst">
            {article.source}
          </span>
          <span className="text-caption text-fg-subtle flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatNewsDate(article.date)}
          </span>
        </div>
      </div>
    </button>
  );

  if (contextItems.length > 0) {
    return <ContextMenu items={contextItems}>{articleButton}</ContextMenu>;
  }

  return articleButton;
}

function ArticleDetail({
  article,
  teamNames,
  onBack,
  onSelectTeam,
}: {
  article: NewsArticle;
  teamNames: Record<string, string>;
  onBack: () => void;
  onSelectTeam?: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const formatNewsDate = (d: string) => fmtMatchDate(d, i18n.language);
  const meta = {
    icon: CAT_ICONS[article.category] || <FileText className="w-4 h-4" />,
    color: CAT_COLORS[article.category] || "text-gray-500",
    bg: CAT_BG[article.category] || "bg-gray-500/10",
    label: t(`news.categories.${article.category}`),
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-caption font-heading font-bold uppercase tracking-label text-fg-muted hover:text-primary-500 dark:hover:text-primary-400 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("news.backToNews")}
      </button>

      <article className="bg-panel rounded-panel border border-line shadow-sm overflow-hidden">
        <div className="p-8">
          {/* Category + date */}
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`inline-flex items-center gap-1.5 text-caption font-heading font-bold uppercase tracking-labelst px-2.5 py-1 rounded-full ${meta.color} ${meta.bg}`}
            >
              {meta.icon}
              {meta.label}
            </span>
            <span className="text-caption text-fg-subtle flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatNewsDate(article.date)}
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-title font-heading font-bold text-fg leading-tight mb-4">
            {article.headline}
          </h1>

          {/* Match score */}
          {article.match_score && (
            <div className="flex items-center justify-center gap-4 mb-6 p-4 bg-gray-50 dark:bg-navy-700/50 rounded-panel">
              <div className="text-center">
                <p className="text-body font-heading font-bold text-fg">
                  {teamNames[article.match_score.home_team_id] ?? article.match_score.home_team_id}
                </p>
              </div>
              <div className="text-title font-heading font-bold text-primary-500 bg-primary-500/10 px-4 py-2 rounded-panel">
                {article.match_score.home_goals} – {article.match_score.away_goals}
              </div>
              <div className="text-center">
                <p className="text-body font-heading font-bold text-fg">
                  {teamNames[article.match_score.away_team_id] ?? article.match_score.away_team_id}
                </p>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="text-body text-fg whitespace-pre-line leading-relaxed">
            {article.body}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-line flex items-center justify-between">
            <p className="text-caption text-gray-400 dark:text-gray-600 font-heading uppercase tracking-labelst">
              — {article.source}
            </p>
            {(article.team_ids ?? []).length > 0 && onSelectTeam && (
              <div className="flex flex-wrap gap-2">
                {(article.team_ids ?? []).map((tid) => (
                  <button
                    type="button"
                    key={tid}
                    onClick={() => onSelectTeam(tid)}
                    className="text-caption font-heading font-bold uppercase tracking-label text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 bg-primary-500/5 hover:bg-primary-500/10 px-2.5 py-1 rounded-md transition-colors"
                  >
                    {teamNames[tid] ?? tid}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
