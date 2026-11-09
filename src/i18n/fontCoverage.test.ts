import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from "./index";

/**
 * The font subset each locale needs from the bundled Inter.
 *
 * English only today. The union type keeps the wider decision on record for the next language:
 * `latin-ext` for accents beyond the basic Latin range, `cyrillic` for Russian, and `cjk` — which
 * is deliberately not bundled, because a 5-10 MB face per weight is not worth shipping, so a
 * Chinese locale would fall through the stack to the system's CJK face.
 */
const SCRIPT_BY_LOCALE: Record<SupportedLanguageCode, "latin" | "latin-ext" | "cyrillic" | "cjk"> =
  {
    en: "latin",
  };

const INTER_WEIGHTS = [400, 500, 600, 700];

function appCss(): string {
  return readFileSync("src/App.css", "utf-8");
}

/**
 * App.css without its comments. The gates below ask what the stylesheet *declares*; the comments
 * explain what was removed and what a future language needs, so they name scripts the app no longer
 * bundles and must not be read as declarations.
 */
function cssDeclarations(): string {
  return appCss().replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("bundled font coverage", () => {
  /**
   * Given every locale the game ships
   * When the font subsets they need are looked up
   * Then each locale names its script, so the next locale cannot ship without a decision here
   */
  it("knows the script of every supported locale", () => {
    expect(Object.keys(SCRIPT_BY_LOCALE).sort()).toEqual(
      SUPPORTED_LANGUAGES.map(({ code }) => code).sort(),
    );
  });

  /**
   * Given the Latin scripts the game bundles Inter for
   * When App.css is read
   * Then Inter's face for each is imported at every weight the UI uses
   */
  it.each(["latin", "latin-ext"])("bundles Inter %s at every UI weight", (script) => {
    const css = appCss();

    for (const weight of INTER_WEIGHTS) {
      expect(css).toContain(`@import "@fontsource/inter/${script}-${weight}.css";`);
    }
  });

  /**
   * Given no shipped language is written in Cyrillic
   * When App.css is read
   * Then no Cyrillic face is bundled. These faces were shipped for Russian; keeping them after
   * the locale went would pull ~10 woff2 files into every build for text no screen can produce.
   * A Cyrillic locale added later restores them, and this assertion is what asks for that.
   */
  it("bundles no Cyrillic face while no Cyrillic language ships", () => {
    const cyrillicLocales = Object.entries(SCRIPT_BY_LOCALE).filter(
      ([, script]) => script === "cyrillic",
    );
    expect(cyrillicLocales).toEqual([]);

    expect(cssDeclarations()).not.toMatch(/cyrillic/i);
  });

  /**
   * Given Barlow Condensed is the heading face
   * When the heading stack is read
   * Then it is named first. It used to be followed by a condensed Cyrillic fallback for Russian
   * headings; with no Cyrillic locale there is nothing for that face to draw.
   */
  it("leads the heading stack with Barlow Condensed", () => {
    const headingStack = appCss().match(/--font-heading:\s*([^;]+);/)?.[1] ?? "";

    expect(headingStack).toMatch(/^"Barlow Condensed"/);
  });
});
