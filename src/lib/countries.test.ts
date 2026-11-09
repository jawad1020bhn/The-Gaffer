import { describe, it, expect } from "vitest";
import {
  countryName,
  allCountries,
  allNationalities,
  isValidCountryCode,
  COUNTRY_PACKS,
  LIBRARY_LOCALE_FOR_LANGUAGE,
  normaliseNationality,
  resolveCountryFlagCode,
} from "./countries";

// ---------------------------------------------------------------------------
// resolveCountryFlagCode
// ---------------------------------------------------------------------------

describe("resolveCountryFlagCode", () => {
  it("returns a valid code when an SVG flag is available", () => {
    expect(resolveCountryFlagCode("US")).toBe("US");
    expect(resolveCountryFlagCode("GB")).toBe("GB");
    expect(resolveCountryFlagCode("br")).toBe("BR");
    expect(resolveCountryFlagCode("IE")).toBe("IE");
    expect(resolveCountryFlagCode("ENG")).toBe("GB-ENG");
    expect(resolveCountryFlagCode("SCO")).toBe("GB-SCT");
    expect(resolveCountryFlagCode("WAL")).toBe("GB-WLS");
    expect(resolveCountryFlagCode("NIR")).toBe("GB-NIR");
  });

  it("normalises demonym values before resolving", () => {
    expect(resolveCountryFlagCode("English")).toBe("GB-ENG");
    expect(resolveCountryFlagCode("Brazilian")).toBe("BR");
    expect(resolveCountryFlagCode("Irish")).toBe("IE");
  });

  it("returns null for invalid values", () => {
    expect(resolveCountryFlagCode("")).toBeNull();
    expect(resolveCountryFlagCode("X")).toBeNull();
    expect(resolveCountryFlagCode("USA")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// countryName
// ---------------------------------------------------------------------------

describe("countryName", () => {
  it("returns English country name by default", () => {
    expect(countryName("GB")).toMatch(/United Kingdom/);
    expect(countryName("US")).toMatch(/United States/);
    expect(countryName("ENG")).toBe("England");
  });

  /**
   * Given the game ships English only
   * When a country and a football identity are named in English
   * Then both resolve, including the identities the ISO library has no entry for
   */
  it("returns the English name for the shipped locale", () => {
    expect(countryName("FR", "en")).toBe("France");
    expect(countryName("DE", "en")).toBe("Germany");
    expect(countryName("ENG", "en")).toBe("England");
  });

  it("falls back to English for unknown locale", () => {
    const name = countryName("IT", "xx");
    expect(name).toMatch(/Italy/);
  });

  it("returns empty string for empty input", () => {
    expect(countryName("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// allCountries
// ---------------------------------------------------------------------------

describe("allCountries", () => {
  it("returns an array of { code, name } objects", () => {
    const list = allCountries("en");
    expect(list.length).toBeGreaterThan(100);
    expect(list[0]).toHaveProperty("code");
    expect(list[0]).toHaveProperty("name");
  });

  it("is sorted by name", () => {
    const list = allCountries("en");
    for (let i = 1; i < list.length; i++) {
      expect(list[i].name.localeCompare(list[i - 1].name, "en")).toBeGreaterThanOrEqual(0);
    }
  });

  it("contains well-known countries", () => {
    const list = allCountries("en");
    const codes = list.map((c) => c.code);
    expect(codes).toContain("US");
    expect(codes).toContain("GB");
    expect(codes).toContain("BR");
  });

  /**
   * Given a locale the game no longer ships
   * When the whole list is built
   * Then every name is English, so the list is not a mix of a dropped pack and the fallback
   */
  it("returns English country names for a locale that is not shipped", () => {
    for (const locale of ["it", "cs", "tr"]) {
      const germany = allCountries(locale).find((country) => country.code === "DE");
      expect(germany?.name, locale).toBe("Germany");
    }
  });
});

describe("allNationalities", () => {
  it("surfaces football nations and excludes legacy GB from the selectable list", () => {
    const list = allNationalities("en");
    const codes = list.map((country) => country.code);

    expect(codes).toContain("ENG");
    expect(codes).toContain("SCO");
    expect(codes).toContain("WAL");
    expect(codes).toContain("NIR");
    expect(codes).toContain("IE");
    expect(codes).not.toContain("GB");
  });

  it("restricts the list to the allow-list when one is given (#270)", () => {
    // Simulates the backend NATION_CATALOG being the source of truth: only
    // catalog codes are offered, so no selectable nationality can fail import.
    const list = allNationalities("en", ["ENG", "BR", "AM", "GW"]);
    const codes = list.map((country) => country.code);

    expect(codes.sort()).toEqual(["AM", "BR", "ENG", "GW"]);
    // A valid ISO country outside the allow-list must not appear.
    expect(codes).not.toContain("FR");
  });

  it("falls back to the full ISO list when the allow-list is empty or absent", () => {
    const withEmpty = allNationalities("en", []).map((country) => country.code);
    const withNull = allNationalities("en", null).map((country) => country.code);

    expect(withEmpty).toContain("FR");
    expect(withNull).toContain("FR");
  });
});

// ---------------------------------------------------------------------------
// isValidCountryCode
// ---------------------------------------------------------------------------

describe("isValidCountryCode", () => {
  it("returns true for valid alpha-2 codes", () => {
    expect(isValidCountryCode("US")).toBe(true);
    expect(isValidCountryCode("GB")).toBe(true);
    expect(isValidCountryCode("br")).toBe(true); // case-insensitive
    expect(isValidCountryCode("ENG")).toBe(true);
    expect(isValidCountryCode("NIR")).toBe(true);
  });

  it("returns false for invalid codes", () => {
    expect(isValidCountryCode("")).toBe(false);
    expect(isValidCountryCode("X")).toBe(false);
    expect(isValidCountryCode("ZZ")).toBe(false);
    expect(isValidCountryCode("USA")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normaliseNationality
// ---------------------------------------------------------------------------

describe("normaliseNationality", () => {
  it("returns alpha-2 code as-is if already valid", () => {
    expect(normaliseNationality("GB")).toBe("GB");
    expect(normaliseNationality("ES")).toBe("ES");
    expect(normaliseNationality("ENG")).toBe("ENG");
  });

  it("converts known demonyms to alpha-2 codes", () => {
    expect(normaliseNationality("English")).toBe("ENG");
    expect(normaliseNationality("Scottish")).toBe("SCO");
    expect(normaliseNationality("Welsh")).toBe("WAL");
    expect(normaliseNationality("Irish")).toBe("IE");
    expect(normaliseNationality("Northern Irish")).toBe("NIR");
    expect(normaliseNationality("Spanish")).toBe("ES");
    expect(normaliseNationality("Brazilian")).toBe("BR");
    expect(normaliseNationality("German")).toBe("DE");
    expect(normaliseNationality("French")).toBe("FR");
  });

  it("converts recognised country names to alpha-2 codes", () => {
    expect(normaliseNationality("Spain")).toBe("ES");
    expect(normaliseNationality("Germany")).toBe("DE");
    expect(normaliseNationality("Italy")).toBe("IT");
    expect(normaliseNationality("Netherlands")).toBe("NL");
  });

  it("returns the original value for unknown demonyms", () => {
    expect(normaliseNationality("Martian")).toBe("Martian");
  });

  it("returns empty string for empty input", () => {
    expect(normaliseNationality("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Country names in the shipped language (#614)
// ---------------------------------------------------------------------------

describe("country names in the shipped language", () => {
  /**
   * Given each language the game ships
   * When its country-name pack is looked up
   * Then the pack exists and is a pack for exactly that library locale.
   *      (Vitest loads the library's Node entry, which registers every pack,
   *      so a pack dropped from the registry would otherwise go unnoticed.)
   */
  it.each(Object.entries(LIBRARY_LOCALE_FOR_LANGUAGE))(
    "serves %s from a registered pack",
    (_language, libraryLocale) => {
      const pack = (COUNTRY_PACKS as Record<string, { locale: string }>)[libraryLocale];

      expect(pack?.locale).toBe(libraryLocale);
    },
  );

  /**
   * Given English is the only shipped language
   * When an ISO country and a football-only identity are named
   * Then both come from the English pack, so the football identities the library has no entry
   *      for (England, Scotland, Northern Ireland, Republic of Ireland) are not shown as codes
   */
  it("names ISO countries and football identities in English", () => {
    expect(countryName("DE", "en")).toBe("Germany");
    expect(countryName("ENG", "en")).toBe("England");
    expect(countryName("SCO", "en")).toBe("Scotland");
    expect(countryName("NIR", "en")).toBe("Northern Ireland");
    expect(countryName("IE", "en")).toBe("Republic of Ireland");
  });

  /**
   * Given a save or a package that names a language this version dropped
   * When a country name is requested in it
   * Then the English name is served rather than the raw code: the display language falls back,
   *      and country names have to follow it
   */
  it("serves English names for a language the game no longer ships", () => {
    for (const locale of ["de", "pt-BR", "ru", "zh-CN", "id", "ar"]) {
      expect(countryName("DE", locale), locale).toBe("Germany");
      expect(countryName("SCO", locale), locale).toBe("Scotland");
    }
  });

  /**
   * Given the nationality list is built for a locale that falls back to English
   * When it is sorted and named
   * Then it matches the English list exactly, football nations included
   */
  it("lists nationalities in English for a dropped language", () => {
    const english = allNationalities("en");
    expect(english.map(({ name }) => name)).toContain("England");
    expect(allNationalities("de")).toEqual(english);
  });
});
