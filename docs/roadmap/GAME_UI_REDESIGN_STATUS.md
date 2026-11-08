# Game UI redesign — implementation status

Status: the shell, density and repo-wide token migration are shipped on
`arena/f5b9b34f-the-gaffer-v0-4` (PR #5). The later phases in `GAME_UI_REDESIGN_PLAN.md`
(per-screen layout redraws) are still pending.

## Shipped so far

- Dedicated dark game presentation: `ThemeProvider` always applies `.dark`, old `ofm-theme`/backend theme values no longer select a light appearance, and high contrast / UI scale remain supported. `ThemeToggle` is retired.
- Game shell: typed 19-destination registry, five sections (Career, Team, Transfers, Competitions, Office), club-only filtering, persistent club/date/next-fixture/unread/budget status, search, settings, and one bottom command bar for Continue / match modes / save.
- Dashboard composes `GameShell`, `GameCommandBar`, and `DashboardSearch`; the old header/sidebar/drawer implementation is removed without deleting destinations.
- Settings: theme/sidebar controls retired; grouped rows tokenized; **Density** (comfortable/compact) added to the frontend store, root class application, Settings UI and all 12 locales. Rust `AppSettings.ui_density` added with `serde(default)`, normalization and tests.
- Shared HUD materials: angular control/panel radii, graphite/lime role tokens, dark pitch colours, compact-density spacing.
- **Manager creation no longer asks for a date of birth.** The field, its live validation, the `be.error.createManager.dob*` wiring and the `dob` key in all 12 locales are gone, and no IPC payload sends it. Rust takes `Option<String>`: an explicit DOB from an older client is still parsed and age-checked (30–99) against the world's opening clock; when it is omitted the manager is 45 at the opening date. Saving a profile reuses an existing identity's DOB by name+nationality, and updating one preserves the stored value, so no existing profile loses its DOB. `ManagerProfile.date_of_birth` and `validate_manager_dob` are kept.
- **The main menu's community row is removed**: "Open Discord", "GitHub" and "Report a bug" icon buttons, their `openUrl`/`Bug` imports, `DISCORD_INVITE_URL` and the three `menu.*` keys in all 12 locales. `GITHUB_REPO_URL` stays for `issueUrl.ts`, and the crash-report prompt, `ReportBugModal` and Settings → Help → Report a bug are untouched.

## Token migration — complete

Every screen folder is on the design tokens. The raw Tailwind palette (`gray-*`, `red-400`,
`white`, `fuchsia-*`, …) and the legacy `navy-*` bridge are gone from all of `components/`,
`pages/` and `layouts/`; the `primary-*`/`accent-*` ramps remain only in the five `BRAND_FILES`
that own a brand moment (Button, Badge, Card, ProgressBar, the Dashboard spinner).

- 177 files migrated. Light/dark class pairs collapse to one role token, because a role needs no
  `dark:` partner in a dark-only app. Where a base and a `dark:` form both survived, the dark value
  wins; where only the `dark:` form existed it is kept rather than dropped, so no styling is lost.
- Two new token groups, both drawn in the style guide:
  - `category-1` … `category-5` (+ `-tint`): a categorical palette for labels whose families must
    stay apart. `TraitBadge`'s 22 arbitrary hues become the five trait families (physical,
    technical, mental, goalkeeper, special), and the nine news desks keep nine distinct looks.
    This replaces per-item colours that encoded nothing with per-family colours that do.
  - No new status colours: rated values keep `tone-*`, statuses keep `positive/warning/danger/info`.
- Corrections the migration surfaced and fixed:
  - `text-white` on a dark surface, a club-colour hero or the turf becomes `fg`, not `on-brand`.
    `on-brand` is near-black and is only correct on the brand and selected fills.
  - `-solid` fills carry no text (rule 5), so filled destructive/status actions use `-tint` plus
    their status text. An invalid `bg-selected-solid` class introduced mid-migration is gone.
  - Gradients whose two stops collapsed to the same token are now a flat surface.
  - Sub-12px literals and Tailwind size names become role sizes, so `ui_scale` moves them.
- Enforcement: `FINISHED_FOLDERS` now covers 15 whole screen folders plus the 9 shared components
  at the root of `components/`. Two **repo-wide** tests were added alongside it — no raw palette on
  any screen, and no legacy ramp outside the brand owners — so the migration cannot regress in a
  folder that is not yet fully finished.

## Verification

- Broad Vitest run excluding the three fixture-dependent suites: **365 files / 3252 tests passed**
  (`src/designTokens.test.ts`, `fixtureAnswers.test.ts`, `harnessPages.test.tsx` excluded because
  `fixture.generated.ts` is absent).
- `designSystem.test.ts`: 34/34, including the two new repo-wide guards.
- `npm run audit:i18n` exits 0; `biome check src` exits 0.
- `tsc --noEmit` has no non-fixture errors; remaining errors are the absent
  `src/dev/pageHarness/fixture.generated.ts` and its implicit-any fallout.
- **Visual evidence in `docs/roadmap/evidence/`**: `style-guide-1280.png` (dark token grid, zero
  page errors), `menu-1280x800.png`, `menu-960x640.png` and `layout-audit.json`. Both viewports
  report no horizontal overflow, no DOB field or text, no Discord/GitHub buttons, and zero text
  nodes under 12px. At 960×640 the wizard card scrolls vertically, which is expected.
- `docs/ARCHITECTURE.md` documents the optional-`dob` signatures, the Manager Profile commands and
  the `ui_density` setting.

## Blockers / not yet done

- **Rust is unverified.** This sandbox has no Cargo/rustc and the toolchain cannot be downloaded
  (`static.rust-lang.org` is unreachable, the pinned release carries no assets). `cargo test`,
  `clippy` and `fmt` have not run. The Rust changes were hand-reviewed against the real APIs
  instead, which found and fixed two genuine bugs: `domain::age::age_on` returns `Option<i32>`
  (the startup assertion now compares to `Some(45)`), and a `45 * 365` day subtraction yields 44
  across leap days (both `game/mod.rs` and the mcp-gated `game/bootstrap.rs` now use
  `checked_sub_months(Months::new(45 * 12))`). **These still need a run on a machine with Cargo.**
- Full `npm test`, `npm run build`, `designTokens.test.ts` and the fixture answer/layout suites
  need the Rust-generated page fixture, which is deliberately not committed. No fake fixture was
  added to make them pass.
- Knip crashed with an array-buffer allocation failure in the sandbox, not a reported finding.
- The remaining §7 rules are still folder-by-folder: about 27 chart/label type sizes, 92 colour
  literals in pitch and chart artwork, 90 focus rings and one bespoke overlay in
  `PlayerDealWorkspace` predate this work and are unchanged by it. Those folders are guarded by
  the two repo-wide palette tests but are not yet in `FINISHED_FOLDERS`.
- The per-screen layout redraws in `GAME_UI_REDESIGN_PLAN.md` are still pending.
