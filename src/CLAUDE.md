# Frontend guidance — `src/`

React 19 + TypeScript + Tailwind v4, talking to the Rust backend over Tauri `invoke()`.
Read [`../CLAUDE.md`](../CLAUDE.md) first for the project-wide rules.

---

## 1. Internationalisation — the rule that breaks CI most often

**Every string a player can read goes through a translation key.** The game ships **English only**:
`src/i18n/locales/` holds `en.json` alone. A literal hardcoded in a component is still a defect — the
key is what lets a second language land later without hunting through the UI.

"A player can read it" is the whole test. Everything rendered in `src/` qualifies, including an
`aria-label` and any backend error the UI surfaces. It does **not** reach text whose only reader is
an AI agent or a modder — MCP tool output, `ofm-cli`, `docs/` — which stays English on purpose; the
root [`../CLAUDE.md`](../CLAUDE.md) rule 2 has the table.

- Source of truth for the language list: `SUPPORTED_LANGUAGES` in `src/i18n/languages.ts` — `en`.
  `UPCOMING_LANGUAGES` holds `ar`, rendered as a disabled "Coming soon" row in both pickers
  (`src/i18n/languageOptions.tsx`): announced, not selectable, no locale file.
- Translation file: `src/i18n/locales/en.json`.
- Anything else resolves to English, including the eleven codes the game used to ship.
  `src/store/settingsStore.ts` normalises the stored code on load and on update, so an old save
  shows a picker selection and formats money and dates in English.

Enforced by tests, all run by `npm test`:

- `src/i18n/frontendKeyCoverage.test.ts` — every literal `t("…")` key used in `src/` exists in
  `en.json`. It parses the TypeScript AST, so a typo'd key is caught, not just a missing one.
- `src/i18n/localeCoverage.test.ts` — the registry and the files on disk name the same languages,
  English is a complete locale rather than a stub, and an announced language has a label but no
  file.
- `src/i18n/placeholderParity.test.ts`, `duplicateKeys.test.ts`, `currencySymbols.test.ts` —
  interpolation, duplicate keys, and money parameters.

Backend strings arrive as **translation keys**, not English prose. `src/utils/backendI18n.ts`
(plus `backendI18nPlayerEvents.ts` and `backendI18n.legacy.ts`) maps them to text. If you add a
message on the Rust side, you add its key to `en.json`.

Use `/add-ui-string` — it is the whole procedure, in order.

---

## 2. Design tokens and the football HUD language

Tailwind v4 keeps its config **in CSS**: the `@theme` block in `src/App.css`. That block is the
only place colours, type sizes and layout sizes are defined. The full reference is
[`docs/DESIGN_SYSTEM.md`](../docs/DESIGN_SYSTEM.md); every primitive is drawn in the dedicated dark presentation and supported scales at
`/style-guide.html` on the dev server. Do not add light/dark switches; the game shell and new
surfaces target the `.dark` graphite/lime palette.

| Token family | Meaning |
|---|---|
| `page`, `panel`, `sunken`, `hover`, `chrome`, `overlay` | Surfaces: the workspace, cards and tables, insets, a hovered row, the game shell bars and match band, a modal backdrop |
| `fg`, `fg-muted`, `fg-subtle`, `line`, `line-strong`, `focus`, `on-brand` | Text in three strengths, borders, the focus ring, text on the brand fill, chrome or turf (never on a `-solid`) |
| `selected`, `selected-tint`, `selected-fill` | A control that is on or chosen: the chosen option's text and background in a list, and the fill of a switch that is on, a checked box, a strong segmented option or a count badge (carries `on-brand`) |
| `positive`, `warning`, `danger`, `info` (+ `-tint`, `-solid`) | Status: text, background tint, bar or dot |
| `tone-top`, `tone-good`, `tone-fair`, `tone-low`, `tone-bad` (+ `-tint`, `-solid`) | The one good-to-bad scale for rated values; the backend picks the tone |
| `text-caption` 12 · `text-body` 14 · `text-lead` 16 · `text-heading` 18 · `text-title` 24 · `text-display` 32 | Type sizes by role, in rem |
| `h-row`, `h-panel-header`, `h-toolbar`, `max-w-page`, `@split` | Row, header and toolbar heights (smaller under `.density-compact`), the page width, the two-panel container breakpoint |
| `primary-*`, `accent-*`, `navy-*` | Brand: the Continue button, the selected nav item, logo strips. `primary-*` only in the files `designSystem.test.ts` lists in `BRAND_FILES` |
| `font-heading` / `font-sans` | Barlow Condensed for headings / Inter for everything else |

Rules:

- **Use role tokens** (`bg-panel`, `text-fg-muted`, `border-line`, `text-positive`,
  `bg-tone-good-tint`). They change value in high contrast and compact density by
  themselves, so **a role token never needs a `dark:` partner**. The raw Tailwind palette
  (`red-500`, `gray-400`, `white`, …) is not used in a finished folder; brand colours (`primary-*`,
  `accent-*`) only for brand moments. Never a hex literal in a component, never an arbitrary value
  like `bg-[#10b981]`. A club's or player's own colours are data: pass them as a CSS variable.
