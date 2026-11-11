# Recorded sources and reviewed corrections

## EA source lock

`fc27-source-lock.json` records the kit revision and SHA-256 digests of the four
FC 27 input files (main database/descriptor and English localization
Database/descriptor). The original importer reproduces the old checked-in
package byte-for-byte from these inputs. The corrected importer verifies these
bytes **before writing** a new FC 27 package. Identical files in another checkout
are accepted; changed files require an explicit, reviewed lock update.

Reproduce with Node 24+:

```bash
git clone https://github.com/ViniMacacari/eafc-db-kit ../eafc-db-kit
git -C ../eafc-db-kit checkout --detach 1464907bf4e726504d8b3ce15ffd0a552990565e
npm ci --prefix ../eafc-db-kit
node tools/eafc-import/import.mjs --kit ../eafc-db-kit --out mods/eafc-fc27
```

The source checksum lock and the supplemental mappings only apply to FC 27;
FC 25/26 imports do not borrow FC 27 corrections. The EA database is not copied
here; the EA data's existing licensing restrictions still apply.

## Competition structure

`fc27-compdata/` is EA FC 27's career-mode `compdata` folder, as the game ships
it. It is the one EA source kept in this directory, because the kit above does
not carry it and CI has to rebuild the package from the same inputs. The
database says which clubs are in which league. This folder says everything
else about a season: which cups and continental competitions exist, the stages
each is played in, how many clubs a stage holds, where they come from (a league
position, a cup win) and the days matches fall on.

The importer reads five of its files (`lib/compdata.mjs`):

| File | What it holds |
|---|---|
| `compobj.txt` | every object (confederation, nation, competition, stage, group) and its parent |
| `settings.txt` | settings per object: a competition's type and EA league id, a stage's type |
| `standings.txt` | one row per place in a group, so its row count is the group's size |
| `tasks.txt` | what happens when a competition starts or ends: which league positions and cup winners fill which group |
| `schedule.txt` | the day and round of every match day |

The rest are kept so the folder is complete and are not read: `advancement.txt`
(how clubs move from one stage to the next), `initteams.txt` (the fields of the
season before, one season stale), `activeteams.txt`, `compids.txt`,
`settings.ini` and `careerremovable.ini`.

`lib/competitions.mjs` turns this into the package's cups, continental
competitions and qualification berths, and `tools/eafc-import/README.md` says
what is kept and what is simplified. Another version's folder can be passed
with `--compdata`; without one (FC 25/26 have none recorded) a package has its
leagues and no cups.

## Artwork crosswalks

`fc27-crest-crosswalk.json` records `clubId → eaTeamId` for every club whose
crest EA ships, and `fc27-league-logo-crosswalk.json` records
`competitionId → eaLeagueId` for every competition logo taken from EA's
league-logo folder. They are committed so the bundled world's artwork can be
rebuilt, and reviewed, without the EA database:
`scripts/build-club-badges.mjs` needs only these two files and the two zips.

Both are regenerated from the pinned kit revision by
`badges-from-crest-pack.mjs --write-crosswalk --write-league-crosswalk`, and CI
compares the result with the committed files.

The league-logo crosswalk has one part that comparison cannot check. Its
`leagues` list is derived from EA's `leagues` table, like the crest crosswalk.
Its `authored` list is not: that table has no rows for cups, super cups or UEFA
competitions, so each of those logos was identified by looking at the artwork,
and `name` says what it shows.

The `authored` list is also where a cup gets its id and its name. When the
structure files above describe a competition under one of these EA league ids
and the package has its clubs, the importer authors it as `competitionId`,
named `name` without the sponsor in parentheses (`EFL Cup (Carabao Cup)`
becomes `EFL Cup`). That is 27 of the 51 today: 22 domestic cups and five
continental competitions. The two CONMEBOL competitions take their id from the
`leagues` list instead, since the database has a row for each. The other 24
ids (super cups, play-offs, cups of countries the package has no league for,
earlier logos) belong to competitions the package does not have, and are a
naming convention until it does.

## Supplemental club fields

`fc27-club-corrections.json` contains **95 reviewed missing-stadium mappings**
from the public-domain (CC0-1.0)
[openfootball/clubs](https://github.com/openfootball/clubs/tree/ae3800227c449447b3a337fc0aac79a8f02f4c8b)
snapshot dated **2025-01-03**. Each row records:

- Stable EA team ID, expected source name and package country.
- Ground name and the external club name used to check identity.
- An immutable, line-specific source URL.
- For Mjällby only, a replacement of the country-name city fallback `Sweden`
  with the source's club locality `Mjällby` (not a claim about the stadium's
  street address or municipality).

The mappings are **source-backed historical ground labels**, not independently
verified November 2026 sponsorship names, temporary relocations or 2027 home
venues. They must not be used to claim up-to-date capacities or grounds for
fixtures. Existing named EA grounds always win. Of 129 initial name/alias
candidates for unnamed grounds, 34 were rejected: examples include Wimbledon at
Kingsmeadow, York at Bootham Crescent, Andorra at Estadi Nacional, old sponsor
names and the false cross-country match between Romanian FC Rapid and Austrian
Rapid Wien. No candidate-matching code is used by the importer: the reviewed
ID/name/country mappings are explicit.

A stale/missing ID, changed source name, duplicate correction ID or different
country fails import. The city correction additionally requires the exact old
fallback; it cannot silently overwrite a newly resolved city.

No changes are made to source contracts, wages, real-player attributes or
competition participation. Missing grounds without an accepted mapping retain
the city fallback. These corrections do not make the package a fully updated
2027 roster.
