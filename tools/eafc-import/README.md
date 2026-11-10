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

Add club badges and competition logos from separate graphics packs:

```bash
node tools/eafc-import/import.mjs --kit ../eafc-db-kit --version "FC 27" \
  --out mods/eafc-fc27 --badges ../eafc-fc27-badges --competition-logos ../eafc-fc27-competition-logos
```

The run writes a package directory and a ready-to-install `mods/eafc-fc27.ofm`
(`--no-pack` skips the archive). Use Node 24+ for the current upstream kit;
the only dependency is the kit checkout itself. The audit and importer unit
tests can also run without a kit checkout.

## Club badges from EA's crest folder

EA ships crests as `crest50x50/l<eaTeamId>.dds` — 64×64 DDS textures whose
50×50 crest sits in the top-left corner — and no club names anywhere in the
pack. `badges-from-crest-pack.mjs` turns that into a normal graphics pack by
resolving the ids against the database `import.mjs` reads:

```bash
node tools/eafc-import/badges-from-crest-pack.mjs \
  --kit ../eafc-db-kit --crest-pack crest50x50.zip \
  --league-logos leagues.zip \
  --out ../eafc-fc27-badges \
  --write-crosswalk tools/eafc-import/data/fc27-crest-crosswalk.json \
  --write-league-crosswalk tools/eafc-import/data/fc27-league-logo-crosswalk.json
```

It decodes both formats the pack contains (uncompressed 32-bit BGRA and DXT5),
crops to the 50×50 artwork box, adapts dark/low-contrast crests so they remain
legible on the game's dark UI surfaces (`--no-dark-adapt` disables this), and
encodes PNG with `node:zlib`.

`--write-crosswalk` records `ofmClubId → eaTeamId` so the mapping is reviewable
without the database — that file, plus `crest50x50.zip`, is all
[`scripts/build-club-badges.mjs`](../../scripts/build-club-badges.mjs) needs to
rebuild the bundled world's badges.

The crosswalk never guesses. Two EA rows can share a name (a club and its
"rest of world" duplicate); the crest breaks the tie, and if both candidates
have one the club is left out — a wrong badge is worse than a generated crest.

## Competition logos from EA's league folder

EA ships competition logos as `leagues/l<eaLeagueId>.dds`, again with no names
in the pack. `--league-logos <leagues.zip>` adds them to the same graphics pack
as `competitionLogos`, each named after the competition it belongs to
(`eng-premier-league.png`).

Most of these files are not DDS textures on disk. EA wraps them in a `chunkzip`
container — the texture cut into blocks, each deflated on its own — and keeps
the `.dds` name, so the importer checks the magic and unwraps first
(`lib/chunkzip.mjs`). The texture inside is usually 1024×1024 with the artwork
centred in a wide transparent margin. Each logo is cropped to its artwork and
scaled down until its longer side is 160 pixels, by area averaging weighted by
alpha so transparent pixels do not tint the edges. A logo already smaller than
that is left at its own size. Unlike crests they are not adapted for dark
surfaces: EA draws them for a dark interface already.

Which logo belongs to which competition is recorded in
`data/fc27-league-logo-crosswalk.json`, in two lists that are kept apart because
they are known in different ways:

- **`leagues`** — derived. A competition's id comes from one row of EA's
  `leagues` table (`leagueCompetitionId` in `lib/mapping.mjs`), so the row that
  derives the same id is the league it was imported from, and that row's logo is
  its logo. `--write-league-crosswalk` regenerates this list and CI compares it
  with the committed file. As with crests, two candidate rows that both have a
  logo leave the competition without one rather than guessing.
