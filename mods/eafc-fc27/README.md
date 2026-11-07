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

A 685-club world takes a while to build the first time, because the world selector
also generates past seasons (default 12 years). Pick **None** or **6 years** there
for the fastest first load; the history is cosmetic.

**Manual.** Copy the archive into the packages directory and restart:

| OS | Path |
|----|------|
| Linux | `~/.local/share/openfootmanager/packages/` |
| macOS | `~/Library/Application Support/openfootmanager/packages/` |
| Windows | `%APPDATA%\openfootmanager\packages\` |

**Verified against the engine, not just our own validator.** The
`validate-eafc-package` workflow builds `ofm-cli` and runs the loader's own
checks — `validate_package` on the directory and on the packed archive, then a
Rust test (`src-tauri/crates/ofm-cli/tests/eafc_package.rs`) that loads the package
and builds a world from it. On a machine with Rust the same two steps run as:

```bash
cargo run --manifest-path src-tauri/Cargo.toml -p ofm-cli -- validate mods/eafc-fc27
cargo test --manifest-path src-tauri/Cargo.toml -p ofm-cli --test eafc_package
```

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
reputation: the **European Champions Cup** (the 32 best European clubs) and the
**European Trophy Cup** (the next 32). Their fields are written out club by club,
because the engine's reputation selector requires a single country and a
continent-wide cup has not got one.

Squads are complete: every club has at least 18 players, the median is 27, and
the engine's floor is 15. It does top a club up to 22 (its `SQUAD_SLOTS`) when a
squad is thinner than that, and EA lists 37 of these clubs with fewer than 22 —
so the built world holds 18,976 players against the 18,893 here, the difference
being generated squad members. Players keep position, alternate positions, date of birth, nationality, and each player keeps
their position, alternate positions, date of birth, nationality, preferred foot,
weak foot, contract end and (where the database has one) wage.

**Every club has its real city and, where EA licenses one, its real ground** —
Arsenal at the Emirates, Liverpool at Anfield, the Bernabéu, Celtic Park. Each
club also carries a play style read from EA's own tactics (line height and
build-up): Manchester City, Barcelona and Liverpool play possession, Real Madrid
attacking, Newcastle and Brentford counter, Crystal Palace and Wolves defensive.

**Ratings match EA.** The engine ignores a package's `overall` and rates a player
from the attributes it was given, so the attributes are calibrated to land on EA's
overall: Messi 89, Mbappé and Haaland 91, Van Dijk 88, Yamal 90. Squads run from
46 to 91.

The package writes **no `defaultActiveRegions`**. The engine fills the active
regions from the competitions themselves, so every league and cup below is in
scope — including the South American ones.

## Known gaps

- **549 clubs have no stadium name.** EA ships 181 grounds for 878 clubs and
  calls the rest by an unlicensed placeholder (`_El Libertador`); those clubs show
  their city instead.
- **No badges, kits or photos** — the database holds no image assets, only ids
  into EA's own CDN.
- **No managers, formations, tactics or shirt numbers.** The package format has
  no field for them: `StaffRole` stops at assistant manager, and the game
  generates a manager for every club at world build. Real staff cannot be
  authored into the dugout. Likewise the only tactical field is `playStyle`;
  formations, the nine tactic dials, captains, penalty takers and set-piece
  takers are all engine-side.
- **No national teams**, because an OFM player belongs to one club and EA fields
  national sides from the same players.
- **Market values are engine-generated** from ability and age; the database has no
  value column.
- **Women's competitions are not imported**: OFM has no gender split, so they are
  left out rather than mixed into the men's pyramid.
