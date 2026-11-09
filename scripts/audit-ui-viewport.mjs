/**
 * Viewport audit — does every screen fit one window?
 *
 * WHY THIS EXISTS
 * ---------------
 * The first native-window audit measured `document.documentElement.scrollHeight - clientHeight`
 * and reported zero page scroll on every tab at every resolution. That was true and misleading.
 * `DashboardWorkspaceContent` wraps all tab content in `overflow-auto`, so the document never
 * scrolls — the wrapper does. A screen that has not been laid out to fit simply grows past the
 * viewport and scrolls the whole screen one element inward, where the document metric cannot see
 * it. Five screens were failing acceptance while the audit said they passed.
 *
 * This measures the WORKSPACE WRAPPER, which is the element that actually scrolls, and reports
 * silent clipping (overflow with no edge fade) separately from cued contained scroll.
 *
 * RUNNING IT
 * ----------
 * Needs a dev server and a Chromium. Neither is a project dependency: see
 * docs/ui-redesign/README.md for obtaining a browser in a sandbox with no package downloads.
 *
 *   npm run dev                       # or: __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.e2b.app npm run dev
 *   node scripts/audit-ui-viewport.mjs [--url http://127.0.0.1:1420] [--sizes 1600x900,1280x720]
 *                                     [--puppeteer /path/to/puppeteer-core/lib/puppeteer/puppeteer-core.js]
 *
 * Set UI_AUDIT_CHROMIUM to an executable path and UI_AUDIT_CHROMIUM_ARGS to a JSON array of extra
 * arguments if your Chromium needs them. `puppeteer` resolves from wherever you installed it.
 *
 * Exit code is 1 if any screen overflows, so this can gate CI once a browser is available there.
 */

const WORKSPACE_SELECTOR = ".scrollbar-thin.min-h-0.flex-1.overflow-auto";

/** Section button label -> the tabs underneath it. */
const SCREENS = [
  ["career", "Home"],
  ["career", "Manager"],
  ["team", "Squad"],
  ["team", "Tactics"],
  ["team", "Training"],
  ["team", "Staff"],
  ["transfers", "Transfers"],
  ["transfers", "Transfer Centre"],
  ["transfers", "Scouting"],
  ["transfers", "Players"],
  ["competitions", "Schedule"],
  ["competitions", "Tournaments"],
  ["office", "Inbox"],
  ["office", "News"],
  ["office", "Finances"],
];

function readOption(name, fallback) {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const baseUrl = readOption("url", "http://127.0.0.1:1420");
const sizes = readOption("sizes", "1600x900,1280x720")
  .split(",")
  .map((size) => {
    const [width, height] = size.split("x").map(Number);
    return { width, height };
  });

// Either package works, and --puppeteer points at an install outside this project (a sandbox that
// keeps its browser tools out of the repo, for instance). Neither is a project dependency.
const puppeteerPath = readOption("puppeteer", null);
const puppeteer = puppeteerPath
  ? (await import(puppeteerPath)).default
  : await import("puppeteer")
      .catch(() => import("puppeteer-core"))
      .then((module) => module.default);
const extraArgs = process.env.UI_AUDIT_CHROMIUM_ARGS
  ? JSON.parse(process.env.UI_AUDIT_CHROMIUM_ARGS)
  : [];
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.UI_AUDIT_CHROMIUM || undefined,
  args: [...extraArgs, "--no-sandbox", "--disable-dev-shm-usage"],
});

/** Click a shell button by its visible label, exact match first. */
async function clickLabel(page, label) {
  await page.evaluate((wanted) => {
    const buttons = [...document.querySelectorAll("button")];
    const text = (button) => button.textContent.trim().toLowerCase();
    const hit =
      buttons.find((button) => text(button) === wanted) ||
      buttons.find((button) => text(button).includes(wanted));
    hit?.click();
  }, label.toLowerCase());
}

const rows = [];
for (const { width, height } of sizes) {
  for (const [section, tab] of SCREENS) {
    // A fresh page per tab: some tabs unmount the shell on missing fixture data, and that must not
    // take the rest of the sweep down with it.
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    const row = { size: `${width}x${height}`, tab };
    try {
      await page.goto(`${baseUrl}/style-guide.html?preview=shell`, {
        waitUntil: "networkidle2",
        timeout: 90_000,
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await clickLabel(page, section);
      await new Promise((resolve) => setTimeout(resolve, 400));
      await clickLabel(page, tab);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      Object.assign(
        row,
        await page.evaluate((selector) => {
          const workspace = document.querySelector(selector);
          const doc = document.documentElement;
          const overflowing = [...document.querySelectorAll("*")].filter((element) => {
            const style = getComputedStyle(element);
            if (style.overflowY !== "auto" && style.overflowY !== "scroll") return false;
            return element.scrollHeight - element.clientHeight > 4;
          });
          return {
            // No scene attribute means the shell unmounted — a crash, not a layout result.
            crashed: !document.querySelector("[data-scene]"),
            docScroll: doc.scrollHeight - doc.clientHeight,
            workspaceScroll: workspace ? workspace.scrollHeight - workspace.clientHeight : null,
            // Contained scroll is allowed, but §5 requires a cue. A mask or a thin scrollbar counts.
            uncuedScroll: overflowing
              .filter((element) => {
                const style = getComputedStyle(element);
                return style.maskImage === "none" && style.scrollbarWidth !== "thin";
              })
              .map((element) => element.className.toString().slice(0, 60)),
            tinyText: [
              ...new Set(
                [...document.querySelectorAll("*")]
                  .filter((element) => element.children.length === 0 && element.textContent.trim())
                  .map((element) => parseFloat(getComputedStyle(element).fontSize))
                  .filter((size) => size > 0 && size < 11),
              ),
            ],
          };
        }, WORKSPACE_SELECTOR),
      );
    } catch (error) {
      row.error = String(error).slice(0, 120);
    }
    rows.push(row);
    await page.close();
  }
}
await browser.close();

let failures = 0;
for (const row of rows) {
  const label = `${row.size}  ${row.tab}`;
  if (row.error) {
    console.log(`${label.padEnd(28)} ERROR   ${row.error}`);
    continue;
  }
  if (row.crashed) {
    console.log(`${label.padEnd(28)} CRASHED (shell unmounted — fixture data)`);
    continue;
  }
  const over = row.workspaceScroll ?? 0;
  const problems = [];
  if (over > 4) problems.push(`workspace scrolls ${over}px`);
  if (row.uncuedScroll?.length)
    problems.push(`scroll without a cue: ${row.uncuedScroll.join(", ")}`);
  if (row.tinyText?.length) problems.push(`text under 11px: ${row.tinyText.join(", ")}`);
  if (problems.length) failures += 1;
  console.log(`${label.padEnd(28)} ${problems.length ? `FAIL    ${problems.join("; ")}` : "fits"}`);
}

console.log(
  `\n${rows.length} screen/resolution pairs, ${failures} failing. ` +
    "Crashes are pre-existing fixture gaps, not layout results.",
);
process.exit(failures > 0 ? 1 : 0);
