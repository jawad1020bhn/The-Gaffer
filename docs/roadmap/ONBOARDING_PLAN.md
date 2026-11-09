# Onboarding — the first day in charge

Status: first implementation pass applied on 8 November 2026 (English-only temporary exception). See §11 for what shipped, what was deliberately deferred, and the verification limits. The original proposed journey remains below as the product target.

Companion to [GAME_UI_REDESIGN_PLAN.md](GAME_UI_REDESIGN_PLAN.md), especially §6.7 and Phase 7. Reuse the shipped game shell and design tokens; do not wait for the entire screen-redesign programme or start a second visual language.

## 1. The intended feeling

Starting a career should feel like **being appointed manager of a football club**, not completing an application form. The player should finish knowing: who they are, what world they entered, why this club is interesting, what the board expects, and what to do next.

“High-end” here means strong identity, deliberate pacing, responsive controls and a convincing football atmosphere. It does not mean a long video, a fake negotiation, arbitrary statistics, or a tutorial that prevents playing.

### Product rules

- **Guided is the recommended new-player path; Quick setup is always available.** Both expose the same manager, world, season and club choices. Quick setup skips optional explanations and the appointment ceremony, not game features.
- **Every added screen must help make or understand a decision.** No decorative questionnaires, invented contract terms, or personality choices that secretly imply attribute bonuses.
- **The simulation stays authoritative.** Use the existing world, club, budget, fixture and board data. Do not advance time, hire staff, change tactics or generate a second welcome message merely to animate onboarding.
- **The player can leave the guide.** First-day guidance is dismissible and reopenable. It never blocks ordinary navigation, saving or match progression.
- **Offline and local.** No account, network dependency or telemetry. Use local artwork and fonts; measure completion and confusion through voluntary playtesting, not analytics.
- **Accessible from the first slice.** Keyboard operation, screen-reader names, reduced motion, high contrast, UI scaling and all 12 locales are release requirements.

UX targets to validate, not performance claims: approximately 3–5 minutes for the guided setup once the world is ready, excluding actual generation time; approximately 5–10 minutes for the optional first-day tasks. There is no countdown or minimum viewing time.

## 2. What exists today

| Area | Current implementation | Opportunity |
|---|---|---|
| Main menu and wizard | `src/pages/MainMenu.tsx` owns `main`, `create`, `packages`, `generation` and `load` states inside a narrow card. | Replace the card-only presentation with a full-window setup frame and one consistent step model. |
| Manager creation | `CreateManagerForm.tsx` collects name, nationality, start year and start phase, with reusable profiles. | Separate identity from season configuration and show a live manager identity preview. Preserve validation and profile behavior. |
| World selection | `PackageBuildStep.tsx` handles databases, patches, installation and conflicts. The former `WorldSelect.tsx` generation/review step has been replaced by `careerSetup/SeasonStep.tsx`; shared package shapes live in `menu/packageTypes.ts`. | Present authored worlds as football worlds rather than a file list, while retaining generated-world fallback and advanced controls. |
| Club selection | `TeamSelection.tsx`, `TeamSelectionSidebar.tsx` and `useTeamSelection.ts` already provide scope filters, ratings, a likely XI and club confirmation. | Turn the sidebar into a stronger club dossier and make the final commitment explicit. |
| Taking charge | `useTeamSelection.handleConfirm` calls `select_team`; Rust `select_team_internal` calls `begin_career`, persists the chosen club and installs the career, then the UI goes to Dashboard. | Insert a presentation-only appointment briefing after this successful commit. Do not call `select_team` again. |
| First-week guide | `HomeOnboardingChecklistCard.tsx` shows five stops. `HomeTab.helpers.ts` completes four by page visits and the inbox step by reading any message; visits live in localStorage and the card disappears after seven days. | Replace visit counting with meaningful acknowledgments/actions, save progress with the career, and keep the guide available until completed or dismissed. |
| Visual/runtime foundation | React/TypeScript/Tauri, shared UI primitives, graphite/lime tokens, `GameShell`, existing club/player artwork components. No audio subsystem or real generation-progress events were identified in the reviewed paths. | Extend the existing language. Do not invent progress percentages or assume an audio pipeline already exists. |

