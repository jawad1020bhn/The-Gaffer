//! A domestic cup's field and draw, season after season, on the small worlds of `test_world`.

use super::*;
use crate::end_of_season::advance_to_next_season;
use crate::end_of_season::renewal::{competitions_renewed_at_rollover, renew_finished_ladders};
use crate::end_of_season::test_world::*;
use crate::turn::cup_renewal::renew_finished_cups;
use chrono::{DateTime, Datelike, Utc};
use domain::league::{Berth, CompetitionScope, FixtureStatus};

/// A finished domestic knockout cup of `country`, configured to start on `start`'s day.
fn domestic_cup(id: &str, country: &str, field: &[String], start: DateTime<Utc>) -> League {
    let mut cup = crate::schedule::generate_knockout_cup(
        id,
        start.year() as u32,
        field,
        start,
        CompetitionType::Cup,
        CompetitionScope::Domestic,
    );
    cup.id = id.into();
    cup.country_id = Some(country.into());
    cup.region_id = Some("europe".into());
    cup.season_start_month = start.month() as u8;
    cup.season_start_day = start.day() as u8;
    for fixture in &mut cup.fixtures {
        fixture.competition_id = id.into();
    }
    finished(cup)
}

fn clubs_of(game: &Game, ids: &[&str]) -> Vec<String> {
    ids.iter()
        .flat_map(|id| find(game, id).participant_ids.clone())
        .collect()
}

/// The ties of a round, each as its two clubs in alphabetical order, sorted.
fn ties(cup: &League, round: usize) -> Vec<(String, String)> {
    let mut ties: Vec<(String, String)> = cup.knockout_rounds[round]
        .fixture_ids
        .iter()
        .map(|id| {
            cup.fixtures
                .iter()
                .find(|fixture| &fixture.id == id)
                .unwrap()
        })
        .map(|fixture| {
            let mut pair = [fixture.home_team_id.clone(), fixture.away_team_id.clone()];
            pair.sort();
            let [first, second] = pair;
            (first, second)
        })
        .collect();
    ties.sort();
    ties
}

/// Given a cup for the clubs of the second division,
/// When the season is rolled over and a club goes down into that division and one goes up,
/// Then the cup's next edition has the club that came down and not the one that went up.
#[test]
fn a_cup_takes_the_clubs_its_divisions_have_when_it_is_renewed() {
    let mut game = english_game(at(2034, 5, 20));
    let field = clubs_of(&game, &["eng-2"]);
    let mut cup = domestic_cup("eng-trophy", "ENG", &field, at(2033, 9, 12));
    cup.rules.entrants_from = vec!["eng-2".into()];
    game.competitions.push(cup);

    advance_to_next_season(&mut game).unwrap();

    let cup = find(&game, "eng-trophy");
    assert_eq!(cup.season, 2034);
    assert_eq!(clubs(cup), ["eng-1-d", "eng-2-b", "eng-2-c", "eng-2-d"]);
    assert_eq!(clubs(cup), clubs(find(&game, "eng-2")));
    assert!(
        cup.fixtures
            .iter()
            .all(|fixture| fixture.status == FixtureStatus::Scheduled)
    );
}

/// Given a cup for two divisions whose field needs two byes,
/// When it is renewed,
/// Then the byes go to the two clubs that finished highest in the first division it names, and
///      the other four, the one that came up and the one that went down among them, are drawn.
#[test]
fn the_byes_go_to_the_best_placed_clubs_of_the_most_senior_division() {
    let mut game = game_on(at(2034, 5, 20), Some("eng-1-a"));
    add(
        &mut game,
        played_out(division("eng-1", "ENG", 0, at(2033, 8, 1))),
    );
    add(
        &mut game,
        played_out(division_of("eng-2", "ENG", 1, at(2033, 8, 1), 2)),
    );
    game.sync_legacy_league();
    let field = clubs_of(&game, &["eng-2", "eng-1"]);
    let mut cup = domestic_cup("eng-cup", "ENG", &field, at(2033, 9, 12));
    cup.rules.entrants_from = vec!["eng-1".into(), "eng-2".into()];
    game.competitions.push(cup);

    advance_to_next_season(&mut game).unwrap();

    let cup = find(&game, "eng-cup");
    assert_eq!(cup.knockout_rounds[0].bye_team_ids, ["eng-1-a", "eng-1-b"]);
    let playing: Vec<String> = ties(cup, 0)
        .into_iter()
        .flat_map(|(first, second)| [first, second])
        .collect();
    let mut sorted = playing.clone();
    sorted.sort();
    assert_eq!(sorted, ["eng-1-c", "eng-1-d", "eng-2-a", "eng-2-b"]);
}

