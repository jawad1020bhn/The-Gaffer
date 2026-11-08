# Game UI redesign — implementation status

Status: implementation in progress on `arena/f5b9b34f-the-gaffer-v0-4`; the full overhaul is not complete.

## Shipped so far

- Dedicated dark game presentation: `ThemeProvider` always applies `.dark`, old `ofm-theme`/backend theme values no longer select a light appearance, and high contrast / UI scale remain supported. `ThemeToggle` is retired.
- Game shell: typed 19-destination registry, five sections (Career, Team, Transfers, Competitions, Office), club-only filtering, persistent club/date/next-fixture/unread/budget status, search, settings, and one bottom command bar for Continue / match modes / save.
- Dashboard composes `GameShell`, `GameCommandBar`, and `DashboardSearch`; the old header/sidebar/drawer implementation is removed without deleting destinations.
- Settings: theme/sidebar controls retired; grouped rows tokenized; **Density** (comfortable/compact) added to the frontend store, root class application, Settings UI and all 12 locales. Rust `AppSettings.ui_density` added with `serde(default)`, normalization and tests, but Cargo is unavailable here so the Rust tests are unrun.
- Shared HUD materials: angular control/panel radii, graphite/lime role tokens, dark pitch colours, compact-density spacing, tokenized main menu entry card, Settings, shared match frame, TeamSelection frame, match-stage surfaces, world-editor frame, diagnostics dialogs and SimLab workbench surfaces.
- Broad token migration across the management screen families: Home/Office (home, inbox, news, finances, manager), Team (squad, tactics, training, staff), Recruitment/World (transfers, scouting, tournaments, schedule, hallOfFame, youthAcademy), plus match, worldEditor and diagnostics surfaces. Existing behaviour tests for these families pass.
- Design-system enforcement extended to `Settings.tsx`, `Settings.components.tsx` and `MatchScreenLayout.tsx`.
- Style guide/dev harness options are dark-only; `gameNav` and density strings exist in all 12 locales; player navigation docs describe the new shell.

## Verification

- Final broad Vitest run excluding the three fixture-dependent suites: **366 files / 3260 tests passed** (`src/designTokens.test.ts`, `fixtureAnswers.test.ts`, `harnessPages.test.tsx` excluded because `fixture.generated.ts` is absent).
- Targeted Vitest also passing: ThemeContext, dashboardDestinations, GameShell, GameCommandBar, DashboardSearch, Dashboard, Settings, settingsStore, uiDensity, MainMenu, StyleGuide, designSystem, UI primitives, TeamSelection, match, worldEditor, diagnostics, home/inbox/news/finances/manager, squad/tactics/training/staff, transfers/scouting/tournaments/schedule/hallOfFame/youthAcademy, localeCoverage.
- `npm run audit:i18n` exits 0.
- `tsc --noEmit` has no non-fixture errors; remaining errors are the absent `src/dev/pageHarness/fixture.generated.ts` and its implicit-any fallout.
- Vite preview accepts the Arena preview host when started with `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=<preview-host>`.

## Blockers / not yet done

- Full `npm test`, `npm run build`, `designTokens.test.ts`, fixture answer/layout suites, and Rust gates require the Rust-generated page fixture / Rust toolchain; this sandbox lacks Cargo and the fixture file. The new Rust density tests are written but unrun.
- Knip crashed with an array-buffer allocation failure in the sandbox, not a reported unused-export finding.
- Headless Chromium screenshots are unavailable here because the packaged browser is missing `libnspr4.so`; the live Vite preview is available instead.
- Remaining raw-palette details (about 155 non-test TSX files still contain at least one legacy gray/navy/white class), especially PackageEditor forms, player/team profiles, dashboard modals and deeper match/editor details; full `FINISHED_FOLDERS` enforcement, density/layout evidence, and the later phases in `GAME_UI_REDESIGN_PLAN.md` are still pending.
