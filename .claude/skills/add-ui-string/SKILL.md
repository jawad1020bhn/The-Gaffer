---
name: add-ui-string
description: Add or change any text a player can see. Covers the full procedure — a translation key rather than a literal, the entry in en.json, interpolation and plurals, backend message keys, then the vitest gates. The game ships English only; Arabic is announced as coming soon.
when_to_use: Adding a label, button, tooltip, error message, news headline, inbox message, aria-label, or any other user-visible text. Also when changing existing wording, renaming a translation key, or when localeCoverage.test.ts or frontendKeyCoverage.test.ts fails.
argument-hint: "[what the string says or the key you are adding]"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npm exec --no -- vitest run src/i18n), Bash(npm exec --no -- vitest run src/utils), Bash(npm run audit:i18n)
---

# Adding a user-facing string

Follow the root Code quality section; use `i18n-auditor` for translation review and
`ui-accessibility-reviewer` for changed accessible names. `/write-tests` and `ofm-test-reviewer`
provide scenario and regression evidence; key coverage alone does not prove wiring.

OpenFoot Manager ships **English only**. A player-facing literal hardcoded in a component is still
a defect: the key is what lets a second language land later without hunting through the UI. So the
rule is no longer "translate it eleven more times" — it is "**never bypass the catalogue**".

## First: will a player read it?

That is the test, and it is narrower than "a human will read it". If the answer is yes — anywhere in
the UI, or a backend error the UI surfaces — this skill applies and the string needs a key.