The current step indicators also disagree: the manager form draws two stops while the package and generation screens draw three. A shared registry should fix this before more steps are added.

## 3. Proposed journey

```text
Title screen
    ↓ New career
Manager → World → Season & guidance → Club → Appointment → Manager's office
                                                ↓                 ↓
                                         one career commit   first-day guide
                                                                  ↓
                                                         first match, with context
```

| Stage | What the player sees and does | What changes |
|---|---|---|
| **Title screen** | A restrained, original football atmosphere; New Career, Load Career, World Editor, Settings and Quit. Continue Career only when a real save exists. | Presentation only. Never advertise a fictional active club. |
| **1. Your manager** | Existing name/nationality fields and saved profiles, beside a live manager card. | Existing profile data only. No new DOB question, avatar requirement or gameplay backstory. |
| **2. Your football world** | Installed world packages with artwork, description and actual coverage; import/remove controls; a clear generated-world option. Advanced package details remain available. | Existing package selection and validation. Keep patch-only and conflict restrictions. |
| **3. Your season** | Start year, season-start/mid-season choice, generated-history depth where applicable, and Guided/Quick guidance. A compact review of all choices precedes “Prepare career.” | Existing startup options plus a guidance preference. The real `start_new_game` request runs here. |
| **4. Your club** | Existing region/competition/search controls plus a prominent dossier: crest, colours, city/stadium, competitions, budgets, squad summary and likely XI. Show optional history/facilities only when supplied. | Existing scope selection. “Take charge of [club]” is the single commit action. Actual board objectives are not promised before the backend has created them. |
| **5. Your appointment** | Manager and club identity, opening date, the actual board briefing/objectives, and the next fixture or honest preseason context. One clear “Enter the manager's office” action. | No simulation mutation. The career was already saved by club selection; acknowledge the briefing and record that it was seen. |
| **6. First day in charge** | The normal Career Hub with a compact guide and one recommended next action. Tasks open the real management screens. | Existing actions plus saved guidance acknowledgments. No parallel tutorial version of the game. |

### Generation and failure behavior

- While `start_new_game` is pending, show an accessible busy state and the chosen world/season. A football-themed illustration is acceptable; a staged “scouting players / negotiating contracts” progress bar is not.
- Add determinate progress or cancellation only if the backend provides real progress/cancellation. Neither is assumed by this plan.
- Prevent duplicate submissions and preserve the draft on failure. Surface the existing translated error with Retry and Back.
- Back through the pre-generation steps preserves choices. After generation, Back returns to club selection; it must not silently rebuild the world. Editing the manager/world/season requires an explicit new-draft action.
- A failed club confirmation leaves the previous session intact and creates no appointment or guide progress. A successful confirmation is never repeated by the ceremony.

## 4. First-day guidance

Use **four essentials**, with staff and training as optional exploration rather than extra gates:

1. **Read the board briefing.** Open the specific welcome/board message associated with the appointment. Reading an unrelated message does not complete it. If that message is no longer available, offer an explicit “Reviewed” acknowledgment so the task cannot become impossible.
2. **Meet your squad.** Open Squad and inspect a player, or explicitly acknowledge the squad review. Merely switching tabs is insufficient.
3. **Confirm your tactics.** Save a formation/lineup/style through the existing controls, or choose “Keep current setup” when the current setup is valid. If it is invalid, route to the existing correction flow. The acknowledgment must not change XI slot order or mutate a player's natural position.
4. **Prepare for what comes next.** Open the next fixture/schedule context and acknowledge readiness. In preseason with no fixture, use the real season-opening context instead. This does not advance the clock.

Optional cards: **Review your staff** and **Review your training plan**. Do not label them “Hire staff” or “Change training” unless that action actually occurs, and never force a hire or a training change.

Completion changes the guide into a compact “Ready for matchday” state and points to the existing Continue/next-event control. It grants no reward and unlocks no withheld feature.