/// Given a cup of sixteen clubs,
/// When it is renewed for two seasons running,
/// Then its first round is drawn anew each time, where it used to be the same eight ties every
///      season; and the same game draws the same ties when the day is replayed.
#[test]
fn a_cup_is_drawn_anew_each_season() {
    let mut game = game_on(at(2034, 5, 20), Some("eng-1-a"));
    for (id, priority) in [("eng-1", 0), ("eng-2", 1)] {
        let league = division_of(id, "ENG", priority, at(2033, 8, 1), 8);
        add(&mut game, played_out(league));
    }
    game.sync_legacy_league();
    let field = clubs_of(&game, &["eng-1", "eng-2"]);
    let mut cup = domestic_cup("eng-cup", "ENG", &field, at(2033, 9, 12));
    cup.rules.entrants_from = vec!["eng-1".into(), "eng-2".into()];
    game.competitions.push(cup);
    let first = ties(find(&game, "eng-cup"), 0);

    let mut replay = game.clone();
    advance_to_next_season(&mut game).unwrap();
    advance_to_next_season(&mut replay).unwrap();
    let second = ties(find(&game, "eng-cup"), 0);

    assert_eq!(second.len(), 8);
    assert_ne!(second, first);
    assert_eq!(
        second,
        ties(find(&replay, "eng-cup"), 0),
        "a replay draws alike"
    );

    // Played out and renewed again, with nobody having changed division in between.
    let cup = find_mut(&mut game, "eng-cup");
    crate::competition_test_support::finish(cup);
    let field = renewed_cup_field(&game, find(&game, "eng-cup"), 2035).unwrap();
    let cup = find_mut(&mut game, "eng-cup");
    cup.participant_ids = field;
    crate::schedule::regenerate_knockout_for_season(cup, 2035, at(2035, 9, 12));

    assert_ne!(ties(find(&game, "eng-cup"), 0), second);
}

/// Given a cup of twelve clubs, four of which have a bye,
/// When its first round has been played,
/// Then the second round is drawn by lot from the four winners and the four clubs that had a
///      bye, where those four used to be paired with each other.
#[test]
fn a_cup_draws_each_round_from_the_winners_and_the_byes_together() {
    let field: Vec<String> = (0..12).map(|club| format!("club-{club:02}")).collect();
    let cup = domestic_cup("cup", "ENG", &field, at(2033, 9, 12));

    let byes = &cup.knockout_rounds[0].bye_team_ids;
    assert_eq!(byes.len(), 4);
    let second_round = ties(&cup, 1);
    assert_eq!(second_round.len(), 4);
    let bye_meets_bye = second_round
        .iter()
        .filter(|(first, second)| byes.contains(first) && byes.contains(second))
        .count();
    assert!(
        bye_meets_bye < 2,
        "the clubs with a bye are no longer kept for each other: {second_round:?}"
    );
    // Still a bracket that can be proved complete.
    assert!(crate::competition_completion::verify_completed_edition(&cup, None).is_ok());
}

fn super_cup_berth(rule: BerthRule) -> Berth {
    Berth {
        target: "eng-super-cup".into(),
        rule,
        fallback_to: None,
    }
}

/// England played out, a finished cup won by `cup_winner`, and a super cup between the league
/// champion and the cup's holder, last played by two other clubs.
fn game_with_a_super_cup(now: DateTime<Utc>, cup_winner: &str) -> Game {
    let mut game = english_game(now);
    // A cup of two clubs is one tie, and `finish` gives it to the home side: the club listed
    // first.
    let field = [cup_winner.to_string(), "eng-2-d".to_string()];
    let mut cup = domestic_cup("eng-cup", "ENG", &field, at(2033, 10, 17));
    cup.berths = vec![super_cup_berth(BerthRule::CupWinner)];
    find_mut(&mut game, "eng-1").berths =
        vec![super_cup_berth(BerthRule::PositionRange { from: 1, to: 1 })];
    let last_played = ["eng-1-c".to_string(), "eng-1-d".to_string()];
    let super_cup = domestic_cup("eng-super-cup", "ENG", &last_played, at(2033, 8, 10));
    game.competitions.push(cup);
    game.competitions.push(super_cup);
    game
}

/// Given a super cup between the league champion and the cup's holder,
/// When the season is rolled over,
/// Then it is played by the club that won the cup and the club that won the league.
#[test]
fn a_super_cup_is_played_by_the_cup_holder_and_the_champion() {
    let mut game = game_with_a_super_cup(at(2034, 5, 20), "eng-2-b");

    advance_to_next_season(&mut game).unwrap();

    let super_cup = find(&game, "eng-super-cup");
    assert_eq!(super_cup.season, 2034);
    assert_eq!(clubs(super_cup), ["eng-1-a", "eng-2-b"]);
    assert_eq!(first_match(super_cup), "2034-08-10");
    assert_eq!(super_cup.fixtures.len(), 1);
}

/// Given one club that won both the league and the cup,
/// When the super cup is renewed,
/// Then it meets the league's runner-up.
#[test]
fn a_double_winner_meets_the_league_runner_up() {
    let mut game = game_with_a_super_cup(at(2034, 5, 20), "eng-1-a");

    advance_to_next_season(&mut game).unwrap();

    assert_eq!(clubs(find(&game, "eng-super-cup")), ["eng-1-a", "eng-1-b"]);
}