- **Type uses role sizes only.** Never below 12px, never a px literal or inline `fontSize`:
  `ui_scale` must move every size. Uppercase only for headings, buttons, badges and tabs, with
  `tracking-label`; labels and table headers are sentence case.
- **A rated value is painted, not judged.** The backend returns its tone; never compare a number
  against a threshold in TypeScript to pick a colour.
- **Reuse the catalogue** in `src/components/ui/index.ts`. A screen that needs a tab bar, empty
  state, table, tile or modal uses the primitive, never a copy.
- `src/designSystem.test.ts` enforces these rules in every folder listed in its `FINISHED_FOLDERS`;
  a folder joins the list in the PR that brings it up to standard.
- The font stacks include CJK fallbacks for `zh-CN` and a Cyrillic condensed face (Fira Sans Extra Condensed) behind Barlow Condensed for `ru`. Don't strip them when editing `@theme`.

---

## 3. Reuse before you build

Check the barrel at `src/components/ui/index.ts` first. It already exports `Card`/`CardHeader`/
`CardBody`, `Button`, `Badge`, `ProgressBar`, `CountryFlag`, `TeamLocation`,
`DatePicker`, `Select`, `Checkbox`, `PlayerAvatar`, `TeamLogo`, `InjuryBadge`, `JerseyIcon`, and
`PitchToken`.

Shared logic lives in `src/lib/` (`playerSquad.ts`, `playerRoles.ts`, `finance.ts`, `countries.ts`,
`seasonContext.ts`, `pyramid.ts`, …), reusable hooks in `src/hooks/`, backend call wrappers in
`src/services/`. Search all three before writing a helper — most things already have a home.

A new primitive belongs in `src/components/ui/` **only** if a second feature will use it.
Otherwise keep it next to its feature.

---

## 4. Accessibility floor

`Button.tsx` is the reference implementation. Match it.

- Visible focus on every interactive element: `focus:outline-none focus-visible:ring-2
  focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page`. The ring is
  drawn on `focus-visible`, so a click doesn't light it, and it is always `ring-focus`
  (`designSystem.test.ts` rule 6). Removing an outline without replacing it is a bug.
- Semantic elements. A clickable `div` is not a button; a `<button>` is.
- Every icon-only control gets an accessible name — `aria-label` with a **translated** string.
  (`aria-label` is in the `audit-i18n` attribute allowlist precisely because it is user-facing.)
- Disabled state is communicated by more than colour (`disabled:opacity-50` *and* the `disabled`
  attribute).
- Respect `prefers-reduced-motion` for anything that moves on its own.
- Contrast has to hold in **both** themes — gold on white and emerald on navy are the usual
  offenders.

The `ui-accessibility-reviewer` agent checks all of this against a diff.

---

## 5. State

Two Zustand stores in `src/store/`: `gameStore` (active game, manager, `hasActiveGame`) and
`settingsStore` (theme, language, currency, match preferences). Shared types in `store/types.ts`.

- **Never mutate store state from a component.** Copy, then set. There is regression history here
  (`fix/hometab-store-mutation`) — a component mutated a store array in place and the UI silently
  desynced.
- Backend calls go through `src/services/*Service.ts`, never a raw `invoke()` in a component.
  The service layer is where types and error handling live.

---

## 6. Invariants that are easy to break

**XI slot alignment.** Entry `i` of the starting-XI array *is* formation slot `i`, everywhere —
frontend, backend, and match engine. Substitutions and swaps insert at the **vacated index**, they
never append or re-sort. Slot geometry comes from `buildPitchRows(formation)` in
`src/components/squad/SquadTab.helpers.ts`; `PitchToken` is the shared pitch token component.

**Deployed vs natural position.** `player.position` is the player's *natural* position and is
never mutated. Where a player is currently *deployed* is derived from the formation slot via
`getDeployedPosition(team, slot)` in `src/components/squad/SquadTab.helpers.ts`, mirroring the
backend derivation. Role pickers, validators, and profile screens use the deployed slot; anything
describing the player themselves uses the natural position.

---

## 7. Testing

Vitest + `@testing-library/react`, jsdom environment, config in `vite.config.ts`, global setup in
`src/test-setup.ts`. Tests are co-located: `Foo.tsx` → `Foo.test.tsx`.

- **Query by role and accessible name**, not by test id or class. `getByRole("button", { name })`
  fails when the accessible name is missing — so the accessibility check comes for free.
- Extract pure logic into a `*.helpers.ts` file and unit-test it directly. `SquadTab.helpers.ts`
  and `useAdvanceTime.helpers.ts` are the pattern.
- Write the failing test first. That is the point.

Run a focused file while iterating — `npm exec --no -- vitest run src/components/squad` — and the full suite
before you push.