If the only reader is an **AI agent** (the MCP server's tool output) or a **modder at a terminal**
(`ofm-cli` output and its scaffold templates, `docs/`), it stays **English prose** and this skill does
not apply. The boundary inside the MCP server: its own private errors reach only the agent, through
`tools.rs::err_result`. But an MCP function that propagates an error from a shared `application::`
service which also backs a Tauri command (such as `application::live_match::*`) must keep the
`be.error.*` key, because the UI shows that error on the Tauri path.

Getting this wrong in the cautious direction is not free — a key no player will ever see still costs
a row in `en.json`, and a row in every locale file of whatever languages ship when it lands. Root
`CLAUDE.md` rule 2 has the table; if a surface is genuinely ambiguous, ask.

## The languages

Source of truth: `SUPPORTED_LANGUAGES` and `UPCOMING_LANGUAGES` in `src/i18n/languages.ts`
(re-exported from `src/i18n/index.ts`).

| Code | Status | Where |
|---|---|---|
| `en` | Shipped, and the source text | `src/i18n/locales/en.json` |
| `ar` | Coming soon — disabled picker row, no locale file | `UPCOMING_LANGUAGES` |

If this table and the registry ever disagree, **the registry wins** — read it.

`resolveSupportedLanguage` maps anything else to `en`, including the eleven codes the game used to
ship (`es`, `pt`, `fr`, `de`, `it`, `ru`, `pt-BR`, `zh-CN`, `cs`, `tr`, `id`). A save written by one of
those versions still opens, in English; `src/store/settingsStore.ts` normalises the stored code so
the picker shows a selection and `Intl` stops formatting money in a language whose text is gone.

This file and `src/CLAUDE.md` are the only two that name the languages. The rest of the repository's
docs say "every locale" on purpose: when `id` was the twelfth, a dozen files were left claiming
eleven. Keep it that way.

---

## Procedure

### 1. Find the right key, don't invent a new one

```bash
# Is this string, or something close, already in the catalogue?
grep -rn "the exact english text" src/i18n/locales/en.json
```

Keys are nested and namespaced by feature (`squad.*`, `tactics.*`, `transfers.*`, `news.*`,
`settings.*`). Put the new key where its siblings live. Reusing an existing key beats adding a
near-duplicate — but do **not** reuse a key across contexts where a translator would need
different wording (a noun label and a button verb are different keys even when English collapses
them).

### 2. Add it to `en.json`, and render it through `t`

English is the only locale file, and the reference for any added later.

Use interpolation for anything dynamic — never build a sentence by concatenating translated
fragments, because word order differs by language:

```jsonc
// wrong — unassemblable in German or Turkish
"signedFor": "signed for",
// right
"signedFor": "{{player}} signed for {{team}} for {{fee}}"
```

Pluralisation uses i18next suffixes (`_one`, `_other`, and the extra forms other languages need).
If a count is involved, check how an existing pluralised key in `en.json` is written and match it.
Ordinals go through `formatOrdinal` (`src/lib/ordinal.ts`), which asks the active language's plural
rule for the form — never write `"2nd"` in a component.

### 3. Write it so it can be translated

The translation step is deferred, not cancelled. What makes it cheap later:

- **Whole sentences, not fragments.** No `"You have " + count + " messages"`.
- **No assumptions about the manager's gender.** A language that agrees a verb or adjective with
  the person addressed cannot render "You reviewed the squad" without knowing it. Prefer "The
  squad review is complete".
- **No currency symbols before a money parameter.** The amount arrives already formatted with the
  player's own symbol; a literal `€` prints `€€12K`. `src/i18n/currencySymbols.test.ts` fails on this.
- **Football vocabulary, not UI vocabulary.** A future translator needs to tell a "fixture" from a
  "match" — keep the key names specific enough to say which is meant.

### 4. Backend strings are keys, not prose

Rust never emits English text for the player. It emits a **translation key**, and the frontend
resolves it:

- `src/utils/backendI18n.ts` — the main mapping
- `src/utils/backendI18nPlayerEvents.ts` — player event messages
- `src/utils/backendI18n.legacy.ts` — keys kept for old saves

So a new inbox message or news headline generated in `ofm_core` means: emit the key on the Rust
side, map it in `backendI18n.ts` if the mapping isn't automatic, and add the key to `en.json`.
`src/utils/backendI18n.localeCoverage.test.ts` covers this half.

### 5. Run the gates

```bash
npm exec --no -- vitest run src/i18n        # localeCoverage + frontendKeyCoverage + index
npm exec --no -- vitest run src/utils       # backendI18n coverage, if you touched backend keys
```

- `frontendKeyCoverage.test.ts` — every literal `t("…")` key in `src/` exists in `en.json`. It
  parses the TypeScript AST, so typo'd keys fail too.
- `localeCoverage.test.ts` — the registry and the files on disk name the same languages, English is
  a complete locale rather than a stub, and every announced language has a label but no file.
- `placeholderParity.test.ts` — placeholder sets match English across every locale on disk.
- `duplicateKeys.test.ts` — no key is written twice in one object, where `JSON.parse` would silently
  keep the last.

Then the advisory sweep:

```bash
npm run audit:i18n
```

**This command always exits 0.** It is a heuristic reporter over both `src/` and `src-tauri/`;
read its output and check whether any candidate it lists is a string you just added. A clean run
is not a pass — the vitest gates are.

---

## Shipping another language

Arabic is the announced next one. Moving it from `UPCOMING_LANGUAGES` to `SUPPORTED_LANGUAGES` is a
deliberate act with four halves, and the tests fail until all four are done:

1. `src/i18n/locales/<code>.json` — a real translation of every `en.json` key.
2. `LIBRARY_LOCALE_FOR_LANGUAGE` in `src/lib/countries.ts` — which `i18n-iso-countries` pack serves
   it, plus the football identity names in that file.
3. `LANG_LOCALE` in `src/lib/dateFormatting.ts` — its `Intl` tag.
4. `SCRIPT_BY_LOCALE` in `src/i18n/fontCoverage.test.ts` — its script, and the font faces that
   script needs bundled in `src/App.css`. Arabic needs an Arabic face and RTL layout review;
   neither exists yet.

Restore the per-locale coverage gates from git history at the same time: the `collectMissingKeys` /
`collectUntranslatedKeys` walkers and `INTENTIONAL_SAME.json` were deleted along with the eleven
locales they checked, because a loop over an empty set passes no matter what is broken.

---

## Checklist

- [ ] Key added to `src/i18n/locales/en.json`, in the right namespace
- [ ] Rendered through `t("…")`, not a literal in the component
- [ ] Whole sentences with interpolation; no concatenated fragments
- [ ] No wording that assumes the manager's gender
- [ ] No currency symbol written before a money parameter
- [ ] Backend keys mapped in `src/utils/backendI18n*.ts` if applicable
- [ ] `npm exec --no -- vitest run src/i18n` green
- [ ] `npm run audit:i18n` output read, not just run
- [ ] Any new `aria-label` uses a translated string, not a hardcoded one
