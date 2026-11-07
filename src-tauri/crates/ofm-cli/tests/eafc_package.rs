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
    DefinitionSources, WorldData, build_world_from_package_seeded, load_world_package,
};
use ofm_core::player_rating::ovr_from_attributes;

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

/// The two steps the app takes to open a package world.
fn built_world() -> Option<WorldData> {
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
    Some(world)
}

#[test]
fn the_package_builds_the_world_it_promises() {
    let Some(world) = built_world() else {
        eprintln!("skipping: mods/eafc-fc27 is not in this checkout");
        return;
    };

    assert_eq!(world.teams.len(), 685, "clubs");
    assert_eq!(world.players.len(), 18_893, "players");

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
    let Some(world) = built_world() else { return };

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
    let Some(world) = built_world() else { return };

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
    let Some(world) = built_world() else { return };

    let messi = world
        .players
        .iter()
        .find(|player| player.full_name == "Lionel Messi")
        .expect("Messi is in the package");
    assert_eq!(messi.ovr, 89, "Messi rates 89");

    for player in &world.players {
        let rating = ovr_from_attributes(&player.attributes, &player.position).round() as u8;
        // The build rates a player from the attributes it was given, so the stored
        // figure and the formula have to agree: that is what the package was
        // calibrated against.
        assert_eq!(player.ovr, rating, "{} is stored at {}", player.full_name, player.ovr);
        // The loader's own rejection rule, on built data.
        assert!(
            player.potential >= player.ovr,
            "{} has a ceiling under its ability",
            player.full_name
        );
    }
}