/// Given a cup whose final has not been played when the super cup is renewed,
/// When the super cup is renewed,
/// Then the league's top two play it: nobody holds the cup.
#[test]
fn with_nobody_holding_the_cup_the_leagues_top_two_play_the_super_cup() {
    let mut game = game_with_a_super_cup(at(2034, 5, 20), "eng-2-b");
    let cup = find_mut(&mut game, "eng-cup");
    let last = cup.knockout_rounds.last_mut().unwrap();
    last.completed = false;
    let final_id = last.fixture_ids[0].clone();
    let tie = cup
        .fixtures
        .iter_mut()
        .find(|fixture| fixture.id == final_id)
        .unwrap();
    tie.status = FixtureStatus::Scheduled;
    tie.result = None;
    tie.date = "2034-05-30".into();

    let field = renewed_cup_field(&game, find(&game, "eng-super-cup"), 2034).unwrap();

    let mut field = field;
    field.sort();
    assert_eq!(field, ["eng-1-a", "eng-1-b"]);
}

/// Given a cup for a foreign country's divisions, in a country still playing when the player's
/// season is rolled over,
/// When the rollover comes, and then the country's own day and the cup's,
/// Then the rollover leaves the cup, and the cup is drawn on its own day from the clubs the
///      divisions have after that country's promotion and relegation.
#[test]
fn a_cup_of_a_country_still_playing_waits_for_its_clubs_to_have_moved() {
    let mut game = english_game(at(2034, 5, 20));
    add_france(&mut game);
    play(find_mut(&mut game, "fr-1"), "9999-12-31");
    play(find_mut(&mut game, "fr-2"), "2033-09-20");
    let field = clubs_of(&game, &["fr-2"]);
    let mut cup = domestic_cup("fr-trophy", "FR", &field, at(2033, 9, 12));
    cup.rules.entrants_from = vec!["fr-2".into()];
    game.competitions.push(cup);
    assert!(!competitions_renewed_at_rollover(&game).contains("fr-trophy"));

    advance_to_next_season(&mut game).unwrap();
    assert_eq!(
        find(&game, "fr-trophy").season,
        2033,
        "left by the rollover"
    );

    // France finishes; its own day is 4 August, the cup's 15 August.
    play_france(&mut game, "9999-12-31");
    game.clock.current_date = at(2034, 8, 4);
    assert_eq!(
        renew_finished_ladders(&mut game, "2034-08-04"),
        ["fr-1", "fr-2"]
    );
    assert_eq!(
        renew_finished_cups(&mut game, "2034-08-04"),
        Vec::<String>::new()
    );
    game.clock.current_date = at(2034, 8, 15);
    assert_eq!(renew_finished_cups(&mut game, "2034-08-15"), ["fr-trophy"]);

    let cup = find(&game, "fr-trophy");
    assert_eq!(cup.season, 2034);
    assert_eq!(first_match(cup), "2034-09-12");
    assert_eq!(clubs(cup), ["fr-1-d", "fr-2-b", "fr-2-c", "fr-2-d"]);
}

/// Given a cup that is due while its country's divisions have finished and not been settled,
/// When its own day comes,
/// Then it waits: drawn now it would take the clubs of the season before.
#[test]
fn a_cup_waits_while_its_country_has_a_season_to_settle() {
    let mut game = english_game(at(2034, 8, 20));
    add_france(&mut game);
    play_france(&mut game, "9999-12-31");
    // France opens on 1 October here, so its own day is after the cup's.
    for id in ["fr-1", "fr-2"] {
        find_mut(&mut game, id).season_start_month = 10;
    }
    let field = clubs_of(&game, &["fr-2"]);
    let mut cup = domestic_cup("fr-trophy", "FR", &field, at(2033, 9, 12));
    cup.rules.entrants_from = vec!["fr-2".into()];
    game.competitions.push(cup);

    assert_eq!(
        renew_finished_cups(&mut game, "2034-08-20"),
        Vec::<String>::new()
    );

    // A cup with a field of its own does not wait for anybody.
    find_mut(&mut game, "fr-trophy").rules.entrants_from.clear();
    assert_eq!(renew_finished_cups(&mut game, "2034-08-20"), ["fr-trophy"]);
}

/// Given a continental cup, and a domestic cup that names no competition and that no berth
/// names,
/// When their fields are asked for,
/// Then the continental cup is not this module's, and the domestic cup keeps the clubs it had.
#[test]
fn only_a_domestic_cup_is_drawn_here_and_a_cup_with_a_field_of_its_own_keeps_it() {
    let mut game = english_game(at(2034, 5, 20));
    let field = clubs_of(&game, &["eng-1"]);
    let own = domestic_cup("eng-cup", "ENG", &field, at(2033, 9, 12));
    let continental = finished(continental_cup(
        "europe-cup",
        ["eng-1-a", "eng-1-b", "eng-1-c", "eng-1-d"],
        at(2033, 10, 1),
    ));
    game.competitions.push(own);
    game.competitions.push(continental);

    assert_eq!(
        renewed_cup_field(&game, find(&game, "europe-cup"), 2034),
        None
    );
    let mut kept = renewed_cup_field(&game, find(&game, "eng-cup"), 2034).unwrap();
    kept.sort();
    assert_eq!(kept, field);
    assert!(!follows_other_competitions(&game, find(&game, "eng-cup")));
}