- **`authored`** — named by hand. EA's `leagues` table lists no cups, super cups
  or UEFA competitions, so their logos can only be identified by looking at
  them; `name` records what each one shows. This list is also where a cup gets
  its id and its name: the importer authors a cup or a continental competition
  under the `competitionId` recorded for its EA league id (see
  [Cups, continental competitions and qualification](#cups-continental-competitions-and-qualification)).
  27 of the 51 entries are competitions the FC 27 package has. The other 24 are
  logos for competitions it does not have: they are packed under the id that
  competition is expected to get, and the importer sets `logo` on its own the
  day a competition with that id exists. Those ids are a naming convention, not
  a checked fact — nothing can verify them until the competition is authored.

`--competition-logos <pack dir>` still copies logos from another pack through
unchanged. A competition may get its logo from one source only; an id supplied
by both is an error.

`leagues.zip` and the crosswalk are all
[`scripts/build-club-badges.mjs`](../../scripts/build-club-badges.mjs) needs to
rebuild the bundled world's competition logos.

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

The cups and continental competitions this importer authors match on their OFM
competition id (`uefa-champions-league`, `eng-fa-cup`). Without a logo pack
they render with no badge. The bundled world takes them from EA's league folder
(see above), which draws them for a dark interface.

### Player mini-faces

Player mini-faces work the same way as club badges, keyed by EA player id
instead of EA team id. A pack's `manifest.json` can carry a `playerFaces`
array alongside `badges` and `competitionLogos`:

```json
{
  "version": 1,
  "source": "https://example.com/player-faces",
  "licence": "MIT",
  "playerFaces": [
    {
      "eaPlayerId": 278455,
      "ofmPlayerId": "aarón-anselmino-278455",
      "file": "278455.png",
      "source": "https://example.com/278455.png",
      "licence": "MIT",
      "attribution": "Example Pack",
      "checksum": "sha256:<64 hex>"
    }
  ]
}
```

Pass the pack with `--player-faces <pack>`. The importer verifies every
checksum, packs the images into `assets/players/` inside the `.ofm`, and sets
`player.photo` so the UI renders each player's mini-face. Player faces share
the same provenance manifest as club badges, so the archive documents where
each asset came from.

The OFM player id embeds the EA player id as its trailing numeric segment
(e.g. `aarón-anselmino-278455` → EA id `278455`), so faces are matched on EA
player id, never on player name. Without a face pack, players render with no
photo.

## What comes out

From the bundled **FC 27** database:

| | Count |
|---|---|
| Clubs | 684 |
| Players | 18,875 |
| Competitions | 63 (34 leagues, 22 domestic cups, 7 continental) |
| Countries | 46 |

The FC 25 and FC 26 databases work too (`--version "FC 26"`); the encodings below
are shared, and only the table contents differ. Their packages have leagues and
no cups or continental competitions unless that version's `compdata` folder is
passed with `--compdata` (see below): the kit carries the databases, not the
competition structure.

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
tier (`priority`) and season start. Cups, continental competitions and the
places that qualify a club for them come from EA's career-mode competition
structure, which is the next section. Every competition's logo comes from the
optional graphics pack (`--badges`, or `--competition-logos` for a separate
one); without one they render with no logo.

## Cups, continental competitions and qualification

The database says which clubs are in which league and nothing about a season
beyond that. Which cups exist, who enters them, how each is played and what a
league place or a cup win is worth is in EA's `compdata` folder, the files
career mode builds its calendar from. FC 27's is committed at
`data/fc27-compdata/` and is read by default for an FC 27 import;
`--compdata <dir>` reads another one. [`data/README.md`](data/README.md) lists
the files.

`lib/compdata.mjs` parses the folder and `lib/competitions.mjs` decides what
the package authors from it. For FC 27:

| | |
|---|---|
| Domestic cups | 22, each with every club of the divisions EA enters in it that the package has |
| Continental | UEFA Champions League, Europa League and Conference League (32 clubs each); CONMEBOL Libertadores and Sudamericana (32 each); Concacaf Champions Cup (8); AFC Champions League Elite (16) |
| Berths from leagues | the positions EA fills each continental competition from, on every top division but India's |
| Berths from cups | the winner's place: 12 cups into the Europa League, 7 into the Conference League; the Europa League's winner into the Champions League, the Conference League's into the Europa League, the Sudamericana's into the Libertadores |
| League legs | how many times a division plays itself: 3 for the twelve-club leagues, 4 for Ireland's ten clubs, 1 for the thirty of MLS and Argentina, 2 elsewhere |

**What is EA's.** Which competitions exist; which divisions enter a cup; the
league positions and cup wins that earn a continental place, in EA's order;
whether a cup has a group stage, with how many groups and how many go through;
the first match day of each competition; the number of rounds a league plays.

**What is not, and why.** The engine plays three formats: a round robin, a
single-tie knockout, and groups followed by a single-tie knockout. It plays a
league round or a group matchday every seven days and a knockout round a
fortnight after the one before, one tie a day. None of that can be authored, so:

- **No two-legged ties, no league phase, no qualifying rounds.** The three UEFA
  competitions are eight groups of four and a knockout, the format they had
  until 2024, in place of a 36-club league phase behind three qualifying
  rounds. EA's places are shared out to fit: each competition takes them in
  EA's order until its 32 are full and the rest pass to the competition below,
  which is where a club that loses a Champions League qualifier ends up in EA's
  game too. Six of EA's league places find no room anywhere (third in Denmark,
  Poland, Sweden, Romania and Ireland, fourth in Ireland) and are dropped.
- **No staged entry to a cup.** EA brings the lower divisions in first and the
  top division in a later round. The engine draws a whole field at once and
  gives the byes it needs, so a cup is one draw of every club in it. The order
  of that draw is fixed per competition by a hash, so that a top division is
  not paired against itself in the first round.
- **Whole round robins only.** A league with a split, conferences or two short
  tournaments plays the nearest whole number of round robins to the rounds EA
  schedules. The six play-offs EA describes (the three EFL play-offs, Germany's
  two relegation play-offs, Spain's promotion play-off) are not played;
  promotion and relegation follow the table.
- **The engine's pace, not EA's dates.** A competition's length follows from
  its size, so a final does not fall on EA's day. What is chosen is the start.
  A cup keeps EA's first match day when it is then over a fortnight before its
  country's top division is, and otherwise starts as late as still lets it; a
  continental competition starts on the day nearest EA's on which it is not
  under way when any league that sends clubs to it ends its season. The cups of
  Norway and Sweden move with their leagues, which this package plays from
  August rather than through the calendar year.
- **The holder has no place of its own.** EA keeps one for the Champions League
  holder. The engine refuses a competition that qualifies its own winner.
- **A cup gives its winner and no one else.** Where the winner already has a
  place, EA passes the cup's place down the league table. Nothing is passed
  down here; the engine tops the field up instead.

**Places no berth fills.** EA fills the rest of a continental field from a
fixed list of clubs it keeps outside any league: Olympiacos, Dinamo Zagreb,
Flamengo. The package authors those places as nothing at all. From the second
season the engine tops a short field up itself, from the clubs of the
confederation that have no place yet: the ones that play in no league first,
by reputation, then the others, the senior competition served first and no club
in two fields. For the first season the importer does that sum
(`resolveFields`), with one source the engine does not have: last season's
tables and cup holders run through the berths, then the clubs EA files under
the competition's own league id (the two CONMEBOL competitions have such a
list), then clubs that play in no league, by reputation, then any other club of
the confederation. The run prints how many places of each field were earned.

**Left out.** The seven super cups: the engine renews a domestic cup with the
field it already has, and a super cup's field is new every season. The Russian
Cup and the Copa do Brasil, because the database has no Russian or Brazilian
league to fill them. And the competitions the logo list reserves an id for that
career mode has no structure for at all, such as the Greek Cup, the Copa
Argentina and the Club World Cup.

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
covered there. `lib/compdata.test.mjs` reads EA's committed structure files and
`lib/competitions.test.mjs` plans from them, against an invented set of clubs
so that neither needs the database; `lib/package.test.mjs` then checks the
committed package holds what that plan says. `validate.mjs` checks the
documented package schema — ids, references, enums, participant lists and the
per-country priority pyramid — because `ofm-cli validate` needs a Rust
toolchain. It mirrors the engine's checks on a competition's region, format,
group sizes, start date and berths (`lib/validate.test.mjs`), since those are
what a cup or a continental competition can get wrong. It also re-derives the
engine's own rating for every player, so a `potential` the loader would reject
cannot ship.

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
