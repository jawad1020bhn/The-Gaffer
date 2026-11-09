# EA FC 27 — Clubs & Players

An unofficial Openfoot Manager database of **684 clubs**, **18,875 player
rows** and **38 competitions**, imported from the EA FC 27 database by
[`tools/eafc-import`](../../tools/eafc-import/README.md).

**Data cleanup (0.1.1):** removed a placeholder club and 18 fake players; added
95 source-backed historical ground names. Still, 20 clubs have no competition
membership, 1,877 contracts end before the 2027 base year, and wages and
goalkeeper weak-foot values are incomplete. No national-team or real staff
records are included. Read the [corrections and remaining limitations](DATA_QUALITY.md)
before treating this as a season-ready real-world database.

Unofficial and unaffiliated with EA. The data belongs to EA; keep it for personal use.

**This diverges from upstream on purpose.** Upstream OFM ships no licensed data (`VISION.md`:
"No licensed real-world data"), which is why this lives in `mods/` and not in the engine. This
fork ships it as the default world anyway. The engine still contains none of it: the database is
a package the loader reads, the generated world is untouched, and unticking the package restores
upstream behaviour exactly. Anyone redistributing a build should read `VISION.md` and EA's terms
first — making it the default is a distribution decision, not just a convenience.

## This is the game's default world

**Nothing to install.** Every build ships this database, and a new career starts on it:
`predev`/`prebuild` run [`scripts/pack-bundled-world.mjs`](../../scripts/pack-bundled-world.mjs),
which packs this directory into `src-tauri/packages/eafc-fc27.ofm`; Tauri ships that archive as a
resource; the game copies it into your own package directory the first time it lists packages and
pre-selects it on the new-game screen. You should see Arsenal, Real Madrid and the rest — not
generated clubs.

`tauri dev` reads the same archive straight out of `src-tauri/packages`, so a development build
defaults to the same world a release does.

The generated world is still there. Untick this package on the new-game screen to play a
procedurally generated one instead; nothing was removed to make this the default.

A 684-club world takes a while to build the first time, because the world selector
also generates past seasons (default 12 years). Pick **None** or **6 years** there
for the fastest first load; the history is cosmetic.

**Installing a copy by hand** is only needed if you uninstalled it. Copy the archive into
the packages directory and restart:

| OS | Path |
|----|------|
| Linux | `~/.local/share/openfootmanager/packages/` |
| macOS | `~/Library/Application Support/openfootmanager/packages/` |
| Windows | `%APPDATA%\openfootmanager\packages\` |

**Engine checks, not just our own validator, are provided in CI.** The
`validate-eafc-package` workflow builds `ofm-cli` and runs the loader's own
checks — `validate_package` on the directory and on the packed archive, then a
Rust test (`src-tauri/crates/ofm-cli/tests/eafc_package.rs`) that loads the package
and builds a world from it. On a machine with Rust the same two steps run as:

```bash
cargo run --manifest-path src-tauri/Cargo.toml -p ofm-cli -- validate mods/eafc-fc27
cargo test --manifest-path src-tauri/Cargo.toml -p ofm-cli --test eafc_package
```

The shipped archive is generated, not tracked (`src-tauri/packages/` is ignored, and
`scripts/check-untracked-generated.sh` fails the build if it is ever committed). Rebuild it from
this directory with:

```bash
npm run world:pack
```

Rebuilding **this directory** from the EA source is the separate, heavier step, and needs the
upstream kit:

```bash
node tools/eafc-import/import.mjs --kit ../eafc-db-kit --version "FC 27" --out mods/eafc-fc27
```

Add badges from a separate graphics pack with `--badges` (packs are versioned
and distributed outside Git):

```bash
node tools/eafc-import/import.mjs --kit ../eafc-db-kit --version "FC 27" \
  --out mods/eafc-fc27 --badges ../eafc-fc27-badges
```

## What is in it

**34 domestic leagues** across 26 countries (the clubs span 46 countries), from the Premier League and its
three tiers below it, La Liga, Serie A, the Bundesliga pyramid, Ligue 1 and Ligue
2, the Eredivisie, the Primeira Liga, the Süper Lig, MLS and Liga MX, through to
the Saudi Pro League, the A-League, the K League, the Chinese Super League, the
Indian Super League and the Argentine Primera División. Divisions are ordered as
tiers, so promotion and relegation chain through each national pyramid.

**4 continental competitions.** CONMEBOL Libertadores and Sudamericana keep their
real fields from the database (which is also how Brazilian clubs get in — EA
carries no Brazilian league). The two European club competitions the database
does not carry are authored from club reputation: the **UEFA Champions League**
(the 32 best European clubs) and the **UEFA Europa League** (the next 32). Their
fields are written out club by club, because the engine's reputation selector
requires a single country and a continent-wide cup has not got one.

Competition logos are not shipped checked-in. `tools/eafc-import --competition-logos <pack>`
packs a separate, versioned graphics pack into the `.ofm`; per-asset source,
licence, attribution and checksum travel inside it (see the importer README).
Without a logo pack, competitions render with no badge.

Every club has at least 18 source players, the median is 27, and the engine's
floor is 15. The game tops up squads below 22 (its `SQUAD_SLOTS`); 36 clubs here
need that, so a built world contains generated players beyond the 18,875 source
records. Position, alternate positions, date of birth, nationality, preferred
foot and contract end are imported. Weak foot is authored for 16,801 outfield
players; the current engine re-infers goalkeeper identity on load. Only 440
players have a positive source wage. Generated/defaulted values are not
verified real-world data.

**Every club plays its real shape.** Formations come from EA's per-club datum —
Arsenal and Manchester City 4-2-3-1, Barcelona 4-2-1-3, Juventus 3-4-2-1,
Leverkusen 4-3-3 — across 19 distinct shapes rather than every club in 4-4-2. EA
writes a few in five lines (Real Madrid's 4-1-2-1-2); those are folded to the four
the engine lays out (4-3-1-2).

**Ground names come from 136 EA mappings and 95 reviewed supplemental mappings.**
Examples from EA include the Emirates, Anfield, the Bernabéu and Celtic Park.
Supplemental names are from a dated 2025 snapshot, not a verified 2027 venue or
sponsorship update. Each
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

- **453 clubs have no stadium name.** Unresolved grounds retain the city-based
  fallback; generic EA placeholder names are not presented as real grounds.
- **Badges, competition logos and player mini-faces are separate optional
  packs** — the database holds no image assets, only ids into EA's own CDN, so
  the checked-in package ships without them and clubs/competitions/players draw
  generated fallbacks. `tools/eafc-import --badges <pack> --competition-logos
  <pack> --player-faces <pack>` packs separate, versioned graphics packs into
  the `.ofm`; per-asset source, licence, attribution and checksum travel inside
  it (see the importer README). Kits are not imported.
- **No imported managers or backroom staff.** Verified staff can be authored for
  supported roles, but there is no club-manager schema. The game generates
  managers; an assistant-manager record is not a substitute for a real manager.
- **No tactic dials, shirt numbers, captains or set-piece takers.** The package
  carries `playStyle` and `formation`; the nine dials behind a style are derived
  by the engine, and the rest have no field at all.
- **No national teams**, because an OFM player belongs to one club and EA fields
  national sides from the same players.
- **Market values are engine-generated** from ability and age; the database has no
  value column.
- **Women's competitions are not imported**: OFM has no gender split, so they are
  left out rather than mixed into the men's pyramid.
