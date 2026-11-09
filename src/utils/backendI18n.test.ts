import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n, { i18nReady } from "../i18n";
import { useSettingsStore } from "../store/settingsStore";
import { formatDate } from "../lib/dateFormatting";
import {
  resolveBackendText,
  resolveBackendError,
  resolveMessage,
  resolveAction,
  resolveNewsArticle,
  resolveBoardObjective,
} from "./backendI18n";
import type { MessageData, MessageAction, NewsArticle, BoardObjective } from "../store/gameStore";

const originalSettings = useSettingsStore.getState().settings;
const originalCurrency = useSettingsStore.getState().currency;
const originalSupportedCurrencies = useSettingsStore.getState().supportedCurrencies;

beforeEach(() => {
  useSettingsStore.setState({
    settings: { ...originalSettings, currency: "EUR", language: "en" },
    currency: { code: "EUR", symbol: "€", exchange_rate: 1 },
    supportedCurrencies: {
      EUR: { code: "EUR", symbol: "€", exchange_rate: 1 },
      GBP: { code: "GBP", symbol: "£", exchange_rate: 0.86 },
      USD: { code: "USD", symbol: "$", exchange_rate: 1.08 },
    },
  });
});

afterEach(() => {
  useSettingsStore.setState({
    settings: originalSettings,
    currency: originalCurrency,
    supportedCurrencies: originalSupportedCurrencies,
  });
});

// ---------------------------------------------------------------------------
// Bootstrap i18n with a test key so we can verify resolution works
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await i18nReady;
  i18n.addResourceBundle(
    "en",
    "translation",
    {
      "test.subject": "Resolved Subject",
      "test.body": "Hello {{name}}, welcome!",
      "test.bidBody": "Offer: {{fee}}",
      "test.sender": "The Board",
      "test.senderRole": "Board of Directors",
      "test.actionLabel": "Accept Offer",
      "test.optionLabel": "Encourage them",
      "test.optionDescription": "Show empathy and keep them motivated.",
      "test.headline": "Breaking: {{team}} wins!",
      "test.newsBody": "Match report for {{team}}.",
      "test.source": "OFM Sports",
      "boardObjectives.objective.LeaguePosition": "Finish in the top {{target}}",
      "boardObjectives.objective.Wins": "Win at least {{target}} matches",
      "boardObjectives.objective.GoalsScored": "Score at least {{target}} goals",
      "boardObjectives.objective.FinancialStability":
        "Keep wage spending at or below {{target}}% of budget",
    },
    true,
    true,
  );
});

// ---------------------------------------------------------------------------
// Helpers to build minimal test data
// ---------------------------------------------------------------------------

const makeAction = (overrides: Partial<MessageAction> = {}): MessageAction => ({
  id: "act_1",
  label: "raw label",
  action_type: "Acknowledge",
  resolved: false,
  ...overrides,
});

const makeMessage = (overrides: Partial<MessageData> = {}): MessageData => ({
  id: "msg_1",
  subject: "raw subject",
  body: "raw body",
  sender: "raw sender",
  sender_role: "raw role",
  date: "2026-08-01",
  read: false,
  category: "general",
  priority: "normal",
  actions: [],
  context: { team_id: null, player_id: null, fixture_id: null, match_result: null },
  ...overrides,
});

const makeNewsArticle = (overrides: Partial<NewsArticle> = {}): NewsArticle => ({
  id: "news_1",
  headline: "raw headline",
  body: "raw body",
  source: "raw source",
  date: "2026-08-01",
  category: "match",
  team_ids: [],
  player_ids: [],
  match_score: null,
  read: false,
  ...overrides,
});

const makeBoardObjective = (overrides: Partial<BoardObjective> = {}): BoardObjective => ({
  id: "obj_1",
  description: "raw objective",
  target: 4,
  objective_type: "LeaguePosition",
  met: false,
  ...overrides,
});

// ---------------------------------------------------------------------------
// resolveAction
// ---------------------------------------------------------------------------

