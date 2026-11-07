//! The checked-in EA FC 27 package, loaded through the same functions a career
//! uses: `load_world_package` for the loader's own validation, then
//! `build_world_from_package_seeded`, which turns the package's definitions into
//! a built world and runs the embedded-definition checks on the way out.
//!
//! `tools/eafc-import` generates the package and it is checked in under `mods/`,
//! so a checkout that does not carry it skips these tests rather than failing.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use ofm_core::generator::{
    build_world_from_package_seeded, load_world_package, DefinitionSources, WorldData, WorldPackage,
};

/// `PlayStyle` in `domain/team.rs`; anything else is read as Balanced.
const PLAY_STYLES: [&str; 6] = [
    "Balanced",
    "Attacking",
    "Defensive",
    "Possession",
    "Counter",
    "HighPress",
];

/// The package directory at the repository root.
fn package_dir() -> Option<PathBuf> {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../mods/eafc-fc27");
    dir.is_dir().then_some(dir)
}

/// The two steps the app takes to open a package world, plus the package itself.
fn built_world() -> Option<(WorldPackage, WorldData)> {
    let dir = package_dir()?;
    let (package, errors) = load_world_package(&dir);
    assert!(
        errors.is_empty(),
        "the loader rejected {} file(s): {errors:?}",
        errors.len()
    );
    let sources = DefinitionSources::embedded_only();
    // A fixed seed, so any failure reproduces.
    let world =
        build_world_from_package_seeded(2027, &package, None, &sources).expect("builds a world");
    Some((package, world))
}

#[test]
fn the_package_builds_the_world_it_promises() {
    let Some((package, world)) = built_world() else {
        eprintln!("skipping: mods/eafc-fc27 is not in this checkout");
        return;
    };

    assert_eq!(world.teams.len(), 685, "clubs");

    // Every authored player reaches the world. The build also tops a club thinner
    // than `SQUAD_SLOTS` (22) up to 22 with generated squad members, and EA lists
    // 37 of these clubs with fewer than 22, so the world holds slightly more
    // players than the package: 18,976 against 18,893 at the time of writing.
    let authored: HashSet<&str> = package.players.iter().map(|def| def.id.as_str()).collect();
    let built: HashSet<&str> = world.players.iter().map(|player| player.id.as_str()).collect();
    assert_eq!(
        authored.difference(&built).count(),
        0,
        "the build dropped authored players"
    );
    assert!(
        world.players.len() >= authored.len(),
        "{} players built from {} authored",
        world.players.len(),
        authored.len()
    );
    eprintln!(
        "{} authored players, {} in the world",
        authored.len(),
        world.players.len()
    );

    // Competitions arrive as authored definitions and become state when a career
    // starts, so count whichever form the build produced.
    let defined = world
        .competition_definitions
        .as_ref()
        .map_or(0, |file| file.competitions.len());
    let counted = world.competitions.len() + defined;
    assert_eq!(counted, 38, "competitions");
}

#[test]
fn clubs_keep_the_city_ground_and_style_they_were_authored_with() {
    let Some((_, world)) = built_world() else { return };

    let arsenal = world
        .teams
        .iter()
        .find(|team| team.id == "arsenal")
        .expect("Arsenal is in the package");
    assert_eq!(arsenal.city, "London");
    assert_eq!(arsenal.stadium_name, "Emirates Stadium");
    assert_eq!(format!("{:?}", arsenal.play_style), "Possession");

    // The build names a ground the package left empty: "<City> Arena".
    let unnamed = world
        .teams
        .iter()
        .find(|team| team.stadium_name.ends_with(" Arena"))
        .expect("a club without a licensed ground still gets one");
    assert!(unnamed.stadium_name.starts_with(&unnamed.city));

    // Cities are the real ones, not the country standing in for one.
    let cities: HashSet<&str> = world.teams.iter().map(|team| team.city.as_str()).collect();
    assert!(cities.len() > 400, "only {} distinct cities", cities.len());
    let country_named = world
        .teams
        .iter()
        .filter(|team| team.city == team.country)
        .count();
    assert_eq!(country_named, 0, "clubs whose city is their country");
}

#[test]
fn every_club_has_a_playable_squad_and_one_of_the_six_styles() {
    let Some((_, world)) = built_world() else { return };

    let mut per_club: HashMap<&str, usize> = HashMap::new();
    for player in &world.players {
        if let Some(club) = player.team_id.as_deref() {
            *per_club.entry(club).or_default() += 1;
        }
    }
    let team_ids: HashSet<&str> = world.teams.iter().map(|team| team.id.as_str()).collect();
    for team in &world.teams {
        let squad = per_club.get(team.id.as_str()).copied().unwrap_or(0);
        assert!(squad >= 15, "{} has only {} players", team.name, squad);
    }
    // Nobody plays for a club the package does not define.
    for player in &world.players {
        if let Some(club) = player.team_id.as_deref() {
            assert!(team_ids.contains(club), "{} plays for {club}", player.full_name);
        }
    }

    let mut styles: HashSet<String> = HashSet::new();
    for team in &world.teams {
        let style = format!("{:?}", team.play_style);
        assert!(PLAY_STYLES.contains(&style.as_str()), "unknown style {style}");
        styles.insert(style);
    }
    assert!(styles.len() > 1, "every club plays the same style");
}

#[test]
fn every_player_rates_where_the_package_says_he_does() {
    let Some((_, world)) = built_world() else { return };

    // The package was calibrated so the engine's own rating lands on EA's. These
    // are the numbers a player would recognise; a shift in the mapping shows up
    // here first. Ids rather than names: the build derives `match_name` from the
    // surname, and a package id is unambiguous.
    let expectations = [
        ("lionel-messi-158023", 89_u8),
        ("kylian-mbappe-231747", 91),
        ("erling-haaland-239085", 91),
        ("virgil-van-dijk-203376", 88),
        ("lamine-yamal-nasraoui-ebana-277643", 90),
        ("jude-bellingham-252371", 90),
    ];
    for (id, expected) in expectations {
        let player = world
            .players
            .iter()
            .find(|player| player.id == id)
            .unwrap_or_else(|| panic!("{id} is in the package"));
        assert_eq!(player.ovr, expected, "{id}");
    }

    for player in &world.players {
        // The loader rejects a ceiling below the ability it rates; the build
        // clamps, so this is checked on the world rather than the package.
        assert!(
            player.potential >= player.ovr,
            "{} has a ceiling under its ability",
            player.match_name
        );
        assert!(
            (1..=99).contains(&player.ovr),
            "{} rates {}",
            player.match_name,
            player.ovr
        );
    }
}
