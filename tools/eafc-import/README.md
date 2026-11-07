# eafc-import

Turns an EA FC database into an Openfoot Manager package, so the game can be
played with real clubs, real squads and real leagues.

```bash
git clone https://github.com/ViniMacacari/eafc-db-kit ../eafc-db-kit
cd ../eafc-db-kit && npm install && npm run build   # the kit ships the databases

cd ../the-gaffer-v0.4
node tools/eafc-import/import.mjs --kit ../eafc-db-kit --version "FC 27" --out mods/eafc-fc27
node tools/eafc-import/validate.mjs mods/eafc-fc27
```

The run writes a package directory and a ready-to-install `mods/eafc-fc27.ofm`
(`--no-pack` skips the archive). Node 18+ is enough; the only dependency is the
kit checkout itself.

## What comes out

From the bundled **FC 27** database:

| | Count |
|---|---|
| Clubs | 685 |
| Players | 18,893 |
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
cups the database does not carry are generated from reputation: the *European
Champions Cup* (top 32 European clubs) and the *European Trophy Cup* (the next
32, excluding the first cup's field).

### Field mapping

| OFM field | EA source |
|---|---|
| `team.name`, `team.colors` | `teams.teamname`, `teamcolor1*` / `teamcolor2*` |
| `team.shortName` | `TeamName_Abbr3_<teamid>` in the localization database |
| `team.country` | the club's league country, else its squad's most common nationality |
| `team.city` | `teams.cityid` through the `CityName_<id>` localization strings |
| `team.stadiumName` | `teamstadiumlinks` → `stadiums.name` |
| `team.playStyle` | `defensivedepth` + `buildupplay` + the attack/defence ratings (see below) |
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
  cities and a real city for 91% of the raw team rows — and for every club this
  package ships, since the unresolved ones are national sides and placeholders.
- **Grounds.** `teamstadiumlinks` joins a team to a stadium row in `stadiums`,
  which carries the name. EA names an *unlicensed* ground with a leading
  underscore (`_El Libertador` for the Camp Nou), so those are dropped rather
  than shown: 136 of the 685 clubs get a real stadium name, the rest are drawn
  by the game from the city.
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

## Caveats

- **Unlicensed grounds stay unnamed.** EA ships 181 stadiums for 878 clubs; the
  rest point at a placeholder name starting with `_`. Those clubs get a city and
  no stadium name.
- **No badge, kit or photo.** The database holds no image assets, only ids into
  EA's own CDN.
- **No managers, formations, tactics, shirt numbers, captains or rivals.** Not a
  gap in this tool: the package format has no field for any of them. `staff` roles
  are AssistantManager, Coach, Scout and Physio (`StaffRole` in `domain/staff.rs`),
  and `SCHEMA_REFERENCE.md` is explicit that a club's manager is generated at
  world build and "is not yours to set". `playStyle` is the only tactical field,
  and EA's tactic data arrives as a line height and a build-up style, not as one
  of OFM's six identities, so it is inferred. The formation beside it is engine
  state: every generated club is 4-4-2 until its manager changes it, in a package
  world as much as in a random one.
- **Stadium capacity is drawn, not imported.** The engine picks 10,000-80,000 for
  an authored club (`build_team`), so the capacity row on a club page does not
  match the ground's real figure even where the name is real.
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
