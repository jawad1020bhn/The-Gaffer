# Game UI redesign plan

- **Status:** implementation in progress — first vertical slice shipped; see [GAME_UI_REDESIGN_STATUS.md](GAME_UI_REDESIGN_STATUS.md) — 8 November 2026
- **Direction:** modern football HUD, inspired by Ninty's newer desktop shell
- **Scope:** the complete player-facing UI, including career creation, management, matchday, settings and the world editor
- **Presentation:** one dedicated dark game theme; no parallel light theme to maintain

The objective is to make OpenFoot Manager feel like **a football manager's command centre**, not a website with a sidebar. The game should communicate where the manager is, what needs attention, what happens next, and which action moves the career forward.

This document is a plan, not a record of implemented changes. The wireframes describe hierarchy, not final pixel dimensions.

---

## 1. Decisions and boundaries

### Chosen direction

- Graphite and charcoal surfaces, a sharp lime action accent, restrained metallic detail, angular panels and strong condensed headings.
- Horizontal primary game sections with contextual sub-navigation, replacing the long dashboard sidebar.
- A persistent career-status strip and a persistent, contextual command bar.
- A composed Career Hub rather than a collection of equally important dashboard cards.
- A dedicated broadcast-style match presentation, distinct from career navigation.
- A native React/Tailwind implementation using the existing application state, services and accessible primitives.

### What “dark only” means

The normal presentation is dark everywhere, including dialogs, loading states, the world editor and error fallbacks. We remove the light/dark choice rather than leaving a half-supported second appearance.

**High contrast is not a light theme and stays.** Keyboard operation, screen-reader semantics, all supported languages, UI scaling and reduced motion remain release requirements. The existing compact-density CSS capability should become an explicit player preference.

### What this programme does not include

- No match-engine, transfer-rule, training-rule or save-format rewrite.
- No licensed club database, crests, faces, stadium photography or branding imported from Ninty.
- No browser/server product, account system or change of desktop runtime.
- No controller/gamepad mapping in this pass. Keyboard navigation is designed so controller support could be added later.
- No fake weather, countdowns, player-tracking dots, probabilities or financial indicators that the game does not actually supply.
- No permanent “classic UI” toggle. Rollback is through tested, reversible implementation stages, not two divergent interfaces shipped together.

---

## 2. Current-state audit

The repository already has useful foundations: role tokens, bundled fonts, accessible controls, a style guide and a real-page development harness. The redesign should replace the dashboard composition, not discard those foundations.

| Finding in the current checkout | Consequence | Plan response |
|---|---|---|
| `src/pages/Dashboard.tsx` composes `DashboardSidebar`, `DashboardHeader` and a scrolling workspace. The sidebar exposes 19 career destinations, including the manager profile. | Navigation consumes permanent width and gives most destinations equal visual weight. | Five top-level sections, contextual destinations, and one typed navigation registry. |
| `src/components/home/HomeTab.tsx` stacks a next-match row, four secondary cards, objectives, availability, news, messages and other conditional content. | The screen reads as a dashboard feed; the main decision competes with summaries. | One matchday/briefing focal point, one club-pulse panel, and a short actionable briefing. |
| `DashboardHeader.tsx` combines page title, date, search, save and Continue. | Career status and the forward action are tied to a website-like header. | Separate identity/status information from commands; move the career forward action to the bottom command bar. |
| `src/components/match/MatchScreenLayout.tsx` and `MatchLive.tsx` still contain raw light/dark palette styling. Match controls and key events occupy a permanent right column. | Matchday does not yet share the newer token vocabulary and can feel like another dashboard. | A dedicated match frame, scoreboard, event stage and touchline controls, built on shared tokens. |
| `src/components/tactics/TacticsTab.tsx` uses three permanent columns at a wide breakpoint. | The pitch loses space and the layout conflicts with the documented two-panel preference. | Pitch plus inspector as the two main regions; roster/bench selection lives inside the roster region or a drawer. |
| `src/designSystem.test.ts` covers only listed finished folders. A source scan found raw palette classes in many remaining files. | A token-only change will not reliably restyle the whole app. | Migrate every player-facing surface in batches; expand enforcement as each batch passes. |
| `ThemeContext.tsx` reads `ofm-theme` from local storage, while Settings writes `settings.theme` through the backend. | Changing only the default settings value would not remove the actual theme switch. | Retire both theme-selection paths deliberately and test old preferences. |
| The page harness currently covers Home, Squad, Players, Teams, Managers and Staff. | Most redesigned routes lack repeatable visual coverage. | Expand the harness before the broad rollout; add setup, match and editor states. |
| `src-tauri/tauri.conf.json` opens at 1280×800 with a 960×640 minimum. Linux still uses WebKitGTK. | A 1050px-only shell or expensive visual effects would be a regression. | Responsive game chrome at every supported window size; measure the actual desktop runtime. |