describe("resolveAction", () => {
  it("returns action with resolved label when label_key exists", () => {
    const action = makeAction({ label: "fallback", label_key: "test.actionLabel" });
    const result = resolveAction(action);
    expect(result.label).toBe("Accept Offer");
  });

  it("resolves choose-option labels and descriptions when keys exist", () => {
    const action = makeAction({
      action_type: {
        ChooseOption: {
          options: [
            {
              id: "encourage",
              label: "fallback option",
              description: "fallback description",
              label_key: "test.optionLabel",
              description_key: "test.optionDescription",
            },
          ],
        },
      },
    });

    const result = resolveAction(action);

    if (typeof result.action_type !== "object" || !("ChooseOption" in result.action_type)) {
      throw new Error("Expected ChooseOption action type");
    }

    expect(result.action_type.ChooseOption.options[0].label).toBe("Encourage them");
    expect(result.action_type.ChooseOption.options[0].description).toBe(
      "Show empathy and keep them motivated.",
    );
  });

  it("resolves explicit random-event option keys with message interpolation params", () => {
    i18n.addResourceBundle(
      "en",
      "translation",
      {
        be: {
          msg: {
            sponsor: {
              options: {
                accept: {
                  label: "Accept the deal",
                  description: "Receive {{amount}} in sponsorship income.",
                },
              },
            },
          },
        },
      },
      true,
      true,
    );

    const result = resolveMessage(
      makeMessage({
        id: "sponsor_2026-08-01",
        i18n_params: { amount: "250000" },
        actions: [
          makeAction({
            id: "respond",
            label: "Respond",
            action_type: {
              ChooseOption: {
                options: [
                  {
                    id: "accept",
                    label: "fallback option",
                    description: "fallback description",
                    label_key: "be.msg.sponsor.options.accept.label",
                    description_key: "be.msg.sponsor.options.accept.description",
                  },
                ],
              },
            },
          }),
        ],
      }),
    );

    const actionType = result.actions[0].action_type;

    if (typeof actionType !== "object" || !("ChooseOption" in actionType)) {
      throw new Error("Expected ChooseOption action type");
    }

    expect(actionType.ChooseOption.options[0].label).toBe("Accept the deal");
    expect(actionType.ChooseOption.options[0].description).toBe(
      "Receive €250K in sponsorship income.",
    );
  });

  it("converts backend money params inside action descriptions to the selected currency", () => {
    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, currency: "GBP" },
      currency: { code: "GBP", symbol: "£", exchange_rate: 0.86 },
    });

    i18n.addResourceBundle(
      "en",
      "translation",
      {
        be: {
          msg: {
            sponsor: {
              options: {
                accept: {
                  label: "Accept the deal",
                  description: "Receive {{amount}} in sponsorship income.",
                },
              },
            },
          },
        },
      },
      true,
      true,
    );

    const result = resolveMessage(
      makeMessage({
        id: "sponsor_2026-08-01",
        i18n_params: { amount: "250000" },
        actions: [
          makeAction({
            id: "respond",
            label: "Respond",
            action_type: {
              ChooseOption: {
                options: [
                  {
                    id: "accept",
                    label: "fallback option",
                    description: "fallback description",
                    label_key: "be.msg.sponsor.options.accept.label",
                    description_key: "be.msg.sponsor.options.accept.description",
                  },
                ],
              },
            },
          }),
        ],
      }),
    );

    const actionType = result.actions[0].action_type;

    if (typeof actionType !== "object" || !("ChooseOption" in actionType)) {
      throw new Error("Expected ChooseOption action type");
    }

    expect(actionType.ChooseOption.options[0].description).toBe(
      "Receive £215K in sponsorship income.",
    );
  });

  it("does not re-normalize already formatted compact money params from resolveMessage", async () => {
    const previousLanguage = i18n.language;
    const previousSettings = useSettingsStore.getState().settings;
    await i18n.changeLanguage("en");
    useSettingsStore.setState({
      settings: { ...previousSettings, language: "en" },
    });

    i18n.addResourceBundle(
      "en",
      "translation",
      {
        "test.compactActionLabel": "Accept {{amount}}",
      },
      true,
      true,
    );

    try {
      const result = resolveMessage(
        makeMessage({
          id: "compact_money_message",
          i18n_params: { amount: "€1.8M" },
          actions: [
            makeAction({
              id: "accept",
              label: "fallback option",
              label_key: "test.compactActionLabel",
            }),
          ],
        }),
      );

      expect(result.actions[0].label).toBe("Accept €1.8M");
    } finally {
      useSettingsStore.setState({ settings: previousSettings });
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("keeps raw label when label_key is absent", () => {
    const action = makeAction({ label: "Keep Me" });
    const result = resolveAction(action);
    expect(result.label).toBe("Keep Me");
  });

  it("falls back to raw label when key is not found in translations", () => {
    const action = makeAction({ label: "fallback", label_key: "nonexistent.key" });
    const result = resolveAction(action);
    expect(result.label).toBe("fallback");
  });

  it("infers player-event action and option keys for legacy saved messages", () => {
    i18n.addResourceBundle(
      "en",
      "translation",
      {
        be: {
          msg: {
            playerEvent: {
              respond: "Custom Respond",
              options: {
                happyPlayer: {
                  praiseBack: {
                    label: "Custom Praise Back",
                    description: "Custom praise description.",
                  },
                },
              },
            },
          },
        },
      },
      true,
      true,
    );

    const action = makeAction({
      id: "respond",
      label: "Legacy respond",
      action_type: {
        ChooseOption: {
          options: [
            {
              id: "praise_back",
              label: "Legacy praise",
              description: "Legacy description",
            },
          ],
        },
      },
    });

    const result = resolveAction(action, "happy_player_p_fwd0");

    if (typeof result.action_type !== "object" || !("ChooseOption" in result.action_type)) {
      throw new Error("Expected ChooseOption action type");
    }

    expect(result.label).toBe("Custom Respond");
    expect(result.action_type.ChooseOption.options[0].label).toBe("Custom Praise Back");
    expect(result.action_type.ChooseOption.options[0].description).toBe(
      "Custom praise description.",
    );
  });
});

// ---------------------------------------------------------------------------
// resolveMessage
// ---------------------------------------------------------------------------

describe("resolveMessage", () => {
  // Given a failed registration notice with the exact agreed fee, when resolved in the selected currency,
  // then the fee is converted without compact rounding and the registration day is localized.
  it("renders an exact fee and a localized registration day", () => {
    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, currency: "GBP" },
      currency: { code: "GBP", symbol: "£", exchange_rate: 0.86 },
    });

    const result = resolveMessage(
      makeMessage({
        subject_key: "be.msg.transferRegistrationFailed.subject",
        body_key: "be.msg.transferRegistrationFailed.InsufficientFunds",
        i18n_params: {
          player: "Golden Boot",
          buyer: "Alpha FC",
          fee: "800001",
          start: "2026-07-02",
        },
      }),
    );

    expect(result.subject).toBe("Transfer registration failed: Golden Boot");
    expect(result.body).toContain("Golden Boot to Alpha FC for £688,001");
    expect(result.body).toContain("July 2, 2026");
    expect(result.body).not.toContain("2026-07-02");
    expect(result.body).toContain("No transfer fee was paid.");
    expect(result.body).not.toContain("800001");
  });

  // Given a failed registration notice, when rendered, then its date is written out rather than
  // left as the raw ISO value the backend sent.
  it("localizes the failed registration day", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");
    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, language: "en" },
    });
    try {
      const result = resolveMessage(
        makeMessage({
          subject_key: "be.msg.transferRegistrationFailed.subject",
          body_key: "be.msg.transferRegistrationFailed.InsufficientFunds",
          i18n_params: {
            player: "Golden Boot",
            buyer: "Alpha FC",
            fee: "800001",
            start: "2026-07-02",
          },
        }),
      );
      expect(result.body).toContain("July 2, 2026");
      expect(result.body).toContain("€800,001");
      expect(result.body).not.toContain("2026-07-02");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("resolves all translatable fields when keys exist", () => {
    const msg = makeMessage({
      subject: "raw",
      subject_key: "test.subject",
      body: "raw",
      body_key: "test.body",
      sender: "raw",
      sender_key: "test.sender",
      sender_role: "raw",
      sender_role_key: "test.senderRole",
      i18n_params: { name: "Coach" },
      actions: [makeAction({ label: "raw", label_key: "test.actionLabel" })],
    });
    const result = resolveMessage(msg);
    expect(result.subject).toBe("Resolved Subject");
    expect(result.body).toBe("Hello Coach, welcome!");
    expect(result.sender).toBe("The Board");
    expect(result.sender_role).toBe("Board of Directors");
    expect(result.actions[0].label).toBe("Accept Offer");
  });

  it("keeps raw values when no keys are provided", () => {
    const msg = makeMessage({
      subject: "My Subject",
      body: "My Body",
      sender: "Someone",
      sender_role: "Staff",
    });
    const result = resolveMessage(msg);
    expect(result.subject).toBe("My Subject");
    expect(result.body).toBe("My Body");
    expect(result.sender).toBe("Someone");
    expect(result.sender_role).toBe("Staff");
  });

  it("localizes legacy delegated renewal messages without persisted i18n keys", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const msg = makeMessage({
        id: "delegated_renewals_2026-07-01_0",
        subject: "Assistant Report — Contract Renewals",
        body: "Boss, I went through our renewal list at Lisbon Sporting. 4 completed, 2 still pending, 1 failed.\n\nCompleted: Claes agreed to 1 year(s) on €5000/wk.\nStill difficult: Vieira — Their camp want around €25000/wk for 3 years, which is beyond the delegation limits.\nFailed: Fernandes — You told me not to reopen contract talks yet.",
        sender: "Assistant Manager",
        sender_role: "Assistant Manager",
      });

      const result = resolveMessage(msg);

      expect(result.subject).toBe("Assistant Report — Contract Renewals");
      expect(result.sender).toBe("Assistant Manager");
      expect(result.sender_role).toBe("Assistant Manager");
      expect(result.body).toContain(
        "Boss, I went through our renewal list at Lisbon Sporting. 4 completed, 2 still pending, 1 failed.",
      );
      expect(result.body).toContain("Completed: Claes agreed to 1 year(s) on €5K/wk.");
      expect(result.body).toContain(
        "Still difficult: Vieira — Their camp want around €25K/wk for 3 years, which is beyond the delegation limits.",
      );
      expect(result.body).toContain(
        "Failed: Fernandes — You told me not to reopen contract talks yet.",
      );
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("localizes legacy takeover contract review messages without persisted i18n keys", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const msg = makeMessage({
        id: "contract_review_takeover_team-1",
        subject: "Assistant Manager - Contract Review",
        body: "Your assistant has reviewed the squad contracts after your arrival. 2 player(s) are due to come up for renewal this season, but none require an immediate decision today.\n\nStart mapping out who you want to keep so the situation stays under control.",
        sender: "Assistant Manager",
        sender_role: "Assistant Manager",
        actions: [
          makeAction({
            id: "view_squad",
            label: "Review Squad Contracts",
            action_type: {
              NavigateTo: {
                route: "/dashboard?tab=Squad",
              },
            },
          }),
          makeAction({
            id: "ack",
            label: "Acknowledge",
            action_type: "Acknowledge",
          }),
        ],
      });

      const result = resolveMessage(msg);

      expect(result.subject).toBe("Assistant Manager - Contract Review");
      expect(result.sender).toBe("Assistant Manager");
      expect(result.sender_role).toBe("Assistant Manager");
      expect(result.body).toBe(
        "Your assistant has reviewed the squad contracts after your arrival. 2 player(s) are due to come up for renewal this season, but none require an immediate decision today.\n\nStart mapping out who you want to keep so the situation stays under control.",
      );
      expect(result.actions[0].label).toBe("Review Squad Contracts");
      expect(result.actions[1].label).toBe("Understood");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("preserves non-translatable fields", () => {
    const msg = makeMessage({ id: "msg_99", read: true, category: "transfer" });
    const result = resolveMessage(msg);
    expect(result.id).toBe("msg_99");
    expect(result.read).toBe(true);
    expect(result.category).toBe("transfer");
  });

  it("localizes football nationality params inside translated inbox messages", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const msg = makeMessage({
        subject: "raw",
        subject_key: "be.msg.intlCallup.subject",
        body: "raw",
        body_key: "be.msg.intlCallup.body",
        i18n_params: {
          player: "King",
          nationality: "ENG",
        },
      });

      const result = resolveMessage(msg);

      expect(result.subject).toBe("International Call-Up — King");
      expect(result.body).toContain("England national team");
      expect(result.body).not.toContain("ENG");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });
});

