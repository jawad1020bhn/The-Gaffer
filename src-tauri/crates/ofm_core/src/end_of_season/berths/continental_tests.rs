//! What a berth reads when the competition it reads is between two seasons.
//!
//! Competitions are renewed on days of their own, so the day a field is drawn a feeder may be
//! showing a finished table, a table it has played a part of since, or one it has not started.

use super::super::test_support::{division, empty_game, position_berth};
use super::*;
use domain::edition_archive::CompletedEdition;
use domain::league::{
    Fixture, FixtureCompetition, FixtureStatus, KnockoutRoundState, MatchResult, StandingEntry,
};
use domain::team::{Team, TeamSeasonRecord};

/// A first division showing a part-played 2034: `late` leads it, and a match is still to come.
fn part_played_division() -> League {
    let mut league = division(
        "d1",
        0,
        "ENG",
        &[("late", 3), ("first", 1), ("second", 1), ("third", 0)],
    );
    league.season = 2034;
    league.fixtures = vec![Fixture {
        id: "to-come".into(),
        competition_id: "d1".into(),
        date: "2034-09-01".into(),
        home_team_id: "first".into(),
        away_team_id: "second".into(),
        competition: FixtureCompetition::League,
        status: FixtureStatus::Scheduled,
        ..Default::default()
    }];
    league
}

fn archived_table(season: u32, order: &[&str]) -> CompletedEdition {
    CompletedEdition {
        competition_id: "d1".into(),
        season,
        completed_on: format!("{}-05-20", season + 1),
        champion_id: order[0].into(),
        participant_ids: order.iter().map(|club| club.to_string()).collect(),
        standings: order
            .iter()
            .map(|club| StandingEntry::new(club.to_string()))
            .collect(),
        groups: Vec::new(),
        knockout_rounds: Vec::new(),
        fixtures: Vec::new(),
    }
}

fn club_that_finished(id: &str, season: u32, position: u32) -> Team {
    let mut team = Team::new(
        id.into(),
        id.into(),
        id.into(),
        "England".into(),
        "City".into(),
        "Ground".into(),
        1000,
    );
    team.history.push(TeamSeasonRecord {
        season,
        league_position: position,
        played: 6,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        competition_id: "d1".into(),
    });
    team
}

fn top_two(game: &Game) -> Vec<String> {
    evaluate_berth_rule(
        game,
        &game.competitions[0],
        &BerthRule::PositionRange { from: 1, to: 2 },
    )
}

/// Given a league that has played out the season its table shows,
/// When a berth reads its top two,
/// Then they are the top two of that table, whatever is in the archive.
#[test]
fn a_finished_league_awards_its_berths_on_the_table_it_shows() {
    let mut game = empty_game();
    game.competitions = vec![division(
        "d1",
        0,
        "ENG",
        &[("first", 9), ("second", 6), ("third", 3)],
    )];
    game.edition_archive = vec![archived_table(2025, &["third", "second", "first"])];

    assert_eq!(top_two(&game), ["first", "second"]);
    assert_eq!(
        last_finished_season(&game, &game.competitions[0]),
        Some(2026)
    );
}

/// Given a league part-way through a season, whose last one is in the archive,
/// When a berth reads its top two,
/// Then they are the top two of the latest archived season, not the leaders of the day.
#[test]
fn a_league_part_way_through_a_season_awards_its_berths_on_the_one_before() {
    let mut game = empty_game();
    game.competitions = vec![part_played_division()];
    game.edition_archive = vec![
        archived_table(2032, &["third", "late", "first"]),
        archived_table(2033, &["first", "second", "third", "late"]),
    ];

    assert_eq!(top_two(&game), ["first", "second"]);
    assert_eq!(
        last_finished_season(&game, &game.competitions[0]),
        Some(2033)
    );
}

/// Given a league renewed and not yet started, with nothing played,
/// When a berth reads its top two,
/// Then they are still the top two of the season it finished.
#[test]
fn a_league_renewed_and_not_yet_started_awards_its_berths_on_the_season_it_finished() {
    let mut game = empty_game();
    let mut league = part_played_division();
    for entry in &mut league.standings {
        *entry = StandingEntry::new(entry.team_id.clone());
    }
    game.competitions = vec![league];
    game.edition_archive = vec![archived_table(2033, &["second", "third", "first", "late"])];

    assert_eq!(top_two(&game), ["second", "third"]);
}

/// Given a league part-way through a season, whose last edition could not be archived (a save
/// from before a table kept the shape it was authored with),
/// When a berth reads its top two,
/// Then they are read from the places its payout wrote into the clubs' records for the last
///      season any of them has one.
#[test]
fn a_league_whose_last_season_was_not_archived_awards_its_berths_on_its_clubs_records() {
    let mut game = empty_game();
    game.competitions = vec![part_played_division()];
    game.teams = vec![
        club_that_finished("third", 2033, 1),
        club_that_finished("late", 2033, 2),
        club_that_finished("first", 2033, 3),
        // Relegated the season before: the record is this league's, but not its last season.
        club_that_finished("gone", 2032, 1),
    ];

    assert_eq!(top_two(&game), ["third", "late"]);
    assert_eq!(
        last_finished_season(&game, &game.competitions[0]),
        Some(2033)
    );
}