- Keep the guide until completed or dismissed; remove the silent seven-day expiry.
- Put “Resume first-day guide” in the existing pause menu when relevant.
- Quick setup hides the guide by default but can enable it later.
- Use one contextual hint at a time inside management screens, not a stack of mandatory dialogs.
- A later first-match slice may explain lineup readiness, match modes and the touchline once, respecting the player's existing live/spectator/delegate preference. A short post-match “what next” panel can then point to training, inbox and recruitment.

## 5. Presentation and interaction specification

### Setup frame

Create a feature-owned `CareerSetupLayout` with:

- A labelled step rail: completed, current and upcoming states, not colour alone.
- A generous main work surface and a persistent “career passport” summary of manager/world/season choices.
- A fixed, reachable Back / primary-action footer; the work area scrolls internally.
- At narrow sizes, a compact step indicator and collapsible summary rather than three squeezed columns.
- The same frame adapted for club selection, without mounting the career HUD before a club is chosen.

Reuse `Button`, `Card`, `Badge`, `Select`, `Dialog`, `TeamLogo`, `GeneratedCrest`, `PlayerAvatar`, `JerseyIcon` and existing formatting helpers. Keep new feature components under `src/components/careerSetup/` and `src/components/onboarding/`; promote a primitive only when another feature needs it.

### Atmosphere and motion

- One original, optimized local stadium/tunnel or abstract pitch-background treatment. No licensed club photography, copied commercial-game assets or video dependency.
- Club colours are data passed as CSS variables and used as identity accents, not replacements for accessible role tokens.
- Strong Barlow Condensed headings, quiet Inter body text, existing radius/spacing tokens and one emphasized forward action.
- Step transitions target 120–180 ms opacity/translation; hover and press feedback is immediate. No perpetual glow, animated background grid or full-screen blur.
- Reduced motion removes spatial transitions. Focus moves to the new step heading; errors return focus to the first invalid field. Announce busy/completion changes once, politely.
- Audio is a separate later enhancement, not an MVP dependency: original/local cues, a persisted mute/volume control, no autoplay before a user gesture, and no information conveyed by sound alone.

## 6. State and code ownership

### Frontend

| Proposed location | Responsibility |
|---|---|
| `src/components/careerSetup/careerSetupSteps.ts` | Typed step registry, validation gates, next/back transitions and summary view model. Pure and independently tested. |
| `src/components/careerSetup/CareerSetupLayout.tsx` | Presentational frame, step navigation and footer slots; no Tauri calls. |
| `src/pages/MainMenu.tsx` | Remains the pre-generation orchestration owner initially; consume the step model rather than duplicating indicators. Extract handlers only where complexity genuinely falls. |
| `src/components/careerSetup/SeasonReviewStep.tsx` | Existing year/phase/history controls, guidance choice and final pre-generation review. |
| `src/pages/TeamSelection.tsx` and existing sidebar/helpers | Evolve the current dossier and confirmation surface; preserve region/competition rules and backend ratings. |
| `src/components/onboarding/AppointmentBriefing.tsx` | Render the already-committed career's actual briefing; acknowledge/skip only. Dashboard presents it once, including after a reload if still pending. |
| `src/components/onboarding/firstDayGuide.ts` | Typed milestones, availability and next-action derivation. No game-rule formulas. |
| `src/components/home/HomeOnboardingChecklistCard.tsx` | Evolve into the compact guide; keep it from dominating the Hub. |
| `src/services/onboardingService.ts` | The only new onboarding IPC boundary; use `invokeForCareer` for writes. |
| `src/components/gameShell/PauseMenu.tsx` | Resume-guide entry and callback; no persistence logic in the menu primitive. |

Keep the wizard draft in its parent state for reliable Back/Forward. Do not add a speculative routing rewrite. `routeForActiveCareer()` can keep its existing awaiting-club/dashboard contract; Dashboard reads saved onboarding state and presents a pending appointment there. Reloading must never return to club confirmation or commit the career twice.

### Save-backed guidance