The checked-in screenshots are useful historical evidence, but the source audit above is the implementation baseline. Phase 0 captures fresh screenshots before changes.

---

## 3. What to borrow from Ninty

Reference inspected: [`jawad1020bhn/Ninty` at `cba8ccb`](https://github.com/jawad1020bhn/Ninty/tree/cba8ccb931f80c31a720584f99297046c4c36d64).

The repository contains more than one visual layer. The newer [`game-shell.css`](https://github.com/jawad1020bhn/Ninty/blob/cba8ccb931f80c31a720584f99297046c4c36d64/static/game-shell.css) and [`game-shell.js`](https://github.com/jawad1020bhn/Ninty/blob/cba8ccb931f80c31a720584f99297046c4c36d64/static/game-shell.js) provide the horizontal shell. The older `game-skin.*` and `hud-ui.css` contain cyan HUD and navy/gold variants. We use the **newer shell's structure and graphite/lime direction**, not a mixture of every skin.

| Borrow | Do not transplant |
|---|---|
| Top-level football sections and a contextual second navigation row. | DOM scanning, mutation observers, reparenting existing nodes and CSS overrides against a 2.8 MB HTML page. |
| A fixed application frame with independently scrolling content. | Hidden scrollbars, hidden home panels, or a desktop-only media query that strands smaller windows. |
| Strong club identity, match hierarchy, compact status information and a clear forward action. | Tiny 8–11px labels, pervasive glow, CRT scanlines, artificial boot progress and constant pulsing. |
| Section memory, keyboard movement, visible focus and a return path. | Treating every route as an ARIA tab panel regardless of whether the panel is mounted. |
| Consistent football iconography and restrained angular framing. | Ninty branding, proprietary-looking assets, real-world data packs or remote font requests. |

**Reuse boundary:** no reference code or assets enter this repository in this plan. At the inspected revision there is no root licence file returned by GitHub's licence endpoint, and the README describes a private modified build with redistribution restrictions. Visual inspiration is the safe default. Any later code/asset reuse needs an explicit compatible licence and provenance record; the project's GPLv3 obligations still apply.

---

## 4. The career shell

### Structural wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ OFM │ CAREER   TEAM   TRANSFERS   COMPETITIONS   OFFICE │ Search  Settings │
├──────────────────────────────────────────────────────────────────────────────┤
│ TEAM            Squad · Tactics · Training · Staff · Youth                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Crest  Club / competition     Date     Next fixture     Inbox     Budget     │
├──────────────────────────────────────────────────────────────────────────────┤
│ SQUAD / screen heading                         Screen-specific tools/action  │
│                                                                              │
│                         ONE CONTENT SCROLL REGION                            │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Back / shortcut hints             Save state          Mode selector │ CONTINUE│
└──────────────────────────────────────────────────────────────────────────────┘
```

At the default scale, aim for approximately 3.5rem primary navigation, 2.75rem contextual navigation, 3rem career status and 3.25rem command chrome. These are starting tokens, not fixed pixel rules. The content must remain usable when chrome grows with UI scale.

### Navigation mapping: no existing destination lost

| Primary section | Contextual destinations | Existing tab IDs |
|---|---|---|
| **Career** | Hub, Manager | `Home`, `Manager` |
| **Team** | Squad, Tactics, Training, Staff, Youth | `Squad`, `Tactics`, `Training`, `Staff`, `Youth` |
| **Transfers** | My deals, Market, Scouting, Player database | `Transfers`, `TransferCentre`, `Scouting`, `Players` |
| **Competitions** | Fixtures, Competitions, Clubs, Managers, Hall of fame | `Schedule`, `Tournaments`, `Teams`, `Managers`, `HallOfFame` |
| **Office** | Inbox, News, Finances | `Inbox`, `News`, `Finances` |

Settings and exit live in the utility menu, not a sixth football section. Search can open any destination or entity without duplicating it in navigation.

### Content-preservation contract

Reorganisation is not permission to delete functionality. Every current route, destination, player-visible information field and action must remain reachable after its migration, including profile views, dialogs and conditional career states. A missing item blocks the phase unless its removal has been explicitly approved.

The Career Hub may consolidate duplicate summaries, but the complete messages, articles, fixtures, results and statistics remain available in their full screens. We will not hide content merely to reproduce the reference's single-screen layout; overflow scrolls accessibly.

Career saves, player/club data, world packages and unrelated preferences are not rewritten by the visual migration. The intentional exceptions are the selected retirement of the light appearance and the obsolete theme/sidebar controls, with the settings compatibility migration in §7.

Each implementation phase compares a before/after inventory of destinations, content sections and actions, alongside behaviour tests and screenshots. “All links work” alone is not sufficient: the information and actions behind them must still be present.

Navigation behaviour:

- One registry owns destination ID, section, translation key, icon identity and club-employment availability. The current sidebar list and Dashboard title map must stop being separate authorities.
- Selecting a section opens its last valid destination, or its first available destination. Remember this per career session; do not write a settings update on every navigation click.
- Inbox retains its unread count. Urgent attention is expressed with words/icons, not just a coloured dot.
- Player and club profiles preserve the existing `dashboardProfileNavigation` history. Back returns to the originating screen/profile, not blindly to Home.
- Unemployed managers keep world, inbox and job-related paths; club-only destinations follow the existing availability rules.
- At narrow widths or large scales, collapse the brand copy and secondary status first. Navigation may use an accessible overflow menu or its own bounded scroll area; the document must never scroll sideways.
- Use navigation semantics and `aria-current="page"` for career destinations. Reuse the roving-focus helper where appropriate. Keep the existing `Tabs` primitive for actual in-screen tab panels.

### Persistent status versus commands

**Status strip:** club crest/name/competition, current date, next fixture, visible unread count, and available transfer budget. Use `Team.transfer_budget`, the existing fixture helpers and the existing unread-count projection. Format money through the existing currency helpers. Show an em dash and an accessible unknown/unavailable label when data is absent; never invent a budget for an unemployed manager.

**Command bar:** one Continue action, its existing mode selector, contextual Back, and quiet save feedback. It calls the existing `useAdvanceTime` and save handlers. It does not implement a second advance flow.

- Continue keeps match-day confirmation, blocking-action dialogs, streaming digest, delegate/spectator/live modes and season-end behaviour.
- While advancing, the action is disabled and clearly labelled. A blocker dialog owns focus and the next decision.
- The next-fixture status item opens information; it does not secretly advance time.
- Save Career and Save Tactic remain distinct actions with distinct labels.
- No career Continue button appears on the main menu, world editor or live match screen.

---

## 5. Visual language: “Matchday Command”

### Initial palette direction

These are proposed token values for Phase 0 validation, not colours to scatter through components.

| Role | Starting value | Usage |
|---|---|---|
| `page` | `#080d13` | Application background |
| `chrome` | `#101821` | Primary navigation and command frame |
| `panel` | `#111a24` | Main panels and dialogs |
| `sunken` / raised inset | `#0c131c` / `#182431` | Table wells / selected tactical surfaces |
| `line` | `#2a3947` | Quiet separation; stronger interactive boundaries tested separately |
| `fg` / `fg-muted` | `#edf1f4` / tested accessible muted value | Reading hierarchy |
| Action accent | `#c1ed4b` | Primary action and selected navigation edge |
| Action ink | `#131b0b` | Text/icons on the lime action fill |
| `focus` | High-contrast lime-derived token | One visible focus language across surfaces |

Keep semantic status and backend-selected rating tones distinct from the action accent. Lime does not mean “good”, “selected”, “fresh” and “primary” simultaneously. Club colours remain data and must not repaint the entire interface or compromise text contrast.

### Form, type and motion

- Keep bundled Barlow Condensed headings and Inter body text, including Cyrillic and CJK fallbacks. No network font dependency.
- Retain the 12px minimum at normal scale. Add only deliberate role sizes for a screen title and scoreboard if the existing scale cannot express them; all remain rem-based.
- Replace ubiquitous rounded-xl cards with a small panel radius, optional corner cuts on feature panels, and thin edge highlights. Buttons stay recognisable and comfortably clickable.
- Use one dominant focal module per screen. Ordinary data panels do not all get neon borders, large shadows or oversized numbers.
- Use existing Lucide icons initially. Consider a small original football emblem set only where Lucide lacks a needed concept; do not import a second general-purpose icon library.
- Hover/press feedback is immediate; screen transitions target 120–180ms opacity/translation. No animated background grid, permanent glow pulse or full-screen blur.
- Respect reduced motion. A match event may highlight once, but information must be readable without seeing the animation.
- Texture, if used, is a lightweight static treatment behind the main menu or match hero, never over body text or table rows.

---

## 6. Screen-by-screen direction

### 6.1 Career Hub

```text
┌──────────────────────────────────────────────┬───────────────────────────────┐
│ NEXT MATCH / SEASON MOMENT                   │ CLUB PULSE                    │
│ Crest       competition/date       Crest     │ League position and form      │
│ Club             vs              Opponent    │ Board expectation             │
│ Home/away · fixture context                  │ Squad availability            │
│                         Prepare team →       │ Open relevant screen →        │
├──────────────────────────────────────────────┼───────────────────────────────┤
│ MANAGER'S BRIEFING                           │ RECENT RESULTS / NEXT FIXTURES│
│ Up to three actionable items                 │ Compact football results      │
│ Sender, subject, reason it matters           │ Competition and date          │
│ Open message / resolve issue →               │ Open schedule →               │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

- Reuse the current next-fixture, standings, fitness, objectives, message and result projections. Do not add a new backend dashboard model merely to rearrange cards.
- Merge the duplicated next-match/next-opponent presentation. News and messages appear once, in the briefing, with their full screens one action away.
- Keep onboarding as a compact, dismissible-by-completion setup strip until complete; it must not permanently dominate the Hub.
- Preseason replaces the match hero with the real season-start/transfer-window context. No fixture means an honest empty state, not a fabricated opponent.
- Unemployed state promotes the existing job opportunities. Season completion preserves `EndOfSeasonScreen` and its rollover handler.
- At normal density, aim for the main decision surface to fit the default window. At 960×640 or extra-large scale, scroll the content region rather than hiding alerts or shrinking text.

### 6.2 Team

- **Squad:** football roster first; preserve table/card preference, sorting, filters, contract/fitness signals and player actions. Use a compact squad-summary band instead of several KPI cards.
- **Tactics:** central pitch, roster/bench selection in the left work region, player/formation inspector on the right. At narrow sizes the inspector becomes a clearly labelled drawer or stacks below. Preserve `useTacticsLineup`, `buildPitchRows`, `PitchToken`, XI index alignment and natural-versus-deployed position semantics. Dragging is an enhancement, never the only selection/swap path.
- **Training:** a weekly schedule/focus overview above group assignments and existing reports. Show actual configured intensity and backend warnings, not invented training progress percentages.
- **Staff:** a staff roster and role/assignment inspector using the shared table, entity and dialog patterns.
- **Youth:** prospect list plus development/report detail, using existing academy data and actions. No fictional academy pipeline stages.

### 6.3 Transfers and recruitment

- **My deals:** incoming/outgoing offers, loans and negotiations grouped by actionable state; preserve the existing deal workspace and confirmation paths.
- **Market:** budget/context band, filters, results table or cards, then player comparison/negotiation. Keep the selected player and filters when returning from a profile.
- **Scouting:** assignments and reports as two connected views; an open report retains its assignment context.
- **Player database:** the existing world search with the same filters/pagination and shared entity presentation.
- Negotiation is a focused dialog/work surface with clear offer, response and consequence states. Avoid casino-like reveal animations or speculative “deal probability” meters.

### 6.4 Competitions and world

- **Fixtures:** date/competition context with a readable calendar/list and result detail.
- **Competitions:** standings, rounds and existing tournament views. Use a bracket only where the existing competition structure supports it; otherwise retain accurate round lists.
- **Clubs / Managers:** shared directories, consistent search and profile return behaviour.
- **Hall of fame:** a records-and-honours presentation, not another grid of generic metric cards.
- **Player profile:** portrait/identity, club, natural positions and contract context in one dossier header; attributes, statistics and history below. Existing permissions govern actions.
- **Club profile:** crest, stadium/competition identity, squad and results with the same dossier grammar.
- **Manager:** career trajectory, reputation and history, with the manager's own club clearly identified.

### 6.5 Office

- **Inbox:** master/detail layout with a compact category rail or overflow selector. Urgency, sender and required action are visible before opening. On narrow layouts, list and message become sequential views with Back. Preserve message actions, archive/delete confirmations and deep links.
- **News:** editorial hierarchy with a lead story and compact secondary items. Keep the game's data-driven articles; do not copy Ninty's newspaper skin merely for decoration.
- **Finances:** cash, wage allowance/spend and backend health verdict first; cash-flow chart and transactions second. Preserve financial units and previews. No stock-market styling that implies meanings the simulation does not have.

### 6.6 Matchday: a separate immersive frame

All stages in `MatchSimulation.tsx` share the new frame: prematch, first/second half, half-time, extra time, shootout, postmatch, round digest and press conference.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Competition / phase             CLOCK / STATUS                              │
│ Home crest + name                  2 — 1                  Away crest + name │
├──────────────────────────────────────────────────────────────────────────────┤
│ EVENTS / STATS / LINEUPS                     │ TOUCHLINE                     │
│                                              │ Formation / style             │
│ Main event or analysis stage                 │ Bench and substitutions       │
│ One internal scroll region                   │ Existing legal commands       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Match context                    Pause / speed / step       Next-stage action│
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Prematch:** fixture identity, lineup readiness and the selected tactic; Start Match is the sole forward action.
- **Live:** scoreboard and phase are always visible. Events/stats/lineups use the accessible Tabs primitive. The touchline exposes existing commands, not new simulation policy.
- Keep the text match honest: a formation overview is acceptable; animated ball/player tracking requires coordinates the current UI does not receive and is out of scope.
- Consolidate duplicate key-event lists. If the reader scrolls away from live commentary, offer Follow Latest rather than forcibly pulling them back; following the feed and pausing the match are separate controls.
- **Half-time/extra time:** score, performance summary and legal changes in the same frame. Preserve transition guards and phase-specific substitution limits.
- **Shootout:** retain the already redesigned order picker/kick sheet behaviour; adapt its materials and chrome without rewriting the rules.
- **Postmatch/digest/press:** result hierarchy, existing statistics and a clear route through the current continuation handlers.
- Space toggles match pause only when no dialog or text input owns the keyboard. Career Alt-section shortcuts do not navigate away from a live match.
- Announce score/phase changes politely; do not read every tick or duplicate commentary announcements.

### 6.7 Career creation, settings and tools

- **Main menu:** a proper game title screen with a clear menu stack and restrained original football atmosphere. Preserve new career, load, world editor, settings, diagnostics and quit flows. Do not show a fictional active club.
- **Manager creation/world selection:** a setup frame with a visible step sequence, saved selections, validation beside fields and one forward action. Keep generation progress truthful and cancellable where currently supported.
- **Team selection:** competition/country navigation, club list/grid and a club-detail confirmation panel. The selected club's identity is prominent; existing rating/loading behaviour stays intact.
- **Settings:** grouped Display, Gameplay, Match and Accessibility controls in the game vocabulary. Remove theme and obsolete sidebar-width/behaviour controls. Keep language, currency, scale, high contrast, fullscreen and gameplay preferences; expose comfortable/compact density.
- **World editor:** a distinct “World workbench” frame, not the career HUD. Its entity navigation may remain vertical because it is an authoring tool, but it uses the same tokens, controls, dialogs and scroll rules. Preserve validation, dirty-state protection and build output.
- **Diagnostics and SimLab:** restyle all reachable dialogs and the registered SimLab route with shared primitives. SimLab is a developer workbench, not a fake career screen. No career status or Continue action without an actual career.
- **Loading/errors:** one game-styled fallback, including the root error boundary. Progress is determinate only when real progress exists; otherwise use an accessible busy state.

---

## 7. Theme and settings migration

This is an explicit behaviour change, not just a CSS replacement.

1. Apply the dark game presentation before the first app render, including the error path. Stop reading `ofm-theme` to choose light versus dark.
2. Existing backend `theme` values `light`, `dark` and `system` all open in the new presentation. Preserve the serialized field during the UI programme so older settings files and older builds remain readable; document it as no longer selecting a player-facing theme.
3. Preserve language, currency, gameplay settings, `ui_scale`, `high_contrast`, `list_view` and save data. Do not reset settings to defaults to perform the migration.
4. Remove `ThemeToggle` consumers from menus, settings, match stages and development mounts. Remove the toggle/context switch only when no consumer remains; keep the catalogue and style guide in sync.
5. Retain obsolete sidebar settings in the persisted schema during rollout, but remove their controls and runtime layout effect once the sidebar is retired. A later compatibility cleanup can remove fields deliberately.
6. Add `ui_density: "comfortable" | "compact"` with comfortable as the default. Add the frontend setting, root class application, translations and backend validation. The Rust field needs `#[serde(default)]`; settings are JSON, so no SQLite migration is anticipated.
7. Update `designTokens.test.ts` for normal and high-contrast dark modes. Remove light-theme parity claims rather than leaving tests that imply a supported light appearance.
8. Update `DESIGN_SYSTEM.md`, frontend guidance, the new-UI-surface procedure, accessibility reviewer guidance and player navigation documentation in the implementation phases. Existing two-theme instructions must not survive as contradictory requirements.

Required migration tests: old light preference, old dark preference, old system preference, stale local-storage light value, missing settings file, missing density field, non-default density round trip, invalid density fallback, and preservation of unrelated settings after a failed write.

---

## 8. Implementation architecture

### Proposed ownership

| Location | Responsibility |
|---|---|
| `src/components/dashboard/dashboardDestinations.ts` | One typed destination/section registry, translation keys and availability metadata; tested independently. |
| `src/components/gameShell/GameShell.tsx` | Presentational frame and slots; no backend calls and no match/advance policy. |
| `src/components/gameShell/GameSectionNav.tsx` | Primary destination navigation and responsive overflow. |
| `src/components/gameShell/GameContextNav.tsx` | Destinations within the active section; profile/back context. |
| `src/components/gameShell/CareerStatusBar.tsx` | Receives an already-derived career status view model. |
| `src/components/gameShell/GameCommandBar.tsx` | Receives existing action handlers and busy/error state; no duplicate invocation. |
| `src/components/gameShell/*.test.tsx` and helper tests | Navigation, focus, availability, narrow layouts and action wiring. |
| `src/components/match/MatchScreenLayout.tsx` | Evolves into the shared immersive match frame; stage components keep their behaviour. |
| `src/components/ui/` | Evolve existing Button, Card, Badge, Tabs, DataTable, EntityCard, Dialog and pitch primitives. Add a shared primitive only with multiple consumers. |
| `src/App.css` | The single home of palette, type, radius, chrome dimensions and density tokens. |
| `src/dev/` | Expanded real-page harness, state variants and style-guide examples; development-only. |

`Dashboard.tsx` remains the career composition owner initially. Extract view-model construction only where it reduces existing complexity; do not turn the redesign into a speculative routing/state-management rewrite.

### Guardrails

- Keep feature tabs lazy-loaded. Do not mount all 19 screens merely to satisfy a tab pattern.
- Components receive state and callbacks; only services call Tauri `invoke`.
- Do not mutate Zustand arrays/objects in place.
- Backend-owned tones, finance health, fitness bands and eligibility remain authoritative.
- No new `any`, component colour literals, raw palette classes or sub-12px text.
- Reuse `Dialog` for overlays and existing focus/roving utilities. No DOM reparenting outside React.
- Keep the existing Tauri/WebKitGTK runtime. The browser harness is a development and review tool, not a new product target.
- Land small sequential changes on the active session branch. Avoid a long-lived parallel rewrite and avoid mixing engine work into UI PRs.

---

## 9. Delivery sequence

This is a substantial programme, not a single reskin PR. A planning allowance of roughly **20–25 focused PRs** is more realistic than one branch-wide replacement; re-estimate after Phase 2 and the first feature slice. Dependencies matter more than calendar promises.

| Phase | Deliverables | Exit gate |
|---|---|---|
| **0 — Baseline and visual approval** | Fresh screenshots of every route; expanded route/state inventory; three high-fidelity direction boards for Hub, Tactics and Live Match; palette/contrast proofs; harness baseline. | Approve one visual direction and the small-window behaviour before applying it globally. No “looks good in Chromium only” approval. |
| **1 — Game design system** | Dark/high-contrast tokens, panel/button/badge treatments, type/radius/chrome tokens, density preference, updated primitive examples and tests. | Existing screens still function; catalogue coverage and contrast tests pass; no second theme toggle. |
| **2 — Career shell vertical slice** | Destination registry, primary/context navigation, status strip, command bar, search/back integration; Home and one real management screen work inside the shell. | All 19 destinations accounted for; existing advance/save/blocker tests pass; keyboard route through the slice works at minimum size. Re-estimate remaining work here. |
| **3 — Hub and Office** | Final Career Hub, Inbox, News, Finances, manager/season/unemployed variants and their dialogs. | A manager can review the club, act on messages and advance through ordinary days without encountering the old dashboard composition. |
| **4 — Team management** | Squad, Tactics, Training, Staff, Youth, player/club dossier surfaces used by these screens. | Roster, XI swaps, roles, tactics save, training and staff actions retain behaviour; pitch/inspector works with keyboard and at large scale. |
| **5 — Recruitment and world** | My deals, Market, Scouting, Players, Fixtures, Competitions, Clubs, Managers, Hall of fame and remaining profile/dialog variants. | Search → profile → action → Back works across sections; negotiation, pagination and filters have regression coverage. |
| **6 — Broadcast matchday** | All match stages, scoreboard, live event stage, touchline, substitutions, half-time, shootout, postmatch, digest and press. | A full match plus extra-time/shootout path passes existing behaviour tests; no career navigation or duplicate forward action leaks into the match. |
| **7 — Front door and authoring tools** | Main menu, manager creation, package selection/generation, team selection, Settings, world editor, diagnostics and SimLab. | New career, load career, settings round trip and world build all work in the new presentation; no raw light screens remain. |
| **8 — Enforcement and release candidate** | Remove retired sidebar/theme code and unused translations/helpers; finish token enforcement, docs, screenshots, real-app accessibility and performance checks. | Full preflight, required backend checks, accessibility/i18n review and a multi-screen career smoke test pass. |

Phases 4–7 can be split into independent screen-family PRs. Do not begin the next family by copying markup from an unfinished one; promote a repeated pattern into the shared system first.

### The first implementation slice after visual approval

1. Write failing tests for destination mapping, section memory, unemployed availability and profile return.
2. Add the shell with existing handlers, without changing game rules.
3. Put Home and Squad inside it; keep all other destinations reachable.
4. Wire the existing Continue/mode/save actions into the command bar and remove their old header duplicates.
5. Test keyboard navigation, dialogs, advancing, saving and return-from-profile behaviour.
6. Capture 1280×800 and 960×640, normal and extra-large, normal and high contrast, English and the longest-label locales.
7. Review the slice before rolling out the remaining families.

---

## 10. Verification and quality gates

### Automated coverage

- Co-located Testing Library tests, written first and observed failing for the intended reason. Query by role and accessible name.
- Navigation: every existing tab maps once; hidden club pages stay hidden when unemployed; remembered destinations validate; profile and message deep links still work.
- Commands: Continue is single-flight, mode selection survives, match confirmation/blockers retain priority, save errors remain visible, season rollover keeps its current owner.
- Theme migration: the cases in §7, including unrelated-setting preservation.
- Tactics/match: preserve XI slot indices, deployed position, substitution insertion, phase transition guards and legal-command restrictions.
- Expand `HARNESS_PAGES` beyond its current six screens. Add representative setup, match, empty, unemployed, loading and error states without committing generated fixture data.
- Extend `FINISHED_FOLDERS` and vocabulary enforcement only as each family passes; the final player-facing tree must be covered.

### Accessibility and localisation

- Complete a keyboard-only career path: start/load → Hub → Inbox → Tactics → profile → Back → Continue → Match → return.
- Verify focus visibility, dialog trapping/Escape/return, overflow navigation, table sorting and non-drag lineup operations.
- Check screen-reader names and landmarks; avoid announcing the entire status strip or every match tick on each update.
- Normal and high-contrast dark text pairs meet the existing contrast tests; interactive boundaries/focus meet their non-text requirements. Lime fills carry tested dark ink, not automatic white text.
- Every new visible string, placeholder, title, shortcut description and accessible name exists in all **12** locales. Reuse existing destination translations where possible.
- Test German and Chinese layouts as well as English; run the locale coverage/key tests and i18n audit. Do not truncate a destination into an ambiguous icon without an accessible name and discoverable label.

### Visual and performance checks

- Fresh before/after captures at **1280×800 and 960×640**, all four UI scales, both densities, normal/high contrast, and representative locales. The minimum window at extra-large scale is a required case, not an optional screenshot.
- No document-level horizontal overflow, clipped command bar, unreachable dialog action or disappearing critical alert. Internal vertical scrolling is acceptable and visible scroll affordances must remain usable.
- Expand `scripts/page-layout-check.mjs` to the new route/state inventory and fail unanswered harness commands in the reviewed captures.
- Run the actual Tauri app on Windows/macOS/Linux as available, with particular attention to WebKitGTK/NVIDIA. Chromium screenshots alone are not desktop-runtime evidence. Use isolated app-data directories for automated real-app runs.
- Compare navigation, search, squad scroll and live-match frame pacing before/after using the existing performance tools. Target smooth interaction without claiming a frame rate before measuring it. Avoid full-screen filters/backdrop blur and perpetual animations; investigate any regression before release.
- Keep textures/fonts local and modest. Track bundle impact; a visual overhaul should not import Ninty's database or a large new UI framework.

### Repository gates for implementation PRs

Run and report the actual results; this planning change does not claim any runtime suite has passed.

```bash
npm ci
npm run preflight
npm run audit:i18n
node scripts/page-layout-check.mjs http://localhost:1420
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo test --locked --manifest-path src-tauri/Cargo.toml --workspace
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib --features mcp
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --workspace --all-targets -- -D warnings
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --workspace --all-targets --features mcp -- -D warnings
```

The layout command requires a running dev server and Chrome. Follow the shared preflight procedure for Rust mutation checks when backend production code changes, including the density setting. Use the architecture, deduplication, test, i18n and UI-accessibility review procedures; record checks not run and their limits. Update the shared guidance before asking reviewers to enforce the new single-theme contract.

---

## 11. Main risks and mitigations

| Risk | Mitigation |
|---|---|
| A game skin hides functional regressions. | Keep services/hooks/game rules intact; test action wiring and complete career paths, not just snapshots. |
| Twelve-language navigation overflows. | Five sections, one registry, container-aware overflow, early scale tests; no reference 10px typography. |
| Fixed chrome leaves too little content at 960×640. | Rem-based chrome, collapse low-priority identity/status, one scroll body, persistent commands; never clip to force a single-screen layout. |
| Dark-only removes an accessibility fallback. | Keep and test high contrast, scaling, density, focus and screen-reader support; validate with actual assistive-technology use where available. |
| Old theme/sidebar preferences produce a broken hybrid. | Explicit migration tests for both theme storage paths; remove controls/runtime consumers together; retain serialized compatibility fields during rollout. |
| Neon styling makes dense data tiring. | Accent the next action and selected state, not every panel. Keep tables quiet and ratings semantic. |
| WebKitGTK struggles with effects. | Static/lightweight materials, no full-screen blur, real-app performance matrix and the existing graphics fallback path. |
| Full scope drifts into an endless rewrite. | Phase gates, small PRs, no engine work, reusable primitives and a re-estimate after the first playable shell slice. |
| Reference reuse creates licence/provenance problems. | Reimplement the interaction patterns; no reference code/data/assets without a compatible licence and recorded provenance. |

## 12. Definition of done

The overhaul is complete when a player can create or load a career, manage the club, negotiate, play a match, roll over a season, edit a world and change settings without encountering the old dashboard shell or an unstyled light screen. Every current destination and action remains available; the dedicated dark presentation passes the project's accessibility and localisation requirements; and the result is verified in the desktop app, not only in a browser mockup.

**The intended first impression:** “I am in my club's football command centre, and I know what to do next” — not “I am looking at an admin dashboard.”
