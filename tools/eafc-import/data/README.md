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
FC 25/26 imports do not borrow FC 27 corrections. Source datasets are not copied
here; the EA data's existing licensing restrictions still apply.

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
