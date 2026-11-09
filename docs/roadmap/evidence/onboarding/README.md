# Onboarding — visual evidence

Screenshots of the first-run journey as implemented, captured at **1440×900** from the running
React UI. Both guidance paths are covered.

## How these were captured

The screens are the shipped components — `MainMenu`, `TeamSelection`, `ArrivalSequence`,
`FirstDayGuideCard`, `FirstDayTaskBanner` and the real `GameShell` workspace — driven by clicking
through the flow in headless Chromium against the dev preview:

```
npm run dev            # or: vite --host 0.0.0.0 --port 1420
# then open:
/style-guide.html?preview=onboarding
```

`src/dev/onboardingPreview/` answers the Tauri commands from a fixed fixture career, so the flow
runs with **no Rust runtime and no save**. Every number on screen (budgets, ratings, history,
squads) comes from that fixture, not from a simulation. `select_team` is committed exactly once;
the stub refuses a second appointment, as the backend does.

These are browser renders, not native Tauri/WebKitGTK captures. Native verification is still
required before release.

## Guided path

The full journey: World → Season → Identity → Philosophy → Club → Board meeting → Signing →
Welcome → Office.

| File | Beat |
|---|---|
| `01-title.png` | Title screen — stadium backdrop, keyboard-driven menu |
| `02-world.png` | World — the database package that defines the world |
| `03-season.png` | Season — start year, phase, Guided/Quick guidance |
| `04-identity.png` | Identity — name, nationality, background, live career passport |
| `05-philosophy.png` | Philosophy — starting tactical identity |
| `06-club-selection.png` | Club dossier — story presets, simulation scope, real club facts |
| `07-board-meeting.png` | Board meeting — objectives and the season promise |
| `08-signing.png` | The signing — appointment ceremony |
| `09-welcome.png` | Welcome — key players, inbox, next fixture |
| `10-office-first-day.png` | Office — first-day essentials on the real Home dashboard |
| `11-squad-task-banner.png` | Squad — contextual first-day task banner |
| `12-pause-resume-guide.png` | Pause menu — resume the first-day guide |

## Quick path

World → Season → Identity → Club → Office. No philosophy beat and no ceremony; the guide stays
reachable from the pause menu.

| File | Beat |
|---|---|
| `13-quick-season.png` | Quick selected; the passport reads Guidance: Quick |
| `14-quick-club-selection.png` | Identity goes straight to the club — philosophy skipped |
| `15-quick-office-no-ceremony.png` | Straight into the office; guide auto-dismissed |
| `16-quick-pause-resume.png` | The guide is still reachable from the pause menu |
| `17-quick-guide-resumed.png` | Resumed at 0/4 — nothing auto-completed by a ceremony that never ran |

## Known issue visible in these shots

In Quick mode the setup step rail still lists **Philosophy**, **Board**, **Signing** and
**Welcome** (`13-quick-season.png`) even though the path skips them. The rail should either hide
the skipped beats or mark them as skipped. Not changed in this pass.
