# Fixture club badges

Fixture set for the importer badge pipeline tests (`lib/badges.test.mjs`).

- Five real Premier League club badges from [klunn91/team-logos](https://github.com/klunn91/team-logos) (repository MIT licensed).
- `manifest.json` records, per asset: source, licence, attribution and sha256 checksum — the shape a graphics pack shipped alongside a package is expected to carry. The crosswalk is **EA team id ↔ OFM club id ↔ image file**, matched on EA id, never on club name.
- The EA team ids below were verified against a real FC 27 import run with `--badges`: Arsenal (1), Aston Villa (2), Burnley (1796), Brighton & Hove Albion (1808), AFC Bournemouth (1943) each reached their OFM club as `assets/clubs/<eaTeamId>.png`.
- Club crests remain their clubs' trademarks. This folder is test data and a seed demonstration, not a redistribution-ready graphics pack.
