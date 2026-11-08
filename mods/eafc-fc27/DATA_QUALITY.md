# FC 27 data corrections and remaining limitations

Audited and rebuilt on 2026-11-08. **Loadable does not mean complete or
season-ready.** Source coverage, schema/reference validity and actual world
building are separate checks.

```bash
node tools/eafc-import/audit.mjs mods/eafc-fc27
node tools/eafc-import/audit.mjs mods/eafc-fc27.ofm --json
```

## Before and after verified corrections

| Check | Original package | Corrected package (0.1.1) |
| --- | --- | --- |
| Club rows | 685, including a placeholder | 684; placeholder removed |
| Player rows | 18,893, including 18 fake players | 18,875; all retained players unchanged |
| Competitions | 38 | 38; memberships unchanged |
| Contracts before `baseYear: 2027` | 1,878 | 1,877; source dates preserved |
| Clubs in no competition | 21 | 20 real clubs; no invented assignments |
| Dangling participant references | 0 | 0 |
| Named stadiums | 136 (19.9%) | 231 (33.8%); 95 sourced additions |
| Missing stadium names | 549 | 453 |
| Positive wage values | 441 | 440; the removed fake roster had one wage |
| Missing weak-foot values | 2,079 | 2,074; all remaining omissions are goalkeepers |
| Authored staff / national tournaments | 0 / 0 | 0 / 0 |

The stale-contract count drops by one only because a fake player was removed;
**no real contract was extended or corrected without evidence**. Likewise, no
real wage values were lost. The source contract cutoff is January 1 of
`baseYear`, not an inferred career opening day. A missing base year makes that
check unavailable rather than zero.

## Corrections made

### Synthetic team and players

Removed **Placeholder Custom Team Chapter** (EA team ID **132888**) and its
18 synthetic players, IDs **279949–279966**. Every one is named `FakePlayer` in
the source and is linked **only** to that placeholder team; none belongs to a
real club. They are omitted, not turned into free agents. The importer now
filters placeholder/custom squads in addition to classic/all-star squads, and
club selection still preserves a real player if another valid club link exists.

Rest of World rows retain real clubs but no longer qualify as domestic-league
links when choosing player ownership.

### Ground names and city fallback

Added **95 reviewed missing-ground mappings** from the pinned, CC0
[openfootball/clubs snapshot](https://github.com/openfootball/clubs/tree/ae3800227c449447b3a337fc0aac79a8f02f4c8b),
including Crown Ground, Oakwell, The Valley, Meadow Lane and Stade de la Mosson.
Each correction carries a stable EA team ID, expected name/country and a
line-specific source URL. Existing named EA stadiums are never overwritten;
ambiguous matches, known old grounds and stale commercial names were excluded.

**These are historical ground labels from a 2025-01-03 source snapshot, not a
verified November 2026 sponsorship/relocation update or a guarantee of 2027 home
venues.** Capacities remain generated. The other 453 clubs keep the existing
city-based fallback rather than a guessed ground. The supplementary data also
replaces Mjällby's incorrect country-name city fallback (`Sweden`) with the
source's club locality (`Mjällby`).

### Reproducibility

The original package was reproduced byte-for-byte using upstream
[`1464907bf4e726504d8b3ce15ffd0a552990565e`](https://github.com/ViniMacacari/eafc-db-kit/tree/1464907bf4e726504d8b3ce15ffd0a552990565e).
The importer now checks SHA-256 digests of its four FC 27 source files before
writing output, so upstream changes cannot silently become a roster update.
The directory and installable `.ofm` archive are regenerated together.

See [the recorded sources and mapping rules](../../tools/eafc-import/data/README.md)
for reproduction commands, provenance and the precise correction scope.

## Competition gaps that cannot be repaired from current data

All 20 unassigned real clubs have **no domestic competition for their country
in this package**. The pinned EA source links them to **Rest of World Men**,
which is a roster grouping, not evidence of domestic/continental qualification.
Moving them into an unrelated supported league or inventing a cup field would
make the data less accurate.

| Country | Unassigned clubs |
| --- | --- |
| Greece | AEK, Panathinaikos, PAOK |
| United Arab Emirates | Al Ain FC (UAE) |
| Cyprus | APOEL Nicosia FC, Omonia Nicosia FC |
| Colombia | Atlético Nacional |
| Brazil | Bahia |
| Thailand | Buriram United |
| Croatia | Dinamo Zagreb, Hajduk Split |
| Ukraine | Dynamo Kyiv, Shakhtar Donetsk |
| Hungary | Ferencvárosi TC |
| Finland | HJK Helsinki |
| Bulgaria | Ludogorets Razgrad |
| Azerbaijan | Qarabağ FK |
| Czechia | Slavia Praha, Sparta Praha, Viktoria Plzeň |

These clubs are retained without fabricated schedules. Making them playable in
competitions requires verified fields/new league data or an explicit gameplay
scope decision; this data-only cleanup does not implement an inactive-club or
transfer-only game mode.

## Other unresolved issues

- **Expired contracts:** all 1,877 retained stale dates are 2026-06-30 and match
  the pinned source. A dated roster update or explicit, tested career-start
  expiry policy is needed. Do not mass-renew contracts or change `baseYear` to
  hide them. The current generator preserves authored end dates.
- **Wages:** the source has only 440 positive values for retained players.
  Missing wages remain omitted; the game estimates them from value with a
  minimum. They are not recoverable by repairing a join, and estimates are not
  verified salaries.
- **Weak foot:** the 2,074 omissions are **all goalkeepers**, not missing EA
  values. The source has ratings, but the current package loader rejects
  `weakFoot` on `Goalkeeper`; the load-time identity upgrade re-infers keeper
  values on every load. Recovering them requires a coordinated schema/identity
  preservation fix and save/load tests, not simply populating JSON with values
  the game rejects or discards. No source-less outfield weak-foot estimates were
  added. See `SCHEMA_REFERENCE.md` → Identity fields.
- **National teams and real staff:** no national-team or staff records are
  authored here. Club-player nationalities are not national-team records.
  National squads need a separate membership/selection path, not players removed
  from clubs. Verified staff can be authored for supported roles, but club
  managers are not supported by the package schema. Generated staff/managers
  must not be labelled real imported people.

## Audit limits

`audit.mjs` is read-only and informational. Success means the report was
produced, not that the database is complete. Use `validate.mjs` or
`ofm-cli validate` for structural failures. JSON output lists stale contracts,
unassigned clubs, dangling references and placeholder-name candidates. Coverage
counts usable values, not their real-world accuracy. Placeholder detection is
a name-based review hint, not a complete synthetic-team classifier.

For packages with participant selectors, the audit marks competition coverage
incomplete; absence from an explicit list is not proof of absence from play.
National tournament counts are not national-team record counts. The zero
national-team finding above comes from this package's actual schemas.
