# The Gaffer — native PC game UI redesign

**Scope:** every screen after onboarding. **Anchor:** the career-setup screen that already works.
**Status of this document:** parts 1–4 are the direction and the plan; part 5 records what is
already implemented on this branch and what is left; part 6 is the gate.

---

## 0. What is actually in the repo

Detected from source, not assumed.

**7 routes** (`src/App.tsx`): `/` MainMenu · `/select-team` TeamSelection · `/dashboard` Dashboard ·
`/match` MatchSimulation · `/settings` Settings · `/sim-lab` SimLab · `/world-editor` WorldEditorPage.

**19 dashboard destinations in 5 sections** (`src/components/dashboard/dashboardDestinations.ts`):

| Section | Destinations |
| --- | --- |
| `career` | Home, Manager |
| `team` | Squad, Tactics, Training, Staff, Youth |
| `transfers` | Transfers, TransferCentre, Scouting, Players |
| `competitions` | Schedule, Tournaments, Teams, Managers, HallOfFame |
| `office` | Inbox, News, Finances |

**Plus the screens that are not destinations:** the 8 career-setup beats, ArrivalSequence,
PauseMenu, CommandPalette, EndOfSeasonScreen, SwitchClubConfirmModal, Dialog, ErrorBoundary,
FirstDayGuideCard / FirstDayTaskBanner, and the four dev harnesses.

**Stack constraints that shape every proposal below.** React + TypeScript + Tailwind v4 + Tauri.
`src/App.css` is the only place a colour may be defined. `src/designSystem.test.ts` fails a change
that puts a hex literal, a raw Tailwind palette class or a Tailwind/arbitrary type size into a
finished folder — and 16 folders are finished, including every folder this redesign touches.
`src/dev/styleGuide/StyleGuide.test.tsx` fails a change that adds a `@theme` token or exports a
`ui` primitive without drawing it in the style guide. Rated colours come from a backend tone, never
a TypeScript threshold. Type uses role sizes so `ui_scale` moves the whole game.

**This is why the redesign goes through the token → material → primitive → shell layers.** Hand-
styling 19 screens would fail those gates and produce 19 slightly different games. One material
layer makes all 19 inherit the same room, and the gates then prove it.

---

## 1. Old-repo asset scan — `github.com/jawad1020bhn/Ninty`

Shallow-cloned and inventoried: **63 image assets**, 42 of them ≥1200 px wide. The old project is a
Python/static-web predecessor; `static/art/` is a per-screen banner library, which is exactly the
shape this redesign needs. Dimensions were read from file headers (`file`, PIL and ImageMagick are
all absent in this sandbox).

Verdicts below are from **looking at the image**, not from its filename.

### Reuse — shipped on this branch

| Old path | Type / size | Quality | Verdict | New home |
| --- | --- | --- | --- | --- |
| `static/art/dressing-banner.jpg` | photo-render 2172×724 | strong | **Reuse + grade.** Dark dressing room, navy kits, wood, tactics whiteboard. Already near the onboarding palette. | `public/assets/scenes/dressing-room.jpg` → `team` |
| `static/art/fans-banner.jpg` | photo-render 2172×724 | strong | **Reuse + grade.** Crowd from behind, scarf raised, dusk floodlights, black-and-white flags so it carries no third-party club. No baked text. | `scenes/matchday.jpg` → `competitions`, Home next-fixture panel |
| `static/art/board-banner.jpg` | photo-render 2172×724 | strong | **Reuse + grade.** Dusk boardroom, stadium through glass. Warm window key against cool interior — the grade pulls the warm side down. | `scenes/boardroom.jpg` → `office`, confirmation dialogs |
| `static/art/transfers-banner.jpg` | photo-render 1348×768 | usable | **Reuse + crop + grade.** Navy desk, glowing transfer arcs, laptop. Baked "TRANSFERS" lettering is cropped out by anchoring right. Too small for full bleed; correct for a panel header. | `scenes/transfer-desk.jpg` → `transfers` |
| `static/art/trophy-banner.jpg` | photo-render 1700×680 | strong | **Reuse + crop + grade.** Lit trophy cabinet, but a large embossed brand mark fills the left third. Anchoring right crops the mark and keeps the silverware. | `scenes/trophy-room.jpg` → `honours` (HallOfFame, Tournaments) |

All five are graded at runtime by the `scene-plate` utility (`saturate(.5) contrast(1.08)
brightness(.86)`), so the original file is untouched and the grade is one edit to change. Total
added weight for all 11 plates: **1.6 MB**.

