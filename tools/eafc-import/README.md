# eafc-import

Turns an EA FC database into an Openfoot Manager package, so the game can be
played with real clubs, real squads and real leagues.

```bash
git clone https://github.com/ViniMacacari/eafc-db-kit ../eafc-db-kit
git -C ../eafc-db-kit checkout --detach 1464907bf4e726504d8b3ce15ffd0a552990565e
cd ../eafc-db-kit && npm ci   # builds the kit, which ships the databases

cd ../the-gaffer-v0.4
node tools/eafc-import/import.mjs --kit ../eafc-db-kit --version "FC 27" --out mods/eafc-fc27
node tools/eafc-import/validate.mjs mods/eafc-fc27
```

The run writes a package directory and a ready-to-install `mods/eafc-fc27.ofm`
(`--no-pack` skips the archive). Use Node 24+ for the current upstream kit;
the only dependency is the kit checkout itself. The audit and importer unit
tests can also run without a kit checkout.

## Club badges (optional graphics pack)

`import.mjs --badges <pack>` points the importer at a separate graphics pack: a
folder of badge images plus a `manifest.json` that records, per asset, its
source, licence, attribution and sha256 checksum.

```bash
node tools/eafc-import/import.mjs --kit ../eafc-db-kit --version "FC 27" \
  --out mods/eafc-fc27 --badges ../eafc-fc27-badges
```

The pack is **not** fetched live and is **not** embedded in the game's code:
it lives beside the package and is versioned and distributed separately. The
importer verifies every checksum before packing, so a corrupted or swapped
badge never reaches the archive, and the manifest travels inside the `.ofm`
so an installed package still documents where each badge came from.

### Pack format

```
<pack>/
  manifest.json
  <eaTeamId>.png           one badge file per EA team id
```

`manifest.json`:

```json
{
  "version": 1,
  "source": "https://example.com/badge-pack",
  "licence": "CC-BY-4.0",
  "badges": [
    {
      "eaTeamId": 1,
      "ofmClubId": "arsenal",
      "file": "1.png",
      "source": "https://example.com/1.png",
      "licence": "CC-BY-4.0",
      "attribution": "Example Pack",
      "checksum": "sha256:<64 hex>"
    }
  ]
}
```

- `eaTeamId` is the EA FC team id — the crosswalk key. Badges are matched on
  EA id, never on club name, so a badge survives club-name changes and
  re-imports from another database vintage.
- `ofmClubId` is the club id this badge was matched to in the package
  (informational).
- `file` is the badge file name inside the pack folder; inside the package it
  lands at `assets/clubs/<eaTeamId><ext>`.
- `checksum` is `sha256:<hex>` of the file bytes, verified on import.

Clubs without a badge keep the generated crest fallback, so a partial pack is
safe to ship.

### Licensing

The database holds no image assets — only ids into EA's own CDN — and having
the database (or owning FC) does not grant redistribution rights for its
graphics. A badge pack may only contain art you have the right to redistribute
(permitted pack, licensed provider, openly licensed art, or assets extracted
under terms that allow your intended use). Check each asset's licence and
trademark considerations: club crests remain their clubs' trademarks. This
tool's checked-in fixtures (`test/fixtures/badges/`) hold five verified seeds
for the pipeline tests only and are not a redistribution-ready graphics pack.

### Competition logos

Competition logos work the same way as club badges, keyed by OFM competition
id instead of EA team id. A pack's `manifest.json` can carry a
`competitionLogos` array alongside `badges`:

```json
{
  "version": 1,
  "source": "https://example.com/competition-logos",
  "licence": "CC-BY-4.0",
  "competitionLogos": [
    {
      "competitionId": "uefa-champions-league",
      "file": "uefa-champions-league.png",
      "source": "https://example.com/uefa-champions-league.png",
      "licence": "CC-BY-4.0",
      "attribution": "Example Pack",
      "checksum": "sha256:<64 hex>"
    }
  ]
}
```

Pass the pack with `--competition-logos <pack>`. The importer verifies every
checksum, packs the images into `assets/competitions/` inside the `.ofm`, and
sets `competition.logo` so the UI renders each competition's logo. Competition
logos share the same provenance manifest as club badges, so the archive
documents where each asset came from.