Manager profiles are reusable identities; onboarding belongs to a **career**, not a profile. Add a small `CareerOnboarding` data type containing a schema version, guidance mode, appointment acknowledgment, the captured briefing message ID, explicit milestone acknowledgments and dismissed state. Derive message-read completion from the actual message where possible rather than storing a second conflicting truth.

- Put the pure type in `domain`; add the career field to `ofm_core::game::Game` with `#[serde(default)]` and generated TypeScript support.
- Initialize new-career preferences through the existing club-selection transaction. An optional preference argument preserves old callers; the new wizard sends Guided or Quick explicitly. Existing saves and callers that omit it retain today's uninterrupted behavior.
- Persist in an additive `game_meta.onboarding_json` column unless implementation reveals a concrete reason for a separate table. Append the next SQL migration, register it and update the pinned migration count; never reorder old migrations.
- Update `meta_repo.rs` column/placeholder/parameter/row mappings and both sides of `game_persistence.rs`. A serde default alone is not persistence.
- Existing careers default to guide hidden, not a forced tutorial. Leave legacy localStorage keys readable for compatibility, but do not let them override another save's progress or mark the new meaningful tasks complete.
- Expose a small validated update command through a shared internal function, register it in `src/lib.rs` and `SCREEN_WRITE_COMMANDS`, and check the career token inside the atomic write. A failed write leaves both game and guide state unchanged.
- Include the onboarding projection in `SessionState` and the store's session derivation/update paths so ordinary hot responses do not erase it. Regenerate wire types with the repository command; never edit generated files manually.

No match-engine changes, new simulation policy, account system or remote storage are needed.

## 7. Delivery sequence

Plan for **five focused implementation PRs for the first release**, with first-match context and release hardening in the final slice. Re-estimate after the first playable slice; these are dependency boundaries, not calendar promises.

| Slice | Deliverables | Exit gate |
|---|---|---|
| **0 — Direction proof (this plan)** | Approve the journey, appointment treatment and small-window layout. Capture current menu/club/Hub baselines and add representative harness states. | One visual direction and the Guided/Quick behavior agreed before a broad rewrite. |
| **1 — Setup frame** | Failing step-model/UI tests; shared layout/registry; reorganize existing manager, world and season controls; consistent Back/Next and validation. | Existing profile/package/startup tests still pass; no new backend rules; guided and quick paths reach club selection. |
| **2 — Club decision and generation polish** | Stronger dossier, explicit commitment, truthful busy/error/retry states, preserved pre-generation selections. | Authored and generated worlds work; scope rules unchanged; duplicate submit and failure recovery covered. |
| **3 — Saved state and appointment** | Migration/domain/store/service work, then appointment briefing and reload behavior. | Non-default progress survives a fresh save reader; old saves load; switching careers cannot cross progress; selection happens exactly once. |
| **4 — First-day guide** | Four meaningful essentials, optional staff/training, dismiss/resume, real-screen navigation and explicit keep-current acknowledgments. | No visit-only false completion, forced mutation or seven-day disappearance; normal play remains available throughout. |
| **5 — Release hardening and first-match context** | One-time matchday hints, final motion/art polish, full localization/accessibility/native-runtime checks and updated player documentation. | A complete new-career-to-first-match path works in both guidance modes; measured layout/performance results recorded. |

Slices 1–2 can be reviewed visually before persistence lands. Slice 3's migration tests must precede its UI. Do not mix an avatar generator, audio engine or new board-interview mechanic into these PRs.

Later, separately scoped additions: optional cosmetic manager portraits; richer authored club histories; subtle audio; an actual board-interview mechanic only if the simulation owns its choices and consequences.

## 8. Verification and acceptance

Write each named test first and observe the intended failure. Use controlled stateful hosts for forms and faithful service mocks for failure paths.

### Behavior matrix