### Remaster — worth keeping, not worth shipping as-is

| Old path | Size | Problem | Instruction |
| --- | --- | --- | --- |
| `static/art/desk-leather.jpg` | 1536×1024 | Warm sepia leather and props; reads antique, not broadcast. | Crop the centre 60%, desaturate to ~15%, cool-shift, then use at 4–6% opacity as a panel material only. **Not shipped** — procedural `scene-grain` does the same job for 0 bytes. |
| `static/art/paper-wide.jpg`, `paper-sheet.jpg` | 1672×941, 1024×1536 | Cream aged paper with a folder edge. Wrong temperature for a graphite game. | Salvage the grain only: desaturate fully, then tile at 3–5% under a News article or an Inbox letter. **Not shipped** — same reason. |
| `data/myscenes/pressw-a…f.jpg` | 3686×1536 ×6 | Good panoramas, but six variants of one room is five too many, and each needs the same grade. | Pick the single best frame, grade, and use for News. **Superseded** by the generated `press-room.jpg`, which was briefed for left-hand negative space; the old ones were not. |

### Discard — do not carry forward

| Old path | Size | Why |
| --- | --- | --- |
| `static/art/tactics-banner.jpg` | 1138×700 | Flat purple line-art pitch clip-art. No depth, no material, wrong hue. The repo already has a real `PitchToken` renderer. **Regenerated.** |
| `data/myscenes/office.jpg` | 4668×879 | Headless suit mannequin, baked "G" watermark, bright daylight. Fails on composition and on mood. **Regenerated.** |
| `static/art/inbox-banner3.jpg` | 2172×724 | genuinely good composition, but purple-graded with baked fake UI on the laptop screen and lettering on the book spines and mug. Baked text cannot be graded away. **Regenerated** as `office-night.jpg`. |
| `data/stadiums/*.jpg` (7 files) | 1920×1277, 0.6–1.4 MB | Real daylight club photographs with visible crests — wrong mood **and** third-party photo/trademark exposure. |
| `static/art/gaffer-mark-t.png`, `gaffer-mark-180`, `gaffer-full` | 256², 180², 780×600 | Brushed-metal "G" with a white cut-out fringe. The current repo's `openfootmanager_symbol512x512.png` and SVG marks are cleaner and already wired. |
| `data/art/lg-*.png` (6 competition marks) | small | Recognisable real-competition marks. The shipped world is EA FC 27; do not import old competition branding. |
| `static/art/ballon-*`, `squad-banner`, `training-banner`, `assistant-banner` | ≤789 px wide | Below the resolution a 2026 desktop hero needs. |

**Rule applied:** an old asset ships only if it survives a heavy cool grade *and* has no baked
text or third-party mark in the part of the frame that stays visible. Five of 63 passed.

---

## 2. Global visual direction

**Mood — "the club after hours."** Not a broadcast package, not a stats website. You are the last
person in the building: concrete, glass, brushed metal, one desk lamp, floodlights outside. The
onboarding plate already says this; the rest of the game now says it too.

**Colour.** Graphite is the room, lime is the only thing that emits light. Already the `.dark`
presentation: page `#0b0f12`, panel `#12181d`, chrome `#080c0f`, line `#2a3640`, fg `#f2f6f8`,
selected `#c8f45a`, focus `#e2ff8a`. No new hues. Saturation is rationed: turf green in a scene,
lime on an action, semantic colour on a status — nothing else. Charts keep `series-*`; rated values
keep the backend's `tone-*`.