The two European competitions authored by this importer (UEFA Champions
League, UEFA Europa League) match on their OFM competition id
(`uefa-champions-league`, `uefa-europa-league`). Without a logo pack they
render with no badge.

## What comes out

From the bundled **FC 27** database:

| | Count |
|---|---|
| Clubs | 684 |
| Players | 18,875 |
| Competitions | 38 (34 domestic leagues, 4 continental) |
| Countries | 46 |

The FC 25 and FC 26 databases work too (`--version "FC 26"`); the encodings below
are shared, and only the table contents differ.

## What is imported

**Clubs** — every club in a men's league of the database. Women's competitions,
the placeholder leagues (`OTP Generics`, `Free Agents League`, `Youth Squad
League`, `FIFA Twist`, `5v5 League`, …) and the classic/all-star squads are
skipped: they are not clubs, and importing them would put a "Bayern München
Classic" in the transfer market.

**Players** — every player fielded by an imported club. A player in EA's database
can belong to more than one team (a club and a national side); a package allows
one club, so the first domestic-league club wins.

**Competitions** — one league per domestic competition, with its real clubs,
tier (`priority`) and season start. The database's continental rows become
competitions of their own: CONMEBOL Libertadores and Sudamericana. Two European
club competitions the database does not carry are authored from reputation:
the *UEFA Champions League* (top 32 European clubs) and the *UEFA Europa League*
(the next 32, excluding the first cup's field). Their logos come from a
separate optional graphics pack via `--competition-logos`; without one they
render with no badge.

### Field mapping

| OFM field | EA source |
|---|---|
| `team.name`, `team.colors` | `teams.teamname`, `teamcolor1*` / `teamcolor2*` |
| `team.shortName` | `TeamName_Abbr3_<teamid>` in the localization database |
| `team.country` | the club's league country, else its squad's most common nationality |
| `team.city` | `teams.cityid` through the `CityName_<id>` localization strings |
| `team.stadiumName` | `teamstadiumlinks` → `stadiums.name` |
| `team.playStyle` | `defensivedepth` + `buildupplay` + the attack/defence ratings (see below) |
| `team.formation` | `formations.formationname`, folded to three or four lines (see below) |
| `competition.regionId` | the league country's confederation in `nations.rs` |
| `team.reputationRange` | `teams.overallrating` |
| `team.financeRange` | `teams.clubworth` (thousands of euros, 2–4%) |
| `team.foundedYear`, `playStyle` | `foundationyear`, attack vs. defence rating |
| `player.name`/`firstName`/`lastName` | `firstnameid`/`lastnameid`/`commonnameid` via `playernames` |
| `player.position` | `preferredposition1` (table below) |
| `player.alternatePositions` | `preferredposition2..7` |
| `player.overall`/`potential` | `overallrating` / `potential` (rewritten to the engine's own figure, see *Ratings*) |
| `player.attributes` | EA's attribute set, averaged where OFM has one field for two |
| `player.dateOfBirth` | `birthdate`, a day count (see below) |
| `player.footedness`/`weakFoot` | `preferredfoot` (1 = right, 2 = left) / `weakfootabilitytypecode` |
| `player.contractEnd` | `contractvaliduntil` (year) → `YYYY-06-30` |
| `player.wage` | `wage` (weekly, sparse in the database; omitted when 0) |

### Ratings

A package that writes `attributes` is rated by the engine from those attributes:
`overall` is ignored, and a package whose `potential` sits below the rating the
attributes imply is **rejected** (`player_potential_errors` in
`generator/package.rs`). The game then shows the engine's number everywhere, so
the importer computes it too, in `lib/rating.mjs`: a port of
`player_rating.rs` — the per-position attribute weights, the three key attributes
per position, the `0.6`-per-point penalty below 45, and the 1–99 clamp.
`lib/rating.test.mjs` re-reads the Rust and fails if any of those tables drift.

Two things follow, both handled in `lib/mapping.mjs`:

- **Goalkeepers get their own attribute block.** The engine rates a keeper on
  handling, reflexes and aerial reach; reading those off outfield columns
  (`positioning` instead of `gkpositioning`, heading instead of reach) rated every
  keeper 30–40 points low.
- **Attributes are shifted to match EA's overall.** EA's rating and OFM's weighted
  score do not agree on the same numbers — imported straight, squads read four to
  seven points light on average (Van Dijk 82 instead of 88). A uniform shift is
  applied until the engine's rating lands on EA's, which keeps each player's shape
  (who is quick, who cannot tackle) and restores the rating people know. Ratings
  in this package therefore match EA's headline figures exactly.

`defaultActiveRegions` is deliberately **not** written. An empty list is not
"nothing active": `world/foundations.rs` fills the active regions from the
competitions' own `regionId`s, so the world activates exactly the regions its
competitions need. The old `["europe"]` would have put the South American cups
outside simulation scope.

### Where the names come from

EA keeps three things behind an index rather than a name, and all three resolve:

- **Cities.** `teams.cityid` is joined to the localization tables, where each city
  is `CityName_<id>` (occasionally `CityName_<id>_FullChar`). That is 997 named
  cities. A reviewed supplement replaces Mjällby's country-name city fallback
  (`Sweden`) with its recorded club locality.
- **Grounds.** `teamstadiumlinks` joins a team to a stadium row in `stadiums`,
  which carries the name. EA names an *unlicensed* ground with a leading
  underscore (`_El Libertador` for the Camp Nou), so those are dropped rather
  than shown. 136 clubs have named EA grounds; 95 more receive reviewed
  historical ground names from a pinned openfootball/clubs snapshot. The remaining
  453 keep the city-based fallback. Supplemental names are not verified 2027 home
  venues or current sponsorship names; every mapping has provenance in `data/`.
- **Short names.** `TeamName_Abbr3_<teamid>` in the same localization tables.
- **Confederations.** A competition's `regionId` is read from the engine's own
  catalog (`ofm_core/src/nations.rs`) rather than guessed, so a league cannot
  claim the wrong continent. The active regions of a built world come from these
  ids, because the package writes no `defaultActiveRegions`.

### Encodings worth writing down

These were derived from the data, because the kit's descriptor files label the
fields but not their meaning:

- **Positions.** Only twelve `preferredposition1` codes occur, resolved against
  known players: `0` Goalkeeper, `3` RightBack, `5` CenterBack, `7` LeftBack,
  `10` DefensiveMidfielder, `12` RightMidfielder, `14` CentralMidfielder,
  `16` LeftMidfielder, `18` AttackingMidfielder, `23` RightWinger,
  `25` Striker, `27` LeftWinger. (Salah and Yamal are `12` and `23`; Van Dijk is
  `5`; Hakimi is `3`; Kylian Mbappé and Haaland are `25`.) An unknown code falls
  back to the player's attribute profile.
- **Dates.** `birthdate` is a day count, not a packed calendar: 146942 is
  1985-02-05 and 147811 is 1987-06-24, 869 days apart as the players are.
- **Home nations.** EA stores England, Scotland, Wales and Northern Ireland as
  `GB`; OFM wants `ENG` / `SCO` / `WAL` / `NIR`. Codes EA still carries for
  dissolved states are aliased too (`AN` → `CW`, `YU`/`CS` → `RS`, …).
- **Long names.** Club names live in `teams.teamname`, but the 3-letter
  abbreviation only exists as a localization string (`TeamName_Abbr3_<id>`),
  which is also the only reliable source of short names.

## Reproducible data corrections

FC 27 input files are checksum-locked to the recorded kit revision. The importer
rejects changed source bytes before writing output; use the pinned checkout in
[`data/README.md`](data/README.md) to reproduce this package. That document also
explains the 95 reviewed stadium mappings, the city correction and source dates.
Synthetic placeholders are excluded together with synthetic-only player records;
a player with another valid club link is retained. Rest of World groups retain
real clubs but are not treated as domestic leagues.

## Source-quality audit

Loader acceptance is not a completeness check. Run the read-only coverage audit
alongside schema validation, including on the archive a player installs:

```bash
node tools/eafc-import/audit.mjs mods/eafc-fc27
node tools/eafc-import/audit.mjs mods/eafc-fc27.ofm --json
```

It reports source-field coverage, contracts before January 1 of `baseYear`,
clubs outside explicit competition fields, dangling participants, authored
staff, national tournaments and placeholder-name candidates. JSON output lists
the affected clubs and stale contracts. It never changes source records and
returns success when a report is produced, even if coverage is poor; read/parse
failures return nonzero. Participant selectors are explicitly marked unresolved.

See the [FC 27 quality baseline](../../mods/eafc-fc27/DATA_QUALITY.md) for the
measured gaps and handling rules. In particular, do not mass-extend source
contracts, invent missing wages, or assign Rest of World clubs to unrelated
leagues. Generated wages, stadium labels and staff are not real imported data.

## Caveats

- **Unresolved grounds stay unnamed.** Placeholder names starting with `_` are
  not imported. Only reviewed source-backed mappings can fill these gaps; 453
  clubs still have no named ground.
- **Badges need a separate pack.** The database holds no image assets, only ids
  into EA's own CDN; club badges are imported only when `--badges <pack>` is
  given. Kits and player photos are not imported.
- **No managers, tactic dials, shirt numbers, captains or rivals.** Not a gap in
  this tool: the package format has no field for any of them. `staff` roles are
  AssistantManager, Coach, Scout and Physio (`StaffRole` in `domain/staff.rs`), and
  `SCHEMA_REFERENCE.md` is explicit that a club's manager is generated at world
  build and "is not yours to set". `playStyle` and `formation` are the two
  tactical fields that do exist; the nine dials behind them are derived from the
  style at world build (`ai_tactics::blueprint_for`), and EA's own slider values
  are not carried.
- **Stadium capacity is drawn, not imported.** The engine picks 10,000-80,000 for
  an authored club (`build_team`), so the capacity row on a club page does not
  match the ground's real figure even where the name is real.
- **Five-line shapes are folded.** The engine lays out three or four lines that
  add up to ten, so EA's "4-1-2-1-2" (Real Madrid) becomes "4-3-1-2" — the two
  adjacent lines holding the fewest players merge. Everything else passes through
  unchanged; 19 shapes survive across the 684 clubs.
- **Kit patterns are not inferred.** `teams.jerseytype` is 0-2 across the whole
  database and does not separate stripes from hoops (Celtic and Barcelona share a
  value); `teamkits.jerseytemplateindex` is a mesh index, not a pattern.
- **No national teams.** EA fields national sides from the same players, and an
  OFM player has one club: importing a World Cup would mean emptying clubs, so
  the 51 national teams are left out.
- **`value` is left to the engine.** The database has no market value column;
  the engine sizes value (and therefore wages) from ability and age, the same way
  it does for generated players.
- **Licensing.** The data is EA's. The kit and this tool are MIT/GPL, but the
  *content* is not free: keep the result for personal use and do not redistribute
  it as a product. Upstream OFM deliberately ships no licensed data
  (`VISION.md`), which is why this lives in `mods/` and not in the engine.

## Tests

```bash
node --test "tools/eafc-import/lib/*.test.mjs"
```

`lib/rating.mjs` is the engine's player rating, checked against the Rust source;
`lib/mapping.mjs` holds the rules as pure functions (dates, positions, colours,
country codes, ranges) and `lib/zip.mjs` writes the `.ofm` archive; both are
covered there. `validate.mjs` checks the documented package schema — ids,
references, enums, participant lists and the per-country priority pyramid —
because `ofm-cli validate` needs a Rust toolchain. It also re-derives the engine's
own rating for every player, so a `potential` the loader would reject cannot ship.

Point it at the directory or straight at the archive:

```bash
node tools/eafc-import/validate.mjs mods/eafc-fc27        # the source files
node tools/eafc-import/validate.mjs mods/eafc-fc27.ofm    # what a player installs
```

The archive mode matters: it is the `.ofm` that gets installed, and a stale one
would otherwise pass unnoticed.

This is a mirror of the loader, not the loader. `.github/workflows/validate-eafc-package.yml`
is the authority: it builds `ofm-cli` on a GitHub runner and runs the real
`validate_package` plus a Rust test that builds a world from the package. It has
already earned its keep — it rejected the first version of the two European cups
(`selectorMissingCountry`: the engine requires a `country` on a reputation
selector), which this validator now checks too.