- Guided and Quick; generated world and authored package; season start and mid-season; historical year; package conflicts and patch-only refusal.
- Back/Forward preserves choices; invalid fields retain existing focus behavior; pending generation cannot submit twice; failure offers recovery; no fake progress/cancel control.
- Club confirmation succeeds once; rejection does not install a career or write progress; appointment reload does not reselect the club; Quick skips ceremony without losing the saved career.
- Old save without onboarding data; non-default progress round trip with a fresh reader; malformed/unknown progress fallback; two saves with different progress; legacy localStorage present or unavailable; failed acknowledgment write.
- Reading the wrong message does not complete the briefing; visiting Tactics does not confirm it; keeping a valid setup is explicit; an invalid setup routes to correction; optional tasks do not block completion; dismissing and resuming work after day seven.
- A late response from a previous career cannot update the active career; ordinary advance/save responses preserve onboarding state.

### UI and release checks

- Keyboard-only title → setup → club → appointment → Hub → Inbox → Tactics → Schedule → Continue path; visible focus, semantic headings, dialog Escape/focus return and useful screen-reader announcements.
- 1280×800 and 960×640, all four UI scales, both densities, normal/high contrast; English, German and Chinese layout checks, with coverage tests for every supported locale.
- No horizontal overflow, unreachable footer, clipped error or text below the existing minimum role size. Long translations may scroll; they must not shrink into illegibility.
- Reduced-motion and missing-artwork fallbacks; no new animation framework or remote asset request.
- Real Tauri/WebKitGTK checks where available, not Chromium screenshots alone. Record startup, transition responsiveness and asset/bundle impact before claiming improvement.
- Run the shared i18n, accessibility, architecture, deduplication and test-review procedures. Update `docs/GETTING_STARTED.md` and the beta guide's onboarding limitations when the feature actually ships.

Implementation gates, with actual results reported separately:

```bash
npm ci
npm run preflight
npm run audit:i18n
# With the development harness running and Chrome available:
node scripts/page-layout-check.mjs http://localhost:1420
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo test --locked --manifest-path src-tauri/Cargo.toml --workspace
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib --features mcp
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --workspace --all-targets -- -D warnings
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --workspace --all-targets --features mcp -- -D warnings
```

## 9. Extracted additions from the “Your First Week” proposal

Approved for planning in English only for now. These are additions to the journey above, not permission to bypass the simulation, save-compatibility or accessibility rules.

- **Manager identity cards:** add a Background choice — Legend, Former Pro, Youth Coach, Complete Outsider — and a Philosophy choice — Possession, High Press, Counter-Attack, Pragmatic. Start as explicit saved preferences; reputation or tactical effects require backend ownership.
- **Board meeting beat:** a short chairman scene where the player makes one season promise: European football, attractive football, or survival. Store the promise; reference it in board reviews, press and job pressure only when the backend supports those consequences.
- **Contract-signing / appointment ceremony:** a skippable visual confirmation with manager details, club accent, sign/stamp moment and optional sound. It celebrates the already-saved appointment; it must not invent contract terms or call `select_team` again.
- **Club challenge presets:** story filters such as Sleeping Giant, Relegation Rescue and Title Contender, derived from real club/world data rather than hardcoded fake scenarios.
- **Richer club expectation panel:** last-season finish, star player/captain preview, transfer budget, wage room and a job-pressure label only when a backend projection or existing data can support it honestly.
- **Welcome sequence:** a short press intro using the existing press-conference pattern, a squad roll-call using existing player cards, and seeded welcome messages from chairman/captain/chief scout through the existing inbox system.
- **Longer guidance horizon:** keep the first-day essentials, then optionally surface first-week and first-90-days objectives. They remain dismissible and must not block ordinary play.
- **Named step rail and resumable state:** completed beats stay clickable, choices survive Back/Forward, and returning managers can reuse a profile to skip identity/philosophy where appropriate.
- **Club atmosphere:** per-club accent theming from the appointment onward, optional motion/sound, and setup-time badges only from measured generation timings.
- **English-only pass:** draft all new copy in English for now. Do not add Arabic or other locale files in this pass; if this reaches player-facing UI, track the missing locales as an explicit temporary exception and restore full locale coverage before release.

## 10. Recommendation