// ---------------------------------------------------------------------------
// resolveNewsArticle
// ---------------------------------------------------------------------------

describe("resolveNewsArticle", () => {
  it("resolves all translatable fields with params", () => {
    const article = makeNewsArticle({
      headline: "raw",
      headline_key: "test.headline",
      body: "raw",
      body_key: "test.newsBody",
      source: "raw",
      source_key: "test.source",
      i18n_params: { team: "Test FC" },
    });
    const result = resolveNewsArticle(article);
    expect(result.headline).toBe("Breaking: Test FC wins!");
    expect(result.body).toBe("Match report for Test FC.");
    expect(result.source).toBe("OFM Sports");
  });

  it("keeps raw values when no keys are provided", () => {
    const article = makeNewsArticle({
      headline: "Big News",
      body: "Details here",
      source: "Press",
    });
    const result = resolveNewsArticle(article);
    expect(result.headline).toBe("Big News");
    expect(result.body).toBe("Details here");
    expect(result.source).toBe("Press");
  });

  it("localizes legacy weekly digest headlines that still carry an English weekLabel param", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const article = makeNewsArticle({
        headline: "Weekly Digest — Week of 2026-07-27",
        headline_key: "be.news.weeklyDigest.headline",
        i18n_params: { weekLabel: "Week of 2026-07-27" },
      });

      const result = resolveNewsArticle(article);

      expect(result.headline).toBe("Weekly Digest — Week of 2026-07-27");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("localizes transfer roundup articles through backend keys", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const article = makeNewsArticle({
        headline: "Transfer Roundup — Week of 2026-07-27",
        headline_key: "be.news.transferRoundup.headline",
        body: "The transfer market stayed busy this week.",
        body_key: "be.news.transferRoundup.body",
        source: "Transfer Intelligence",
        source_key: "be.source.transferIntelligence",
        i18n_params: {
          weekStart: "2026-07-27",
          transferCount: "2",
          dealsData: JSON.stringify([
            {
              player: "Adam Smith",
              fromTeam: "Alpha FC",
              toTeam: "Beta FC",
              fee: "€1.8M",
            },
          ]),
        },
      });

      const result = resolveNewsArticle(article);

      expect(result.headline).toBe("Transfer Roundup — Week of 2026-07-27");
      expect(result.body).toContain("2 completed deal(s)");
      expect(result.body).toContain("Adam Smith: Alpha FC -> Beta FC (€1.8M)");
      expect(result.source).toBe("Transfer Intelligence");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("converts transfer roundup fees to the selected currency", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");
    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, currency: "GBP" },
      currency: { code: "GBP", symbol: "£", exchange_rate: 0.86 },
    });

    try {
      const article = makeNewsArticle({
        headline: "Transfer Roundup — Week of 2026-07-27",
        headline_key: "be.news.transferRoundup.headline",
        body: "The transfer market stayed busy this week.",
        body_key: "be.news.transferRoundup.body",
        source: "Transfer Intelligence",
        source_key: "be.source.transferIntelligence",
        i18n_params: {
          weekStart: "2026-07-27",
          transferCount: "1",
          dealsData: JSON.stringify([
            {
              player: "Adam Smith",
              fromTeam: "Alpha FC",
              toTeam: "Beta FC",
              fee: "€1.8M",
            },
          ]),
        },
      });

      const result = resolveNewsArticle(article);

      expect(result.body).toContain("Adam Smith: Alpha FC -> Beta FC (£1.55M)");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("localizes friendly match report scorer sections through backend keys", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const article = makeNewsArticle({
        headline: "Alpha FC 2 - 1 Beta FC: friendly report",
        headline_key: "be.news.matchReport.reportFriendly.title",
        body: "In friendly action, Alpha FC 2-1 Beta FC. Both sides used the fixture to build sharpness before the competitive campaign.\n\nGoals: Alice (10', Alpha FC)",
        body_key: "be.news.matchReport.reportFriendly.body",
        source: "Sports Gazette",
        source_key: "be.source.sportsGazette",
        i18n_params: {
          home: "Alpha FC",
          away: "Beta FC",
          homeGoals: "2",
          awayGoals: "1",
          scorersSection: "\n\nGoals: Alice (10', Alpha FC)",
          scorersData: JSON.stringify([
            {
              player: "Alice",
              minute: 10,
              team: "Alpha FC",
            },
          ]),
        },
      });

      const result = resolveNewsArticle(article);

      expect(result.headline).toBe("Alpha FC 2 - 1 Beta FC: Friendly report");
      expect(result.body).toContain("In friendly action, Alpha FC 2 - 1 Beta FC.");
      expect(result.body).toContain("Goals: Alice (10', Alpha FC)");
      expect(result.source).toBe("Sports Gazette");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  // Given a cup-tie report with one scorer, when it is resolved in German,
  // then it names its competition and lists the scorer instead of ending at the score.
  it("writes the scorers into a competition match report", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const article = makeNewsArticle({
        headline: "",
        headline_key: "be.news.matchReport.reportCompetition.title",
        body: "",
        body_key: "be.news.matchReport.reportCompetition.body",
        source: "",
        source_key: "be.source.sportsGazette",
        i18n_params: {
          home: "Alpha FC",
          away: "Beta FC",
          homeGoals: "2",
          awayGoals: "1",
          competition: "Landespokal",
          scorers: "",
          scorersSection: "",
          scorersData: JSON.stringify([{ player: "Alice", minute: 10, team: "Alpha FC" }]),
        },
      });

      const result = resolveNewsArticle(article);

      expect(result.headline).toBe("Alpha FC 2 - 1 Beta FC: Match report (Landespokal)");
      expect(result.body).toContain("Landespokal: the match ended Alpha FC 2 - 1 Beta FC.");
      expect(result.body).toContain("Goals: Alice (10', Alpha FC)");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  // Given a generated national cup, whose stored name is the English template "Germany Cup",
  // when its report is resolved in German,
  // then the competition is named the way every other screen names it: from its key.
  it("translates a generated competition's name in its match report", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const article = makeNewsArticle({
        headline: "",
        headline_key: "be.news.matchReport.reportCompetition.title",
        body: "",
        body_key: "be.news.matchReport.reportCompetition.body",
        source: "",
        source_key: "be.source.sportsGazette",
        i18n_params: {
          home: "Alpha FC",
          away: "Beta FC",
          homeGoals: "1",
          awayGoals: "0",
          competition: "Germany Cup",
          competitionKey: "tournaments.competitions.nationalCup",
          competitionCountry: "DE",
          competitionSeason: "2026",
          scorers: "",
          scorersSection: "",
          scorersData: "[]",
        },
      });

      const result = resolveNewsArticle(article);

      expect(result.headline).toBe("Alpha FC 1 - 0 Beta FC: Match report (Germany Cup)");
      expect(result.body).toContain("Germany Cup: the match ended");
      // The stored name is the English template, so in English the resolved text matches it.
      // What this pins is that the country came from `competitionCountry` via the key, not from
      // the stored string: a resolver that skipped the key would leave `{{country}}` unfilled.
      expect(result.body).not.toContain("{{");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("localizes league match report scorers from structured scorer data", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const article = makeNewsArticle({
        headline: "Alpha FC 2 - 1 Beta FC: Hosts Triumph",
        headline_key: "be.news.matchReport.headline.homeWin.0",
        body: "In Matchday 5 action, the match ended Alpha FC 2 - 1 Beta FC. The result could have implications on the league standings as the season progresses.\n\nGoals: Alice (10', Alpha FC), Bob (75', Beta FC)",
        body_key: "be.news.matchReport.body0",
        source: "Sports Gazette",
        source_key: "be.source.sportsGazette",
        i18n_params: {
          home: "Alpha FC",
          away: "Beta FC",
          homeGoals: "2",
          awayGoals: "1",
          matchday: "5",
          scorers: "",
          scorersData: JSON.stringify([
            {
              player: "Alice",
              minute: 10,
              team: "Alpha FC",
            },
            {
              player: "Bob",
              minute: 75,
              team: "Beta FC",
            },
          ]),
        },
      });

      const result = resolveNewsArticle(article);

      expect(result.body).toContain("In Matchday 5 action");
      expect(result.body).toContain("Goals: Alice (10', Alpha FC), Bob (75', Beta FC)");
      expect(result.source).toBe("Sports Gazette");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("localizes press conference articles from stored quote metadata", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const article = makeNewsArticle({
        headline: "",
        headline_key: "be.news.pressConference.headlinePressConf",
        body: "",
        body_key: "be.news.pressConference.bodyMultiple",
        source: "",
        source_key: "be.source.sportsDaily",
        i18n_params: {
          team: "Madrid Real",
          result: "Madrid Real 7 - 1 Rome Gladiators",
          quotesData: JSON.stringify([
            {
              key: "match.press.result.responses.win.humble.text",
              fallback: "The players worked hard. We prepared well and executed the game plan.",
              params: {},
            },
            {
              key: "match.press.ahead.responses.focused.text",
              fallback: "First recovery, then preparation. We go one game at a time.",
              params: {},
            },
          ]),
        },
      });

      const result = resolveNewsArticle(article);

      expect(result.headline).toBe(
        'Press Conference: "The players worked hard. We prepared well and executed the game plan." — Madrid Real boss',
      );
      expect(result.body).toContain(
        "Speaking after the Madrid Real 7 - 1 Rome Gladiators result, the Madrid Real manager addressed the press.",
      );
      expect(result.body).toContain(
        '• "The players worked hard. We prepared well and executed the game plan."',
      );
      expect(result.body).toContain(
        '• "Recovery first, then preparation. We take it one game at a time."',
      );
      expect(result.source).toBe("Sports Daily");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("localizes standings entries through backend keys", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const article = makeNewsArticle({
        headline: "Table update",
        headline_key: "be.news.standings.headline2",
        body: "After Matchday 4, Alpha FC sit at the top of the Premier Division table.\n\nStandings:\n  1. Alpha FC — 12 pts (GD: +5)",
        body_key: "be.news.standings.body",
        source: "League Wire",
        source_key: "be.source.leagueWire",
        i18n_params: {
          matchday: "4",
          leader: "Alpha FC",
          standings: "  1. Alpha FC — 12 pts (GD: +5)",
          standingsData: JSON.stringify([
            {
              rank: 1,
              team: "Alpha FC",
              points: 12,
              goal_difference: "+5",
            },
          ]),
        },
      });

      const result = resolveNewsArticle(article);

      expect(result.headline).toBe("Standings Update — Matchday 4");
      expect(result.body).toContain(
        "After Matchday 4, Alpha FC sit at the top of the Premier Division table.",
      );
      expect(result.body).toContain("1. Alpha FC — 12 pts (GD: +5)");
      expect(result.source).toBe("League Wire");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("localizes roundup result lines and biggest winner copy through backend keys", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const article = makeNewsArticle({
        headline: "Premier Division Matchday 4: All the Results",
        headline_key: "be.news.roundup.headline1",
        body: "Matchday 4 is in the books. Here are the full results:\n\n  Alpha FC 3 - 0 Beta FC\n  Gamma FC 1 - 1 Delta FC\n\n5 goals scored across 2 matches. Alpha FC recorded the biggest win of the day.",
        body_key: "be.news.roundup.body",
        source: "League Wire",
        source_key: "be.source.leagueWire",
        i18n_params: {
          matchday: "4",
          totalGoals: "5",
          matchCount: "2",
          results: "  Alpha FC 3 - 0 Beta FC\n  Gamma FC 1 - 1 Delta FC",
          resultsData: JSON.stringify([
            {
              home: "Alpha FC",
              home_goals: 3,
              away: "Beta FC",
              away_goals: 0,
            },
            {
              home: "Gamma FC",
              home_goals: 1,
              away: "Delta FC",
              away_goals: 1,
            },
          ]),
          biggestWinner: "Alpha FC",
        },
      });

      const result = resolveNewsArticle(article);

      expect(result.headline).toBe("Premier Division Matchday 4: All the Results");
      expect(result.body).toContain("Matchday 4 is in the books. Here are the full results:");
      expect(result.body).toContain("Alpha FC 3 - 0 Beta FC");
      expect(result.body).toContain("Gamma FC 1 - 1 Delta FC");
      expect(result.body).toContain("5 goals scored across 2 matches.");
      expect(result.body).toContain("Alpha FC recorded the biggest win of the day.");
      expect(result.source).toBe("League Wire");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("localizes preseason digest result lines and unbeaten copy through backend keys", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const article = makeNewsArticle({
        headline: "Preseason Digest — Week of 2025-08-11",
        headline_key: "be.news.preseasonDigest.headline",
        body: "The latest preseason digest is here. 2 friendly result(s) were played across the division this week, producing 3 goal(s).\n\nResults:\n  Alpha FC 2 - 1 Beta FC\n  Gamma FC 0 - 0 Delta FC\n\nAlpha FC and Gamma FC remain unbeaten in preseason.",
        body_key: "be.news.preseasonDigest.bodyWithResults",
        source: "League Chronicle",
        source_key: "be.source.leagueChronicle",
        i18n_params: {
          weekStart: "2025-08-11",
          resultCount: "2",
          totalGoals: "3",
          results: "  Alpha FC 2 - 1 Beta FC\n  Gamma FC 0 - 0 Delta FC",
          resultsData: JSON.stringify([
            { home: "Alpha FC", home_goals: 2, away: "Beta FC", away_goals: 1 },
            { home: "Gamma FC", home_goals: 0, away: "Delta FC", away_goals: 0 },
          ]),
          unbeatenLine: "\n\nAlpha FC and Gamma FC remain unbeaten in preseason.",
          unbeatenTeamsData: JSON.stringify(["Alpha FC", "Gamma FC"]),
        },
      });

      const result = resolveNewsArticle(article);

      expect(result.headline).toBe("Preseason Digest — Week of 2025-08-11");
      expect(result.body).toContain(
        "2 friendly result(s) were played across the division this week, producing 3 goal(s).",
      );
      expect(result.body).toContain("Alpha FC 2 - 1 Beta FC");
      expect(result.body).toContain("Gamma FC 0 - 0 Delta FC");
      expect(result.body).toContain("Alpha FC and Gamma FC remain unbeaten in preseason.");
      expect(result.source).toBe("League Chronicle");
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("includes every unbeaten team when more than two clubs remain unbeaten", async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage("en");

    try {
      const article = makeNewsArticle({
        headline: "Preseason Digest — Week of 2025-08-11",
        headline_key: "be.news.preseasonDigest.headline",
        body: "The latest preseason digest is here. Training camps, selection decisions, and transfer business continue across the division as clubs prepare for opening day.\n\nAlpha FC, Gamma FC, and Delta FC remain unbeaten in preseason.",
        body_key: "be.news.preseasonDigest.bodyNoResults",
        source: "League Chronicle",
        source_key: "be.source.leagueChronicle",
        i18n_params: {
          weekStart: "2025-08-11",
          unbeatenLine: "\n\nAlpha FC, Gamma FC, and Delta FC remain unbeaten in preseason.",
          unbeatenTeamsData: JSON.stringify(["Alpha FC", "Gamma FC", "Delta FC"]),
        },
      });

      const result = resolveNewsArticle(article);

      expect(result.body).toContain(
        "Alpha FC, Gamma FC, and Delta FC remain unbeaten in preseason.",
      );
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("preserves non-translatable fields", () => {
    const article = makeNewsArticle({ id: "n_5", category: "transfer", read: true });
    const result = resolveNewsArticle(article);
    expect(result.id).toBe("n_5");
    expect(result.category).toBe("transfer");
    expect(result.read).toBe(true);
  });
});

describe("resolveBoardObjective", () => {
  it("resolves objective text from objective_type and target", () => {
    const objective = makeBoardObjective({
      description: "boardObjectives.objective.LeaguePosition",
      target: 6,
      objective_type: "LeaguePosition",
    });

    const result = resolveBoardObjective(objective);

    expect(result.description).toBe("Finish in the top 6");
  });

  it("falls back to raw description for unknown objective types", () => {
    const objective = makeBoardObjective({
      description: "Custom target",
      objective_type: "CustomObjective",
    });

    const result = resolveBoardObjective(objective);

    expect(result.description).toBe("Custom target");
  });
});

describe("resolveBackendText", () => {
  // Given the set-aside-data notice, whose params name the frontend's own labels by key
  // When its body is resolved
  // Then it says where the bug report is in the player's words, as the sidebar and Settings do
  it("names the bug report by the labels the screens show", () => {
    const body = resolveBackendText("be.msg.savedDataSetAside.body", "fallback", {
      settings: "dashboard.settings",
      reportBug: "settings.reportBug",
    });

    expect(body).toContain(`${i18n.t("dashboard.settings")} → ${i18n.t("settings.reportBug")}`);
    expect(body).not.toContain("dashboard.settings");
  });

  it("resolves backend effect keys with params", () => {
    i18n.addResourceBundle(
      "en",
      "translation",
      {
        "test.effect": "Morale {{delta}}",
      },
      true,
      true,
    );

    const result = resolveBackendText("test.effect", "fallback", { delta: "+3" });

    expect(result).toBe("Morale +3");
  });

  it("resolves backend text keys with encoded params", () => {
    i18n.addResourceBundle(
      "en",
      "translation",
      {
        "be.msg.world.exportedDescription":
          "World with {{teamCount}} teams exported from saved game",
      },
      true,
      true,
    );

    const result = resolveBackendText("be.msg.world.exportedDescription?teamCount=18", "fallback");

    expect(result).toBe("World with 18 teams exported from saved game");
  });

  it("resolves the default save name a new career is given", () => {
    const result = resolveBackendText(
      "be.save.defaultName?manager=Jane%20Doe",
      "be.save.defaultName?manager=Jane%20Doe",
    );

    expect(result).toBe("Jane Doe's Career");
  });

  // A save the player renamed, and every save written before the key existed,
  // is plain text and has to survive untouched.
  it("leaves a save name that is not a key alone", () => {
    expect(resolveBackendText("My 1997 run", "My 1997 run")).toBe("My 1997 run");
  });

  // The backend sends an ISO day precisely so the month name is not baked in
  // English; we render it in the player's locale.
  it("formats an ISO `start` param in the active locale", () => {
    i18n.addResourceBundle(
      "en",
      "translation",
      {
        "test.kickoff": "Kicks off on {{start}}",
      },
      true,
      true,
    );

    const result = resolveBackendText("test.kickoff?start=2026-08-01", "fallback");

    expect(result).toBe("Kicks off on August 1, 2026");
  });

  /**
   * Given a language whose date order differs from English
   * When the `start` param is formatted
   * Then it follows that locale. The locale is passed to `formatDate` directly here: English is
   * the only shipped language, and an en-US assertion passes even if the locale never arrives.
   */
  it("formats the `start` param in the locale it is given", () => {
    expect(formatDate("2026-08-01", "de")).toBe("1. August 2026");
    expect(formatDate("2026-08-01", "en")).toBe("August 1, 2026");
  });

  // `parseDateInput` builds the date at *local* noon (no `Z`), so the calendar
  // day survives whatever offset the machine is in — a date-only value must
  // never shift by a day.
  it("keeps the calendar day of a date-only param", () => {
    i18n.addResourceBundle(
      "en",
      "translation",
      {
        "test.kickoff": "Kicks off on {{start}}",
      },
      true,
      true,
    );

    expect(resolveBackendText("test.kickoff?start=2026-01-01", "fallback")).toBe(
      "Kicks off on January 1, 2026",
    );
    expect(resolveBackendText("test.kickoff?start=2026-12-31", "fallback")).toBe(
      "Kicks off on December 31, 2026",
    );
  });

  it("leaves a `start` param that is not a date alone", () => {
    i18n.addResourceBundle(
      "en",
      "translation",
      {
        "test.kickoff": "Kicks off on {{start}}",
      },
      true,
      true,
    );

    const result = resolveBackendText("test.kickoff?start=soon", "fallback");

    expect(result).toBe("Kicks off on soon");
  });
});

describe("resolveBackendError", () => {
  it("resolves backend error keys", () => {
    i18n.addResourceBundle(
      "en",
      "translation",
      {
        "be.error.noActiveGameSession": "No active game session",
      },
      true,
      true,
    );

    expect(resolveBackendError("be.error.noActiveGameSession")).toBe("No active game session");
  });

  it("keeps raw backend errors when no translation key exists", () => {
    expect(resolveBackendError(new Error("Something raw happened"))).toBe("Something raw happened");
  });

  it("resolves encoded backend error params", () => {
    i18n.addResourceBundle(
      "en",
      "translation",
      {
        "be.error.contracts.boardWagePolicy":
          "Renewal blocked by board wage policy. Keep weekly wages near {{budget}} to recover.",
      },
      true,
      true,
    );

    expect(resolveBackendError("be.error.contracts.boardWagePolicy?budget=200000")).toBe(
      "Renewal blocked by board wage policy. Keep weekly wages near €200,000 to recover.",
    );
  });

  it("normalizes non-euro money params into the active currency", () => {
    i18n.addResourceBundle(
      "en",
      "translation",
      {
        "be.error.finance.facilityUpgradeInsufficientFunds":
          "Insufficient funds for this facility upgrade. Need {{amount}}.",
      },
      true,
      true,
    );
    useSettingsStore.setState({
      settings: { ...originalSettings, currency: "USD", language: "en" },
      currency: { code: "USD", symbol: "$", exchange_rate: 1.08 },
    });

    expect(
      resolveBackendError("be.error.finance.facilityUpgradeInsufficientFunds?amount=%C2%A3215000"),
    ).toBe("Insufficient funds for this facility upgrade. Need $270,000.");
  });
});

// Given an agreement with raw backend terms, when displayed, then shared date and currency formatting apply.
describe("accepted deal messages", () => {
  const terms = {
    player: "Golden Boot",
    seller: "Beta FC",
    buyer: "Alpha FC",
    parent: "Beta FC",
    borrower: "Alpha FC",
    start: "2026-07-02",
    end: "2026-12-20",
    contribution: "70",
    fee: "800001",
  };
  const dealMessage = (body: string, subject: string) =>
    makeMessage({
      body_key: body,
      subject_key: subject,
      i18n_params: terms,
    });

  // Given a deferred transfer, when its agreement is read, then its registration day and exact fee are localized.
  it("shows the registration day and exact fee for an agreed transfer", () => {
    const message = resolveMessage(
      dealMessage("be.msg.transferAgreed.body", "be.msg.transferAgreed.subject"),
    );
    expect(message.subject).toBe("Transfer agreed: Golden Boot");
    expect(message.body).toContain("July 2, 2026");
    expect(message.body).toContain("€800,001");
    expect(message.body).toContain("Beta FC");
    expect(message.body).toContain("Alpha FC");
  });
  // Given a completed sale, when its notice is read, then it describes departure rather than joining the seller's squad.
  it("shows a departure notice to the selling manager", () => {
    const message = resolveMessage(
      dealMessage("be.msg.transferComplete.bodySold", "be.msg.transferComplete.subject"),
    );
    expect(message.body).toContain("joined Alpha FC");
    expect(message.body).toContain("€800,001");
    expect(message.body).not.toContain("joined the squad");
  });
  // Given an agreed loan with an option, when read, then both dates, contribution and selected-currency option are displayed.
  it("shows all agreed loan terms in the selected currency", () => {
    useSettingsStore.setState({ currency: { code: "GBP", symbol: "£", exchange_rate: 0.86 } });
    const message = resolveMessage(
      dealMessage("be.msg.loanAgreed.bodyWithOption", "be.msg.loanAgreed.subject"),
    );
    expect(message.subject).toBe("Loan agreed: Golden Boot");
    expect(message.body).toContain("July 2, 2026");
    expect(message.body).toContain("December 20, 2026");
    expect(message.body).toContain("70%");
    expect(message.body).toContain("£688,001");
  });
  // Given a counter that removed the buy option, when read, then the notice explicitly says there is no option.
  it("shows no buy option when the accepted counter dropped it", () => {
    const message = resolveMessage(
      dealMessage("be.msg.loanAgreed.bodyNoOption", "be.msg.loanAgreed.subject"),
    );
    expect(message.body).toContain("No purchase option");
    expect(message.body).toContain("December 20, 2026");
    expect(message.body).not.toContain("800");
  });
  // Given a loan notice carrying two ISO dates, when read, then both are written out and neither
  // leaks the raw value the backend sent.
  it("localizes both loan dates", () => {
    const message = resolveMessage(
      dealMessage("be.msg.loanAgreed.bodyNoOption", "be.msg.loanAgreed.subject"),
    );
    expect(message.body).toContain("July 2, 2026");
    expect(message.body).toContain("December 20, 2026");
    expect(message.body).not.toContain("2026-07-02");
    expect(message.body).not.toContain("2026-12-20");
  });
});

describe("the weekly wage bill in the over-budget message", () => {
  const key = "be.msg.wageOverBudget.body";

  it("shows the bill and the budget the backend sends as whole numbers, compact and precise", () => {
    const text = resolveBackendText(key, "fallback", {
      weeklyWageBill: "1700",
      wageBudget: "1500",
    });

    expect(text).toContain("€1.7K");
    expect(text).toContain("€1.5K");
    expect(text).not.toContain("{{");
  });

  it("still reads a message saved with the old annualWages name and a formatted amount", () => {
    const text = resolveBackendText(key, "fallback", {
      annualWages: "€1.7K",
      wageBudget: "€1.5K",
    });

    expect(text).toContain("€1.7K");
    expect(text).not.toContain("{{");
  });
});

describe("money in inbox and news lines is compact and precise", () => {
  it("shows a whole-number fee with up to three significant digits", () => {
    const text = resolveBackendText("test.bidBody", "fallback", { fee: "1250000" });

    expect(text).toBe("Offer: €1.25M");
  });

  it("converts the whole number to the selected currency before it is shortened", () => {
    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, currency: "USD" },
      currency: { code: "USD", symbol: "$", exchange_rate: 1.08 },
    });

    const text = resolveBackendText("test.bidBody", "fallback", { fee: "1000000" });

    expect(text).toBe("Offer: $1.08M");
  });
});

describe("the loan offer's purchase option", () => {
  const key = "be.msg.loanOffer.body";
  const terms = {
    team: "Alpha FC",
    player: "Golden Boot",
    endDate: "2026-12-31",
    wageContribution: "70",
  };

  it("reads the whole-number option as money, compact and precise", () => {
    expect(resolveBackendText(key, "fallback", { ...terms, buyOption: "1200000" })).toContain(
      "Purchase option: €1.2M.",
    );
    expect(resolveBackendText(key, "fallback", { ...terms, buyOption: "1250000" })).toContain(
      "Purchase option: €1.25M.",
    );
  });

  it("keeps the dash for a loan with no purchase option", () => {
    expect(resolveBackendText(key, "fallback", { ...terms, buyOption: "—" })).toContain(
      "Purchase option: —.",
    );
  });
});

describe("a compact string already in a saved message", () => {
  it("keeps the figure it carries instead of rounding it to one decimal", () => {
    expect(resolveBackendText("test.bidBody", "fallback", { fee: "€1.25M" })).toBe("Offer: €1.25M");
  });
});
