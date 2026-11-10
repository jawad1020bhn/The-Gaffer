/** Automated WCAG sweep. Needs an external puppeteer/axe-core install, no project dependencies.
 * node scripts/audit-ui-accessibility.mjs --puppeteer /absolute/path/to/puppeteer-core.js
 *   --axe /absolute/path/to/axe.min.js [--url http://127.0.0.1:1420] [--output report.json]
 * Uses UI_AUDIT_CHROMIUM and UI_AUDIT_CHROMIUM_ARGS like audit-ui-viewport.mjs.
 * Zero violations is NOT proof of conformance: retain incomplete findings for manual review.
 */
import { writeFile } from "node:fs/promises";
const option = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const baseUrl = option("url", "http://127.0.0.1:1420");
const axePath = option("axe", null);
if (!axePath) throw new Error("Pass --axe /absolute/path/to/axe.min.js");
const output = option("output", "accessibility-audit.json");
const puppeteer = (await import(option("puppeteer", "puppeteer-core"))).default;
const TABS = [
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
const b = await puppeteer.launch({
  args: JSON.parse(process.env.UI_AUDIT_CHROMIUM_ARGS || "[]"),
  executablePath: process.env.UI_AUDIT_CHROMIUM || undefined,
  headless: true,
});
const rows = [];
for (const [sec, tab] of TABS) {
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 900 });
  try {
    await p.goto(`${baseUrl}/style-guide.html?preview=shell`, {
      waitUntil: "networkidle2",
      timeout: 90000,
    });
    await new Promise((r) => setTimeout(r, 1500));
    for (const l of [sec, tab]) {
      await p.evaluate((l) => {
        const xs = [...document.querySelectorAll("button")];
        const b =
          xs.find((x) => x.textContent.trim().toLowerCase() === l) ||
          xs.find((x) => x.textContent.trim().toLowerCase().includes(l));
        b?.click();
      }, l.toLowerCase());
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!(await p.$("[data-scene]"))) throw new Error("Preview crashed: fixture gap");
    await p.addScriptTag({ path: axePath });
    const r = await p.evaluate(async () => {
      const r = await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      });
      return {
        violations: r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
        incomplete: r.incomplete.map((v) => ({ id: v.id, count: v.nodes.length })),
      };
    });
    rows.push({ tab, ...r });
  } catch (e) {
    rows.push({ tab, error: String(e).slice(0, 50) });
  }
  await p.close();
}
await b.close();
await writeFile(
  output,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      viewport: "1600x900",
      standard: "WCAG 2.1 A/AA (automated only)",
      screens: rows,
    },
    null,
    2,
  ) + "\n",
);
for (const row of rows)
  console.log(
    row.tab,
    row.error || `${row.violations.length} violations; ${row.incomplete.length} rules need review`,
  );
if (rows.some((row) => row.error || row.violations.length)) process.exitCode = 1;