Build the appointment moment and meaningful first-day guide before adding more customization. They create the strongest “I am the manager now” feeling using systems the game already has. Keep the first release to the setup frame, club dossier, appointment, saved guidance and first-match context; treat audio, avatars, board promises and interview mechanics as later enhancements with their own design and testing costs.

## 11. Implementation status — 8 November 2026

Applied in this checkout, English only:

- Full-window title screen and native setup frame (`careerSetup/CareerSetupLayout`) with one named step rail: World → Season → Identity → Philosophy (guided) → Club → Appointment → Office. Quick setup skips Philosophy and the appointment ceremony. Choices survive Back/Forward; completed beats are reachable; saved profiles can reuse identity.
- Manager Background and Philosophy are explicit preferences. Philosophy is applied through the existing `setPlayStyle` command only when it differs from the club's current style, after the club has already been selected. Background has no hidden attribute or reputation effect.
- Board promise (Europe / attractive football / survival) is stored in the career journal and shown at the appointment. It has no backend consequence yet; no fake contract terms, interview mechanics or pressure projection are invented.
- Club selection gained history-derived story presets (Title Contenders, Sleeping Giants, New Stories), budgets, stadium and last-season facts where the world supplies them. The expectation panel stays tied to real board objectives once the career exists.
- Appointment ceremony is presentation-only: it never calls `select_team` again, can be skipped, respects reduced motion, and uses an optional local UI sound cue (off by default). The welcome sequence points at the existing board/inbox message and real squad/tactics/schedule screens; it does not seed fake messages.
- First-day guide uses four meaningful acknowledgments/actions, save-scoped journal persistence, dismiss/resume from the pause menu, and a longer guidance horizon label (week / 90 days / season) derived from the in-game clock.
- Per-club accent theming starts at club selection/appointment. Setup elapsed time is a real measured timer, not a fake generation percentage.

Deliberate limits and verification:

- New copy exists only in `src/i18n/locales/en.json`. The other 11 locales are untouched, so `localeCoverage` fails until translations land; this is the explicit temporary English-only exception.
- Frontend unit/component tests for the new flow pass (`careerSetup`, `onboarding`, `MainMenu`, `TeamSelection`, menu package tests). A wide regression run passed 3,243 tests; the only failures were i18n coverage gates, including three missing English keys that were then added (`menu.title`, `menu.startingGame`, `diagnostics.reportBug`). `frontendKeyCoverage` now passes. `tsc --noEmit` reports only the pre-existing missing `fixture.generated.ts` cascade in dev harness/design-token tests.
- `npm run format:check` and `npm run lint` pass (lint reports infos only). Locale coverage/placeholder parity remain red by design until the other 11 locales are translated.
- This environment has no Cargo/Rust toolchain, so `npm run preflight`, `npm test` and `npm run build` cannot complete their `ensure-page-fixture` pre-hooks, and native Tauri/WebKitGTK verification is still required before release.
- Knip could not run here (parser array-buffer allocation failure). No Rust commands were run.

### Browser previews and visual evidence

Two dev-only previews draw the shipped screens with no save and no Rust runtime:

- `/style-guide.html?preview=onboarding` — the first-run journey end to end. `/` and `/select-team`
  mount `MainMenu` and `TeamSelection` unchanged; `/dashboard` composes the office through the shell
  preview's `GameShell` + workspace with the career journal wired as `Dashboard` wires it. Optional
  `&stage=title|club|board|sign|welcome|office` seeds a beat directly for screenshots. The stub
  backend commits `select_team` exactly once and refuses a second appointment.
- `?preview=shell` gained optional `gameState` and career-journal props so the office composition is
  reused rather than duplicated; its defaults and existing test are unchanged.

Seventeen screenshots (both Guided and Quick paths) are in
[`evidence/onboarding/`](evidence/onboarding/), with the capture method and a known rail issue
documented in that folder's README. They are browser renders with mocked Tauri IPC, not native
captures.

Known follow-up: in Quick mode the setup rail still lists the skipped Philosophy, Board, Signing
and Welcome beats. Left unchanged in this pass.
