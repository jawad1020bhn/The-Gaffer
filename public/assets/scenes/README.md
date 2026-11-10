# Scene plates

Eleven key visuals, one per room. The brief each was made to, and the salvage verdicts behind the
five that came from the old project, are in [../../docs/UI_REDESIGN.md](../../docs/UI_REDESIGN.md)
parts 1 and 4.

Every plate is composed the same way — **subject on the right, left third in near-black negative
space** — because that is the onboarding composition, and it is what lets a heading sit directly on
a scene with no panel behind it. All are graded at runtime by the `scene-plate` utility in
`src/App.css`; no file here is pre-graded, so the grade is one edit to change.

## Generated for this redesign

| File | Room |
|---|---|
| `office-night.jpg` | The manager's office at night, glass wall onto a floodlit empty stadium |
| `tactics-room.jpg` | The analysis room, glass tactics board under one cold strip light |
| `training-dawn.jpg` | The training ground at cold dawn, cones in ground mist |
| `season-wall.jpg` | The operations room's blank brushed-metal season board |
| `press-room.jpg` | The press conference room, empty, unbranded backdrop |
| `empty-dawn.jpg` | The tunnel mouth before dawn, floodlights off — the "nothing here yet" room |

## Salvaged from the old project

Copied from `github.com/jawad1020bhn/Ninty` (the same author's Python/static predecessor). Five of
its 63 image assets survived the scan; the rest were discarded for baked lettering, third-party
marks, flat clip-art, or being too small. See part 1 of the redesign doc for the full table.

| File here | Old path | Treatment |
|---|---|---|
| `dressing-room.jpg` | `static/art/dressing-banner.jpg` | grade |
| `matchday.jpg` | `static/art/fans-banner.jpg` | grade |
| `boardroom.jpg` | `static/art/board-banner.jpg` | grade |
| `transfer-desk.jpg` | `static/art/transfers-banner.jpg` | grade + anchor right, cropping the baked "TRANSFERS" lettering out of frame |
| `trophy-room.jpg` | `static/art/trophy-banner.jpg` | grade + anchor right, cropping the embossed brand mark out of frame |

An old asset was kept only if it survived a heavy cool grade **and** carried no baked text or
third-party mark in the part of the frame that stays visible.

## Adding a plate

1. Brief it to the four hard constraints in part 4 of the redesign doc: ultra-wide 21:9, subject
   right with the left third in shadow, desaturated cool graphite, and no people, text, logos, UI or
   watermark.
2. Drop it here and add it to `SCENES` in `src/components/ui/SceneBackdrop.tsx`.
3. Point a section or a tab at it — `TAB_SCENES` in
   `src/components/dashboard/dashboardDestinations.ts`.
4. Keep it under ~250 KB. All eleven together are 1.6 MB; the grain is procedural and costs nothing.
