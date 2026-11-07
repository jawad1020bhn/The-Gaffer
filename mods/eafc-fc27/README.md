# EA FC 27 — Clubs & Players

An unofficial Openfoot Manager database of **685 real clubs**, **18,893 real
players** and **38 competitions**, imported from the EA FC 27 database by
[`tools/eafc-import`](../../tools/eafc-import/README.md).

Unofficial and unaffiliated with EA. The data belongs to EA; keep it for personal
use. Upstream OFM ships no licensed data on purpose (`VISION.md`), which is why
this is a mod and not part of the engine.

## Install

**In game (easiest).** New Game → world selection → **+** (Install Package) →
pick `mods/eafc-fc27.ofm`.

**Manual.** Copy the archive into the packages directory and restart:

| OS | Path |
|----|------|
| Linux | `~/.local/share/openfootmanager/packages/` |
| macOS | `~/Library/Application Support/openfootmanager/packages/` |
| Windows | `%APPDATA%\openfootmanager\packages\` |

`eafc-fc27.ofm` is generated, not tracked. Rebuild it with:

```bash
node tools/eafc-import/import.mjs --kit ../eafc-db-kit --version "FC 27" --out mods/eafc-fc27
```

## What is in it

**34 domestic leagues** across 46 countries, from the Premier League and its
three tiers below it, La Liga, Serie A, the Bundesliga pyramid, Ligue 1 and Ligue
2, the Eredivisie, the Primeira Liga, the Süper Lig, MLS and Liga MX, through to
the Saudi Pro League, the A-League, the K League, the Chinese Super League, the
Indian Super League and the Argentine Primera División. Divisions are ordered as
tiers, so promotion and relegation chain through each national pyramid.

**4 continental competitions.** CONMEBOL Libertadores and Sudamericana keep their
real fields from the database (which is also how Brazilian clubs get in — EA
carries no Brazilian league). The two European cups are generated from club
reputation: the **European Champions Cup** (top 32) and the **European Trophy
Cup** (the next 32).

Squads are complete: every club has at least 18 players, the median is 27, and
each player keeps their position, alternate positions, date of birth, nationality,
preferred foot, weak foot, ability, potential, contract end and (where the
database has one) wage.

## Known gaps

- **Cities are best-effort.** EA ships `cityid` without names, so a club's city is
  recovered from its name or from another club sharing its `cityid`; the rest fall
  back to the country name.
- **No badges, kits, stadium names or photos** — the database has none.
- **No national teams**, because an OFM player belongs to one club and EA fields
  national sides from the same players.
- **Market values are engine-generated** from ability and age; the database has no
  value column.
- **Women's competitions are not imported**: OFM has no gender split, so they are
  left out rather than mixed into the men's pyramid.
