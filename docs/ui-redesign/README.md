# UI redesign — screenshots

Captured in headless Chromium from the running dev server, dark presentation, on the shell preview
career (`/style-guide.html?preview=shell`). Same career, same data, same routes on both sides of
every comparison — only the material layer differs.

| File | What it shows |
| --- | --- |
| [comparison.png](comparison.png) | **Before / after** for Home, Schedule and Inbox at 960×640, the game's minimum window. |
| [rooms.png](rooms.png) | Four pages at 1600×900. The room resolves from the tab; Manager inherits Career's office. |
| [materials.png](materials.png) | The style guide's *Materials, depth and scenes* section: three scene strengths, four finishes, the three state variants, and all twelve new tokens. |
| [home-1280x800.png](home-1280x800.png) | Home after, at the window the game opens at. |
| [home-960x640.png](home-960x640.png) | Home after, at the minimum window. |

## What to look at

- **Home** — the crowd survives across the next-fixture header and is gone by the team names. The
  office desk and notebook appear in the dead space below the bands, which was flat black before.
- **Schedule** — the brushed-metal season wall behind the whole workspace. This is the shot that
  caught the bug: `DashboardWorkspaceContent` carried its own `bg-page` and painted over the plate,
  so the scene loaded, graded and positioned correctly and was visible nowhere.
- **Inbox** — the boardroom behind the list and the reading pane.
- **News** — the press room: empty press seats in the foreground, table and microphones beyond.
- **Panel headers** — now a band with a lit top edge rather than a rule on a flat fill.

## Known gaps in these shots

These are the **preview harness**, not the game: it has no Rust backend, so anything that fetches
shows its loading or empty state. Schedule's matchday groups are skeletons for that reason.

Two pre-existing issues are visible and were **not** introduced by this work:

- Hall of Fame crashes the preview (`titles` is undefined in `HallOfFameWorldTab.tsx:29` — the
  fixture has no titles). Verified against the pre-redesign source; it fails there too.
- News shows a raw `news.categories.general` key — an i18n gap in the preview fixture's wire copy.

## Reproducing

The sandbox blocks Chromium's normal download hosts, so the browser came from `@sparticuz/chromium`,
whose npm tarball carries both the binary and its shared libraries. Its library setup is gated on
Amazon Linux, so on Debian it has to be run by hand:

```js
import { inflate } from "./node_modules/@sparticuz/chromium/build/lambdafs.js";
import { setupLambdaEnvironment } from "./node_modules/@sparticuz/chromium/build/helper.js";
await inflate("node_modules/@sparticuz/chromium/bin/al2023.tar.br");
setupLambdaEnvironment("/tmp/al2023/lib");
```

Then `puppeteer-core` with `chromium.executablePath()` and `chromium.args`. On a normal machine
`docs/DESIGN_SYSTEM.md` §8 has the plain `google-chrome --headless` recipe.


## Automated accessibility sweep

Install `puppeteer-core` and `axe-core` in an external tooling directory, not this project's dependencies.
With the dev server running:

```sh
node scripts/audit-ui-accessibility.mjs \
  --puppeteer /absolute/path/to/puppeteer-core/lib/puppeteer/puppeteer-core.js \
  --axe /absolute/path/to/axe-core/axe.min.js \
  --output docs/ui-redesign/accessibility-audit.json
```

Uses the same `UI_AUDIT_CHROMIUM` and `UI_AUDIT_CHROMIUM_ARGS` environment variables as the viewport
check. Runs at 1600×900; saves incomplete rules as well as violations. Zero violations does not mean
WCAG conformance: layered/translucent scenes require manual contrast review. The four fixture-crashing
screens are outside this sweep, just as they are outside the viewport sweep.

Panel navigation: **Alt+arrows** in the workspace. Regular arrows retain their normal widget behavior.
Tactics comparison demonstrates the right-side drawer; destructive confirmation dialogs remain centered.