**Materials, three finishes.** `surface-panel` (raised, lit along the top edge), `surface-well`
(recessed, for table bodies and tracks), `surface-chrome` (machined, for the shell's bars). Each is
a lit gradient over a role colour, so it themes and high-contrasts for free. `surface-brand` is the
moulded-key gloss on a filled button.

**Lighting.** One key light per scene, from the upper right, with the left third in shadow. That is
a composition rule, not a preference: it is what lets a heading sit on the image with no panel
behind it. Depth is three physical steps — `shadow-panel` resting, `shadow-raised` under the
pointer, `shadow-well` cut in — each pairing a contact shadow with an ambient one so nothing floats.
`shadow-hud` is longer and softer because the action dock genuinely floats.

**Typography.** Unchanged, deliberately: Barlow Condensed 600/700 uppercase with `tracking-label`
for every heading, button and tab; Inter 400–700 for body. Role sizes only — `caption 12 / body 14 /
lead 16 / heading 18 / title 24 / display 32`. This is already the onboarding's voice and it is the
single strongest reason the game does not read as a website. Do not add a display face.

**Icons.** Lucide at 16/20 px, one weight, `aria-hidden`, never decorative-only colour. Section icons
already live in `shellIcons`. No emoji, no filled duotone, no icon fonts.

**Motion.** Three speeds, all disabled under `prefers-reduced-motion`: the room settles slowly
(`scene-in`, 420 ms, scale 1.03→1), a panel arrives fast (`panel-in`, 200 ms, 8 px rise), a control
responds instantly (150 ms, 1 px press). `live-pulse` breathes a halo over 2.4 s and never blinks or
moves a label. Nothing animates on scroll; the chrome never animates.

---

## 3. Screen-by-screen redesign

Every screen inherits §2. Below is only what is *specific* to it. "Plate" is the `SceneId` passed to
`SceneBackdrop`; the shell resolves it from the tab via `sceneForTab()`.

### 3.1 Home — the manager's desk
- **Concept.** The desk you sit at, not a dashboard of widgets. The next fixture is the one panel
  that carries a room.
- **Plate.** `career` (office at night) ambient behind the workspace; `competitions` (matchday) at
  `strength="panel"` inside the next-fixture card.
- **Layout.** Unchanged three-band fixed canvas — hero / secondary / tertiary, each panel scrolling
  inside itself. The window never scrolls.
- **Components.** `Card` now carries `surface-panel shadow-panel`; `CardHeader` is a machined rail
  (`bg-card-band edge-lit`). Primary action is the moulded lime key.
- **Interaction.** Card hover lifts to `shadow-raised`; the Continue key glows on hover and presses
  1 px. Value changes flash the existing `useValueFlash` chip.
- **Palette / mood.** Graphite with the crowd's dusk warmth surviving only in the fixture header.
- **Connection.** Sets the panel grammar every other screen reuses.

### 3.2 Schedule / calendar — the season wall
- **Concept.** A fixtures board in an operations room, not a month grid from a booking site.
- **Plate.** `schedule` (brushed-metal season board, blank slots).
- **Layout.** Calendar strip above, matchday groups below, past results under a rule.
- **Components.** Day cells are wells; today is `selected-tint` with a lit top edge; a match day
  carries the competition's `category-*`. Empty schedule now uses `SceneState`, not a grey line.
- **Interaction.** Arrow keys move day focus (roving tabindex already in `ui/roving.ts`), Enter
  scrolls to the matchday, hover raises the cell.
- **Connection.** Same wells and rails as Squad's table.

### 3.3 Squad / Players / detail views — the dressing room
- **Plate.** `team` (dressing room) ambient; a player profile is an art-headed panel over it.
- **Layout.** Master table left, detail right, split at `@split` so it stacks under `ui_scale`.
- **Components.** `DataTable` body becomes a `surface-well`; rows keep `h-row` and gain a lit top
  edge on hover; `EntityCard` keeps its kit wash. Attribute bars use backend `tone-*`, never a
  TS threshold.
- **Interaction.** Row hover → `bg-hover`; selection → `selected-tint` + a 2 px lime left edge;
  double-click opens the profile; Esc backs out through the shell's existing history strip.

### 3.4 Tactics — the analysis room
- **Plate.** `tactics` (**regenerated** — the old asset was purple clip-art).
- **Layout.** Pitch centre, formation and style right, bench below.
- **Components.** The pitch is a recessed well (`shadow-well`) with the existing turf tokens;
  `PitchToken` unchanged. Formation options are a segmented control, not a radio list.
- **Interaction.** Drag a token; the drop target lights its rim; an out-of-position player keeps the
  backend's warning tone. Arrow keys nudge a focused token.
- **Note.** The pitch is the one place saturated green is correct — it is turf, not decoration.

### 3.5 Training / Youth — the training ground
- **Plate.** `training` (**regenerated**, cold dawn, mist, cones).
- **Layout.** Weekly intensity grid left, focus areas right; Youth keeps its intake flow.
- **Components.** Intensity is a three-key segmented control (Light / Balanced / Intense) using the
  existing `info` / `selected` / `danger` roles. Load meters are `ConditionMeter` in a well.
- **Interaction.** Changing intensity previews the load before commit; the affected meters pulse
  once with `live-pulse`.

### 3.6 Transfers / TransferCentre / Scouting — the deal desk
- **Plate.** `transfers` (salvaged, anchored right to drop the baked lettering).
- **Layout.** Search and filters as a toolbar rail, results as a table, shortlist as a right panel.
- **Components.** Filter chips are squared `rounded-control` keys, **not** pill badges — pills are
  the single strongest website tell in the old screenshots. Negotiation is a stepped panel with a
  `surface-well` offer track.
- **Interaction.** An offer in flight breathes `live-pulse` on its status dot only; a rejected offer
  shakes 2 px once and settles (reduced-motion: colour only).

### 3.7 Competitions / Teams / Managers / Tournaments — the honour boards
- **Plate.** `competitions` ambient; `honours` for Tournaments and HallOfFame (anchored right to
  crop the old brand mark).
- **Layout.** Table first, bracket second. Trophy cabinet as a horizontal band of lit wells.
- **Components.** League table is a `DataTable` in a well; the user's row carries the lime left edge;
  promotion/relegation zones keep their backend tones.

### 3.8 Inbox / News — the reading desk
- **Plate.** `office` for Inbox, `press` (**regenerated**) for News.
- **Layout.** List left, document right. The document is a panel on the desk, not a web article.
- **Components.** Unread is a lime dot, not a bold row. Message body sits on `surface-panel` with
  `max-w-prose`; a result embed is a well. News categories keep `category-*`.
- **Interaction.** J/K or arrows move the list, Enter opens, Del deletes behind a confirmation.

### 3.9 Finances / Manager / Staff — the office
- **Plate.** `office` (boardroom).
- **Layout.** Key figures as a band of lit wells across the top, charts below, detail right.
- **Components.** Charts read `series-*` through `var()` so they theme in WebKitGTK. Money uses
  tabular figures. Board confidence is a `ProgressBar` on the backend tone.

### 3.10 Settings — the options menu
- **Concept.** A game options menu: categories down the left, settings right, changes applied live.
- **Plate.** `career` ambient at the lowest strength.
- **Components.** Rows are `h-row` with label left / control right; `Switch`, `Select` and
  `SegmentedControl` only. **No web form, no stacked labels above inputs, no submit button.**
- **Interaction.** Every change applies immediately; a Reset row is a ghost key behind a confirm.

### 3.11 Modals, confirmations, pause, command palette
- One shell only: `ui/Dialog` (enforced — nothing else may draw `fixed inset-0`).
- Scrim is `bg-overlay`; the dialog is `surface-panel shadow-hud` with `edge-lit`.
- **Confirmations** are two keys, destructive on the right in `danger`, cancel a ghost key; Enter
  confirms, Esc cancels; focus lands on the least destructive action.
- **PauseMenu** plates `empty` behind the scrim — the game keeps existing while paused.
- **CommandPalette** is a well with a lit result row, not a search modal.

### 3.12 Empty / loading / error — one family
- **`SceneState`** (new primitive) — all three on the `empty` plate (empty stadium before dawn).
- Empty: headline + one line + the one action that fixes it. Loading: `role="status"`, an
  indeterminate swept track, never a fake percentage. Error: `role="alert"`, `text-danger` headline,
  a Retry key.
- All copy arrives from the caller, so the primitive holds no strings and adds no translation keys.

### 3.13 MainMenu / TeamSelection / MatchSimulation / EndOfSeason
Already scene-led (`MainMenu` and `ArrivalSequence` use the onboarding plate). They inherit the new
materials and buttons; **no layout change proposed** — they are the parts that already work.
MatchSimulation keeps its 300 ms `match-stage-in`; EndOfSeason adopts `honours`.

---

## 4. Key-visual briefs

Six generated, five salvaged. Every brief carries the same four hard constraints, which is what
makes eleven images read as one game:

> ultra-wide 21:9 · subject on the right, **left third in near-black negative space** · desaturated
> cool graphite, turf green the only saturation · **no people, no text, no logos, no UI, no watermark**

### Generated ( shipped to `public/assets/scenes/` )

| File | Brief |
| --- | --- |
| `office-night.jpg` | Manager's private office at night. Right third: walnut desk, closed leather notebook, steel desk lamp with one warm pool, glass wall onto a floodlit empty stadium through rain-flecked glass. Left half pure black. Anamorphic, 35 mm grain, shallow DOF. |
| `tactics-room.jpg` | Dark analysis room. Right: wall-mounted glass board with faint abstract chalk circles and arrows (unreadable, **not lettering**), one cold raking strip light, folded bib on a bench. Left half unlit concrete. Dust in the beam. |
| `training-dawn.jpg` | Empty training ground at cold dawn, low camera. Right: cones and a folded goal receding into ground mist, floodlight masts silhouetted, wet dew-catching grass. Left third dark mist. Pale amber sliver on the horizon, no bright sky. |
| `season-wall.jpg` | Club operations room. Right: brushed-metal and smoked-glass season board of **blank** rectangular slots, magnetic markers, cold overhead strip light on the metal edge. Left third near-black. Explicitly no letters, numbers, words or dates. |
| `press-room.jpg` | Empty press conference room from the back of the press seats. Right: long table, two neutral mics, **unbranded blank** backdrop panels, one empty chair, hard spotlight pools. Left third black. No sponsors. |
| `empty-dawn.jpg` | Symmetrical and very quiet: empty stadium from a dark concrete tunnel mouth before dawn, floodlights **off**, mist over the pitch, empty seats. Lower half and both edges fall to black. Floodlights-off is the point — this is the "nothing here yet" room. |

### Salvaged ( remaster instructions )

Applied at runtime by `scene-plate`, so the source file is never destroyed:

1. **Grade:** `saturate(0.5) contrast(1.08) brightness(0.86)`. Pulls the old warm/purple/daylight
   banners into the graphite room.
2. **Crop:** `scene-anchor-right` (`object-position: 82% 50%`) on `transfer-desk` and `trophy-room`,
   which drops the baked "TRANSFERS" lettering and the embossed brand mark respectively.
3. **Veil:** `bg-veil` (82% page) ambient, `scene-veil-left` for a hero, `scene-veil-panel` for an
   art-headed working panel.
4. **Unify:** `scene-vignette` + `scene-grain` at 5% `mix-blend-overlay`, so a 2019 banner and a new
   render carry the same tooth.

To re-bake offline instead: ImageMagick
`-modulate 100,50 -brightness-contrast -6x8 -gravity East -crop 82%x100%+0+0 +repage`.

---

## 5. Implementation

### Shipped on this branch

**Token layer — `src/App.css`.** 12 new `@theme` tokens (`--color-veil`, `--color-edge-light`,
`--color-edge-dark`, `--color-glow`, `--shadow-panel`, `--shadow-raised`, `--shadow-well`,
`--shadow-hud`, `--shadow-glow`, `--animate-scene-in`, `--animate-panel-in`, `--animate-live-pulse`),
each with a light fallback and a `.dark` presentation value. 11 `@utility` finishes:
`surface-panel`, `surface-well`, `surface-chrome`, `surface-brand`, `edge-lit`, `scene-grain`,
`scene-plate`, `scene-anchor-right`, `scene-veil-left`, `scene-veil-panel`, `scene-vignette`.
Three keyframes, all reduced-motion aware. **No colour literal left any finished folder** — they are
all in the one file allowed to hold them.

**Primitive layer — `src/components/ui/`.**
- `SceneBackdrop.tsx` (new): 11 plates, three strengths, layered plate → veil → vignette → grain.
  `aria-hidden`, `pointer-events-none`, absolutely positioned, keyed on the plate so a section
  change crossfades. It cannot change what a screen does.
- `SceneState.tsx` (new): the empty / loading / error family, strings supplied by the caller.
- `Card.tsx`: `surface-panel shadow-panel`; header is now a machined rail, with `banded={false}`
  for an art-headed panel so the band does not cover the plate.
- `Button.tsx`: moulded key — `surface-brand` gloss, 1 px press, `shadow-glow` on primary hover,
  `no-select`, disabled drops the shadow and the travel. Hover brightens in dark and darkens in
  light so `on-brand` text keeps its contrast in both.

**Shell layer.** `GameShell`'s workspace is `relative isolate` with an ambient `SceneBackdrop`
resolved by the new `sceneForTab()`; `TopBar` and the hint strip carry `surface-chrome`; `SideRail`
is a `surface-well`. **All 19 destinations inherited the room without one of them being edited.**

**Screens.** Home's next-fixture card is an art-headed matchday panel. Schedule's two empty states
are `SceneState`. Both are proofs of the grammar, not special cases.

**Style guide.** New `MaterialsSection` draws all three scene strengths, all four finishes, the
three state variants, and names all 12 tokens — so the coverage gate passes and a designer can see
the system at `style-guide.html?theme=dark`.

### How to finish the remaining screens

Per screen, in this order — no screen needs a new colour:

1. `sceneForTab()` already picks its room. Override `TAB_SCENES` only if the page is a place.
2. Swap any bare `<p className="text-center text-fg-muted">` empty for `<SceneState>`.
3. Give the screen's main panel `relative isolate` + `<SceneBackdrop strength="panel">` **only if**
   it has a header tall enough to carry art, and pass `banded={false}` to that `CardHeader` — an
   opaque band covers the plate exactly where the veil is thin enough to see it. Tables and forms
   stay flat.
4. Replace pill filters with `SegmentedControl`; replace stacked-label forms with `h-row`
   label-left / control-right rows.
5. Put table bodies and meters in `surface-well shadow-well`.
6. Add the entry to the style guide if you export anything new. Run the gates.

### What makes it feel native rather than web

- **Fixed canvas.** `h-dvh`, window never scrolls, panels scroll inside themselves. Already true;
  keep it true.
- **No text selection on chrome** (`.no-select`), selection allowed on content.
- **Keyboard first.** The shell already has Ctrl+K, F5, Esc, Space and section hotkeys, plus a hint
  strip with real keycaps. Every new control joins that contract; nothing is mouse-only.
- **Focus is visible and lime**, `ring-focus` with a surface-coloured offset, on every interactive
  element — never removed.
- **Press has travel.** 1 px down into its own shadow. A web button changes colour; a key moves.
- **No web tells:** no pill chips, no rounded-2xl cards, no hamburger, no breadcrumbs, no footer
  links, no hero-with-three-feature-cards, no blue links, no stacked-label forms.

### Gates

```
npm exec --no -- vitest run src/designSystem.test.ts src/dev/styleGuide   # the rules
npx tsc --noEmit                                                        # 17 pre-existing errors
npm run format:check && npm run lint
```

---

## 6. Final quality checklist

**Does it feel like a PC game?**
- [x] Fixed canvas, panels scroll internally — the window is a viewport, not a page.
- [x] Every screen is *somewhere*: 11 plates, resolved by section, crossfading on change.
- [x] Three physical depth steps; nothing floats without a contact shadow.
- [x] Buttons are keys with travel and a glow, not filled rectangles.
- [x] Keycap hint strip, Ctrl+K palette, F5, Esc, Space — a control scheme, not navigation links.

**Does it avoid the website look?**
- [x] No pill filters, no card grids of marketing features, no stacked-label forms, no breadcrumbs.
- [x] Condensed uppercase headings with tracking, not a web H1/H2 ramp.
- [x] Scenes are graded into one graphite room; no stock-photo brightness.
- [x] No third-party crests, no baked lettering, no old brand marks in a visible crop.

**Is it consistent with onboarding?**
- [x] Same graphite/lime roles — **zero new hues**.
- [x] Same composition: subject right, words on the left in shadow.
- [x] Same Barlow Condensed / Inter pairing and the same role sizes.
- [x] Same restrained motion; the room settles, the control snaps.

**Is it premium, immersive and still usable?**
- [x] `aria-hidden` + `pointer-events-none` scenes: atmosphere cannot break behaviour.
- [x] Veils guarantee text sits on near-solid surface, never on a photograph.
- [x] Focus rings untouched; hover contrast preserved in both themes.
- [x] Every animation disabled under `prefers-reduced-motion`.
- [x] `ui_scale`, density and high-contrast still work — no px sizes, no arbitrary values.
- [x] Empty, loading and error are one family with a way out, not three grey sentences.
- [x] 1.6 MB for all 11 plates; grain is procedural.

**Verified by screenshot** — see [ui-redesign/](ui-redesign/) for before/after at 960×640, the four
rooms at 1600×900, and the style guide's material section. Captured in headless Chromium on the shell
preview career.

That pass caught a bug the tests could not: `DashboardWorkspaceContent` carried its own `bg-page`,
which painted over the shell's `SceneBackdrop`. The plate loaded, graded and positioned correctly
and was visible nowhere. Fixed in `1bd565d`; the Schedule comparison is the evidence.

**Still to verify by eye on a real build:** the plates at `ui_scale=xlarge`, and `scene-grain`'s
`mix-blend-overlay` under WebKitGTK on Linux (these shots are Chromium). Two pre-existing preview
gaps are visible in the shots and are not from this work: Hall of Fame crashes on a fixture with no
titles, and News shows a raw `news.categories.general` key.