/// Given a league part-way through the first season it has ever played,
/// When a berth reads its top two,
/// Then it has only the table it shows.
#[test]
fn a_league_in_its_first_season_awards_its_berths_on_the_table_it_has() {
    let mut game = empty_game();
    game.competitions = vec![part_played_division()];

    assert_eq!(top_two(&game)[0], "late");
    assert_eq!(last_finished_season(&game, &game.competitions[0]), None);
}

/// A cup of the country of `d1`, showing `season`, whose final is still to be played.
fn cup_with_its_final_to_come(season: u32) -> League {
    let mut cup = League::new("cup".into(), "Cup".into(), season, &[]);
    cup.kind = CompetitionType::Cup;
    cup.scope = CompetitionScope::Domestic;
    cup.country_id = Some("ENG".into());
    cup.rules.format = domain::league::CompetitionFormat::Knockout;
    cup.fixtures = vec![Fixture {
        id: "final".into(),
        competition_id: "cup".into(),
        date: "2034-09-01".into(),
        home_team_id: "first".into(),
        away_team_id: "second".into(),
        competition: FixtureCompetition::Cup,
        status: FixtureStatus::Scheduled,
        ..Default::default()
    }];
    cup.knockout_rounds = vec![KnockoutRoundState {
        id: "cup-final".into(),
        fixture_ids: vec!["final".into()],
        ..Default::default()
    }];
    cup
}

fn archived_cup(season: u32, champion: &str) -> CompletedEdition {
    CompletedEdition {
        competition_id: "cup".into(),
        champion_id: champion.into(),
        ..archived_table(season, &[champion])
    }
}

/// Given a cup that was renewed on its own day, before the field its winner enters is drawn,
/// When its holder is asked for,
/// Then it is the champion of the edition it finished: the season its bracket now shows is
///      later than the last season the country's first division finished.
#[test]
fn a_cup_renewed_before_the_draw_still_names_its_holder() {
    let mut game = empty_game();
    let mut league = division("d1", 0, "ENG", &[("first", 9), ("second", 6)]);
    league.season = 2033;
    game.competitions = vec![league, cup_with_its_final_to_come(2034)];
    game.edition_archive = vec![archived_cup(2032, "old"), archived_cup(2033, "holder")];

    assert_eq!(
        cup_champion(&game, &game.competitions[1]),
        Some("holder".to_string())
    );
}

/// Given a cup whose final was put back past the league's last round, so that it still shows
/// the season the league has just finished,
/// When its holder is asked for,
/// Then there is none yet: the edition in the archive is the season before's, credited a year
///      ago.
#[test]
fn a_cup_still_playing_the_season_being_rewarded_names_nobody() {
    let mut game = empty_game();
    let mut league = division("d1", 0, "ENG", &[("first", 9), ("second", 6)]);
    league.season = 2033;
    game.competitions = vec![league, cup_with_its_final_to_come(2033)];
    game.edition_archive = vec![archived_cup(2032, "old")];

    assert_eq!(cup_champion(&game, &game.competitions[1]), None);
}

/// Given a cup whose own bracket is decided,
/// When its holder is asked for,
/// Then it is the winner of that bracket, whatever the archive holds.
#[test]
fn a_cup_that_has_been_decided_names_the_winner_of_its_own_bracket() {
    let mut game = empty_game();
    let mut league = division("d1", 0, "ENG", &[("first", 9), ("second", 6)]);
    league.season = 2033;
    let mut cup = cup_with_its_final_to_come(2033);
    cup.fixtures[0].status = FixtureStatus::Completed;
    cup.fixtures[0].result = Some(MatchResult {
        home_goals: 0,
        away_goals: 1,
        ..Default::default()
    });
    cup.knockout_rounds[0].completed = true;
    game.competitions = vec![league, cup];
    game.edition_archive = vec![archived_cup(2032, "old")];

    assert_eq!(
        cup_champion(&game, &game.competitions[1]),
        Some("second".to_string())
    );
}

/// Given a division that awards a berth into another of its country,
/// When that berth is resolved while the division is part-way through its next season,
/// Then the helper the continental and the domestic fields share reads the season it finished.
#[test]
fn a_berth_field_is_resolved_from_the_season_last_finished() {
    let mut game = empty_game();
    let mut league = part_played_division();
    league.berths = vec![position_berth("target", 1, 1)];
    game.competitions = vec![league];
    game.edition_archive = vec![archived_table(2033, &["first", "second", "third", "late"])];

    assert_eq!(
        berth_winners(&game, &game.competitions[0], "target"),
        ["first"]
    );
}
