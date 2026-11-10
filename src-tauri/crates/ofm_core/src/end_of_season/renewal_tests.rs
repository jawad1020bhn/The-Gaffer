//! The rollover and a competition's own day, on small worlds: divisions that play a double round
//! robin in a few weeks, in which the club listed first always wins.

use super::*;
use crate::clock::GameClock;
use crate::end_of_season::{advance_to_next_season, is_season_complete};
use chrono::{Datelike, TimeZone};
use domain::competition_calendar::{CalendarMetadata, EditionBasis};
use domain::league::{
    Berth, BerthRule, CompetitionScope, CompetitionType, FixtureCompetition, FixtureStatus,
    MatchResult,
};
use domain::manager::Manager;
use domain::team::Team;

fn at(year: i32, month: u32, day: u32) -> DateTime<Utc> {
    Utc.with_ymd_and_hms(year, month, day, 12, 0, 0).unwrap()
}

/// A division of four clubs, `{id}-a` to `{id}-d`: see [`division_of`].
fn division(id: &str, country: &str, priority: u32, start: DateTime<Utc>) -> League {
    division_of(id, country, priority, start, 4)
}

/// A division of `size` clubs, `{id}-a` onwards, whose season opens on `start` and is configured
/// to open on that day of every year. Nothing of it is played.
fn division_of(id: &str, country: &str, priority: u32, start: DateTime<Utc>, size: u8) -> League {
    let clubs: Vec<String> = (0..size)
        .map(|club| format!("{id}-{}", char::from(b'a' + club)))
        .collect();
    let mut league = crate::schedule::generate_league(id, start.year() as u32, &clubs, start);
    league.id = id.into();
    league.country_id = Some(country.into());
    league.region_id = Some("europe".into());
    league.scope = CompetitionScope::Domestic;
    league.priority = priority;
    league.season_start_month = start.month() as u8;
    league.season_start_day = start.day() as u8;
    // What a definition gives a league, and what its edition needs to be archived.
    league.calendar = Some(CalendarMetadata {
        definition_id: id.into(),
        edition_basis: EditionBasis::CalendarYear,
        league_legs: Some(2),
        matchday_gap_days: Some(7),
        ..Default::default()
    });
    for fixture in &mut league.fixtures {
        fixture.competition_id = id.into();
    }
    league
}

/// Plays every league fixture still to play that is dated on or before `through`. The club
/// listed first in the division wins 2-0, so a season played out ends in the order the clubs are
/// listed; with `upset`, the club listed last wins instead.
fn play_with(league: &mut League, through: &str, upset: bool) {
    let rank = |club: &str| {
        league
            .participant_ids
            .iter()
            .position(|id| id == club)
            .unwrap_or(usize::MAX)
    };
    let results: Vec<(usize, u8, u8)> = league
        .fixtures
        .iter()
        .enumerate()
        .filter(|(_, fixture)| {
            fixture.counts_for_league_standings()
                && fixture.status == FixtureStatus::Scheduled
                && fixture.date.as_str() <= through
        })
        .map(|(index, fixture)| {
            let home_is_listed_first = rank(&fixture.home_team_id) < rank(&fixture.away_team_id);
            if home_is_listed_first != upset {
                (index, 2, 0)
            } else {
                (index, 0, 2)
            }
        })
        .collect();
    for (index, home_goals, away_goals) in results {
        let fixture = &mut league.fixtures[index];
        fixture.status = FixtureStatus::Completed;
        fixture.result = Some(MatchResult {
            home_goals,
            away_goals,
            ..Default::default()
        });
        let (home, away) = (fixture.home_team_id.clone(), fixture.away_team_id.clone());
        for entry in &mut league.standings {
            if entry.team_id == home {
                entry.record_result(home_goals, away_goals);
            } else if entry.team_id == away {
                entry.record_result(away_goals, home_goals);
            }
        }
    }
}

fn play(league: &mut League, through: &str) {
    play_with(league, through, false);
}

fn played_out(mut league: League) -> League {
    play(&mut league, "9999-12-31");
    league
}

fn add(game: &mut Game, league: League) {
    for id in &league.participant_ids {
        if !game.teams.iter().any(|team| &team.id == id) {
            let mut team = Team::new(
                id.clone(),
                id.clone(),
                "TST".into(),
                "England".into(),
                "City".into(),
                "Ground".into(),
                1000,
            );
            team.football_nation = league.country_id.clone().unwrap_or_default();
            game.teams.push(team);
        }
    }
    game.competitions.push(league);
}

/// A game on `now` whose manager is in charge of `club`, or out of work.
fn game_on(now: DateTime<Utc>, club: Option<&str>) -> Game {
    let mut manager = Manager::new(
        "manager".into(),
        "First".into(),
        "Last".into(),
        "1980-01-01".into(),
        "ENG".into(),
    );
    if let Some(club) = club {
        manager.hire(club.into());
    }
    manager.satisfaction = 80;
    Game::new(GameClock::new(now), manager, vec![], vec![], vec![], vec![])
}

/// England, the player's own: two divisions that opened on 1 August 2033 and are played out, the
/// player at `eng-1-a`. The clock stands on `now`.
fn english_game(now: DateTime<Utc>) -> Game {
    let mut game = game_on(now, Some("eng-1-a"));
    add(
        &mut game,
        played_out(division("eng-1", "ENG", 0, at(2033, 8, 1))),
    );
    add(
        &mut game,
        played_out(division("eng-2", "ENG", 1, at(2033, 8, 1))),
    );
    game.sync_legacy_league();
    game
}

fn find<'a>(game: &'a Game, id: &str) -> &'a League {
    game.competitions
        .iter()
        .find(|competition| competition.id == id)
        .unwrap_or_else(|| panic!("{id} is missing"))
}

fn find_mut<'a>(game: &'a mut Game, id: &str) -> &'a mut League {
    game.competitions
        .iter_mut()
        .find(|competition| competition.id == id)
        .unwrap_or_else(|| panic!("{id} is missing"))
}

fn first_match(league: &League) -> String {
    league
        .fixtures
        .iter()
        .filter(|fixture| fixture.competition != FixtureCompetition::Friendly)
        .map(|fixture| fixture.date.clone())
        .min()
        .unwrap_or_default()
}

fn clubs(league: &League) -> Vec<&str> {
    let mut clubs: Vec<&str> = league.participant_ids.iter().map(String::as_str).collect();
    clubs.sort_unstable();
    clubs
}

/// France, abroad: two divisions that opened on 1 September 2033, six weeks of football each.
fn add_france(game: &mut Game) {
    add(game, division("fr-1", "FR", 0, at(2033, 9, 1)));
    add(game, division("fr-2", "FR", 1, at(2033, 9, 1)));
}

fn play_france(game: &mut Game, through: &str) {
    for id in ["fr-1", "fr-2"] {
        play(find_mut(game, id), through);
    }
}

// ── The rollover ────────────────────────────────────────────────────────────

/// Given a foreign country one of whose divisions has finished while the other is still playing,
/// When the player's season is rolled over,
/// Then the country is left whole: the finished division keeps its season, its table and its
///      clubs, and waits for the other, where it used to start a season of its own at once and
///      leave the country's clubs unpromoted.
#[test]
fn a_foreign_country_still_playing_is_left_whole_by_the_rollover() {
    let mut game = english_game(at(2034, 5, 20));
    add_france(&mut game);
    play(find_mut(&mut game, "fr-1"), "9999-12-31");
    play(find_mut(&mut game, "fr-2"), "2033-09-20");
    let before = serde_json::to_string(find(&game, "fr-1")).unwrap();
    assert!(is_season_complete(&game));

    advance_to_next_season(&mut game).unwrap();

    assert_eq!(
        find(&game, "eng-1").season,
        2034,
        "the player's own moves on"
    );
    assert_eq!(serde_json::to_string(find(&game, "fr-1")).unwrap(), before);
    assert_eq!(find(&game, "fr-2").season, 2033);
    assert!(
        game.teams
            .iter()
            .filter(|team| team.football_nation == "FR")
            .all(|team| team.history.is_empty()),
        "nothing of France is recorded yet"
    );
}

/// Given a foreign country whose every division has finished,
/// When the player's season is rolled over,
/// Then its season ends there with the player's: recorded, its clubs moved, and each division
///      redrawn for its own configured day.
#[test]
fn a_foreign_country_that_has_finished_is_renewed_at_the_rollover() {
    let mut game = english_game(at(2034, 5, 20));
    add_france(&mut game);
    play_france(&mut game, "9999-12-31");

    advance_to_next_season(&mut game).unwrap();

    for id in ["fr-1", "fr-2"] {
        let league = find(&game, id);
        assert_eq!(league.season, 2034, "{id}");
        assert_eq!(first_match(league), "2034-09-01", "{id}");
    }
    assert_eq!(
        clubs(find(&game, "fr-1")),
        ["fr-1-a", "fr-1-b", "fr-1-c", "fr-2-a"],
        "the last of the first division went down and the first of the second came up"
    );
    assert_eq!(
        clubs(find(&game, "fr-2")),
        ["fr-1-d", "fr-2-b", "fr-2-c", "fr-2-d"]
    );
}

/// Given a manager out of work, who has no country of his own,
/// When the season is rolled over,
/// Then every finished division is renewed there, whatever the rest of its country is doing, as
///      it was before a league had a day of its own: no other day renews one for him.
#[test]
fn with_no_league_of_his_own_the_rollover_renews_every_finished_division() {
    let mut game = game_on(at(2034, 5, 20), None);
    add(
        &mut game,
        played_out(division("fr-1", "FR", 0, at(2033, 9, 1))),
    );
    add(&mut game, division("fr-2", "FR", 1, at(2033, 9, 1)));
    play(find_mut(&mut game, "fr-2"), "2033-09-20");

    let renewed = competitions_renewed_at_rollover(&game);
    assert!(
        renewed.contains("fr-1") && !renewed.contains("fr-2"),
        "{renewed:?}"
    );

    assert_eq!(
        renew_finished_ladders(&mut game, "2034-08-10"),
        Vec::<String>::new()
    );
    assert_eq!(find(&game, "fr-1").season, 2033, "left to the rollover");
}

// ── A country's own day ─────────────────────────────────────────────────────

/// Given a foreign country that finished after the player's rollover,
/// When the days pass,
/// Then nothing is renewed until four weeks before its first match, and that day its season
///      ends as the player's own does: its clubs are paid and have the season on their record,
///      its editions are archived, its clubs go up and down, and each division is drawn for the
///      day it is configured to start.
#[test]
fn a_country_the_rollover_left_is_renewed_four_weeks_before_its_first_match() {
    let mut game = english_game(at(2034, 8, 3));
    add_france(&mut game);
    play_france(&mut game, "9999-12-31");
    let cash_before = game
        .teams
        .iter()
        .find(|team| team.id == "fr-1-a")
        .unwrap()
        .finance;

    assert_eq!(
        renew_finished_ladders(&mut game, "2034-08-03"),
        Vec::<String>::new()
    );
    assert_eq!(
        find(&game, "fr-1").season,
        2033,
        "29 days before the first match"
    );

    game.clock.current_date = at(2034, 8, 4);
    let renewed = renew_finished_ladders(&mut game, "2034-08-04");

    assert_eq!(renewed, ["fr-1", "fr-2"]);
    for id in ["fr-1", "fr-2"] {
        let league = find(&game, id);
        assert_eq!(league.season, 2034, "{id}");
        assert_eq!(first_match(league), "2034-09-01", "{id}");
        assert!(league.standings.iter().all(|row| row.played == 0), "{id}");
        assert_eq!(
            game.edition_archive
                .iter()
                .filter(|edition| edition.is_edition_of(id, 2033))
                .count(),
            1,
            "{id}'s season is in the archive"
        );
    }
    assert_eq!(
        clubs(find(&game, "fr-1")),
        ["fr-1-a", "fr-1-b", "fr-1-c", "fr-2-a"]
    );
    let champion = game.teams.iter().find(|team| team.id == "fr-1-a").unwrap();
    assert_eq!(
        champion
            .history
            .iter()
            .map(|record| (
                record.season,
                record.league_position,
                record.competition_id.as_str()
            ))
            .collect::<Vec<_>>(),
        [(2033, 1, "fr-1")]
    );
    assert!(champion.finance > cash_before, "the title is paid for");
    assert!(
        game.teams
            .iter()
            .filter(|team| team.football_nation == "ENG")
            .all(|team| team.history.is_empty()),
        "England is the rollover's"
    );
}

/// Given a foreign country one of whose divisions finished weeks before the other,
/// When the first one's next season comes near while the other is still playing,
/// Then it waits: the two are renewed together the day the second has finished, so the clubs
///      that go up and down do so between two final tables, and each then opens four weeks on
///      and not on a configured day that has all but come.
#[test]
fn a_finished_division_waits_for_the_one_beside_it() {
    let mut game = english_game(at(2034, 8, 10));
    add_france(&mut game);
    play(find_mut(&mut game, "fr-1"), "9999-12-31");
    // The second division's last round was put back to the day after tomorrow.
    play(find_mut(&mut game, "fr-2"), "2033-09-30");
    for fixture in &mut find_mut(&mut game, "fr-2").fixtures {
        if fixture.status == FixtureStatus::Scheduled {
            fixture.date = "2034-08-12".into();
        }
    }

    assert_eq!(
        renew_finished_ladders(&mut game, "2034-08-10"),
        Vec::<String>::new()
    );
    assert_eq!(find(&game, "fr-1").season, 2033);

    play(find_mut(&mut game, "fr-2"), "2034-08-12");
    game.clock.current_date = at(2034, 8, 12);
    let renewed = renew_finished_ladders(&mut game, "2034-08-12");

    assert_eq!(renewed, ["fr-1", "fr-2"]);
    assert_eq!(first_match(find(&game, "fr-1")), "2034-09-09");
    assert_eq!(first_match(find(&game, "fr-2")), "2034-09-09");
    assert_eq!(
        clubs(find(&game, "fr-2")),
        ["fr-1-d", "fr-2-b", "fr-2-c", "fr-2-d"]
    );
}

/// Given the player's own country, finished and four weeks from its first match,
/// When a day passes without the player rolling the season over,
/// Then it is not renewed: his season ends when he ends it.
#[test]
fn the_players_own_country_is_never_renewed_on_a_day_of_its_own() {
    let mut game = english_game(at(2034, 7, 20));

    assert_eq!(
        renew_finished_ladders(&mut game, "2034-07-20"),
        Vec::<String>::new()
    );
    assert_eq!(find(&game, "eng-1").season, 2033);
}

/// Given a country renewed on a day of its own,
/// When the player's season is rolled over afterwards,
/// Then the country is not renewed again and its clubs do not move a second time.
#[test]
fn a_country_renewed_on_its_own_day_is_left_alone_by_the_next_rollover() {
    let mut game = english_game(at(2034, 8, 4));
    add_france(&mut game);
    play_france(&mut game, "9999-12-31");
    renew_finished_ladders(&mut game, "2034-08-04");
    let first = serde_json::to_string(find(&game, "fr-1")).unwrap();
    let archived = game.edition_archive.len();

    advance_to_next_season(&mut game).unwrap();

    assert_eq!(serde_json::to_string(find(&game, "fr-1")).unwrap(), first);
    assert_eq!(
        game.edition_archive.len(),
        archived + 2,
        "only England's two divisions are archived by the rollover"
    );
}

/// Given a foreign division that belongs to no country,
/// When its next season comes near,
/// Then it is renewed alone: it has nobody to wait for and nobody to exchange clubs with.
#[test]
fn a_league_with_no_country_is_renewed_by_itself() {
    let mut game = english_game(at(2034, 8, 4));
    let mut alone = played_out(division("island", "XX", 0, at(2033, 9, 1)));
    alone.country_id = None;
    add(&mut game, alone);

    assert_eq!(renew_finished_ladders(&mut game, "2034-08-04"), ["island"]);
    assert_eq!(first_match(find(&game, "island")), "2034-09-01");
}

/// Given a division with no configured start,
/// When the days pass,
/// Then it has no day of its own and is left to the rollover.
#[test]
fn a_division_with_no_configured_start_has_no_day_of_its_own() {
    let mut game = english_game(at(2034, 8, 4));
    let mut unscheduled = played_out(division("fr-1", "FR", 0, at(2033, 9, 1)));
    unscheduled.season_start_month = 0;
    add(&mut game, unscheduled);

    assert_eq!(
        renew_finished_ladders(&mut game, "2034-08-04"),
        Vec::<String>::new()
    );
    assert!(competitions_renewed_at_rollover(&game).contains("fr-1"));
}

/// Given a country renewed on its own day, exactly four weeks before its first match,
/// When its clubs' calendars are looked at,
/// Then each division has the friendlies of a pre-season before its first match, as a division
///      renewed at the rollover has, and none of them today: the day's matches have been played
///      by the time a country is renewed, so a friendly dated today would never be.
#[test]
fn a_country_renewed_on_its_own_day_has_a_pre_season_from_tomorrow() {
    let mut game = english_game(at(2034, 8, 4));
    for (id, priority) in [("fr-1", 0), ("fr-2", 1)] {
        let league = division_of(id, "FR", priority, at(2033, 9, 1), 6);
        add(&mut game, played_out(league));
    }

    renew_finished_ladders(&mut game, "2034-08-04");

    for id in ["fr-1", "fr-2"] {
        let mut friendlies: Vec<&str> = find(&game, id)
            .fixtures
            .iter()
            .filter(|fixture| fixture.competition == FixtureCompetition::Friendly)
            .map(|fixture| fixture.date.as_str())
            .collect();
        friendlies.dedup();
        assert_eq!(
            friendlies,
            ["2034-08-11", "2034-08-18", "2034-08-25"],
            "{id}: the first of the four would have been today"
        );
    }
    assert!(
        find(&game, "eng-1")
            .fixtures
            .iter()
            .all(|fixture| fixture.competition != FixtureCompetition::Friendly),
        "England was not renewed today"
    );
}

// ── Continental cups ────────────────────────────────────────────────────────

/// A continental knockout cup of four clubs, configured to start on `start`'s day every year,
/// with its first round drawn for `start`.
fn continental_cup(id: &str, field: [&str; 4], start: DateTime<Utc>) -> League {
    let field: Vec<String> = field.iter().map(|club| club.to_string()).collect();
    let mut cup = crate::schedule::generate_knockout_cup(
        id,
        start.year() as u32,
        &field,
        start,
        CompetitionType::ContinentalClub,
        CompetitionScope::Continental,
    );
    cup.id = id.into();
    cup.region_id = Some("europe".into());
    cup.season_start_month = start.month() as u8;
    cup.season_start_day = start.day() as u8;
    for fixture in &mut cup.fixtures {
        fixture.competition_id = id.into();
    }
    cup
}

fn finished(mut cup: League) -> League {
    crate::competition_test_support::finish(&mut cup);
    cup
}

fn berth(target: &str, from: u32, to: u32) -> Berth {
    Berth {
        target: target.into(),
        rule: BerthRule::PositionRange { from, to },
        fallback_to: None,
    }
}

/// England and France played out, and a finished cup their first divisions each send their top
/// two to, which starts on 1 October and was last played by the two bottom clubs of each.
fn game_with_a_continental_cup(now: DateTime<Utc>) -> Game {
    let mut game = english_game(now);
    add_france(&mut game);
    play_france(&mut game, "9999-12-31");
    for id in ["eng-1", "fr-1"] {
        find_mut(&mut game, id).berths = vec![berth("europe-cup", 1, 2)];
    }
    game.competitions.push(finished(continental_cup(
        "europe-cup",
        ["eng-1-c", "eng-1-d", "fr-1-c", "fr-1-d"],
        at(2033, 10, 1),
    )));
    game
}

/// Given a finished continental cup whose next first match is months after the rollover,
/// When the player's season is rolled over,
/// Then the cup is left as it finished, with the field and the bracket of the edition it
///      played: it is drawn on a day of its own, when the leagues that are still playing have
///      final tables to be read.
#[test]
fn a_continental_cup_months_from_its_first_match_is_left_by_the_rollover() {
    let mut game = game_with_a_continental_cup(at(2034, 5, 20));
    let before = serde_json::to_string(find(&game, "europe-cup")).unwrap();
    assert!(!competitions_renewed_at_rollover(&game).contains("europe-cup"));

    advance_to_next_season(&mut game).unwrap();

    assert_eq!(find(&game, "eng-1").season, 2034);
    assert_eq!(
        serde_json::to_string(find(&game, "europe-cup")).unwrap(),
        before
    );
}

/// Given that cup, and leagues that have since started their next seasons,
/// When four weeks are left before its first match,
/// Then it is archived and drawn for its configured day, and its field is the top two of the
///      season each league last finished, not of the table each has played a round of since.
#[test]
fn a_continental_cup_is_drawn_four_weeks_before_its_first_match_from_the_seasons_last_finished() {
    let mut game = game_with_a_continental_cup(at(2034, 5, 20));
    advance_to_next_season(&mut game).unwrap();
    // A round of the new season in which the clubs listed last win: the tables are led by
    // clubs that finished nowhere near the top.
    for id in ["eng-1", "fr-1"] {
        let opener = first_match(find(&game, id));
        play_with(find_mut(&mut game, id), &opener, true);
        let leader = find(&game, id).sorted_standings()[0].team_id.clone();
        assert!(
            !leader.ends_with("-a") && !leader.ends_with("-b"),
            "{leader}"
        );
    }

    game.clock.current_date = at(2034, 9, 2);
    assert_eq!(
        renew_due_continental_cups(&mut game, "2034-09-02"),
        Vec::<String>::new()
    );

    game.clock.current_date = at(2034, 9, 3);
    assert_eq!(
        renew_due_continental_cups(&mut game, "2034-09-03"),
        ["europe-cup"]
    );

    let cup = find(&game, "europe-cup");
    assert_eq!(cup.season, 2034);
    assert_eq!(first_match(cup), "2034-10-01");
    assert_eq!(clubs(cup), ["eng-1-a", "eng-1-b", "fr-1-a", "fr-1-b"]);
    assert!(
        cup.fixtures
            .iter()
            .all(|fixture| fixture.status == FixtureStatus::Scheduled)
    );
    assert_eq!(
        game.edition_archive
            .iter()
            .filter(|edition| edition.is_edition_of("europe-cup", 2033))
            .count(),
        1
    );
    assert_eq!(
        renew_due_continental_cups(&mut game, "2034-09-04"),
        Vec::<String>::new(),
        "drawn once"
    );
}

/// Given a finished continental cup whose next first match is within four weeks of the rollover,
/// When the player's season is rolled over,
/// Then the rollover renews it, as it always did: no later day could start it on time.
#[test]
fn a_continental_cup_about_to_start_is_renewed_at_the_rollover() {
    let mut game = game_with_a_continental_cup(at(2034, 9, 10));
    assert!(competitions_renewed_at_rollover(&game).contains("europe-cup"));

    advance_to_next_season(&mut game).unwrap();

    let cup = find(&game, "europe-cup");
    assert_eq!(cup.season, 2034);
    assert_eq!(
        first_match(cup),
        "2034-10-08",
        "four weeks after the rollover"
    );
    assert_eq!(clubs(cup), ["eng-1-a", "eng-1-b", "fr-1-a", "fr-1-b"]);
}

/// Given a finished continental cup with no configured start, or one never drawn,
/// When the days pass and the rollover comes,
/// Then no day of its own renews it and the rollover does.
#[test]
fn a_continental_cup_with_no_day_of_its_own_is_the_rollovers() {
    let mut game = game_with_a_continental_cup(at(2034, 5, 20));
    find_mut(&mut game, "europe-cup").season_start_month = 0;
    assert_eq!(
        renew_due_continental_cups(&mut game, "2034-09-03"),
        Vec::<String>::new()
    );
    assert!(competitions_renewed_at_rollover(&game).contains("europe-cup"));

    let mut game = game_with_a_continental_cup(at(2034, 5, 20));
    let cup = find_mut(&mut game, "europe-cup");
    cup.fixtures.clear();
    cup.knockout_rounds.clear();
    assert_eq!(
        renew_due_continental_cups(&mut game, "2034-09-03"),
        Vec::<String>::new()
    );
    assert!(competitions_renewed_at_rollover(&game).contains("europe-cup"));
}

/// Given two continental cups the same leagues send clubs to, one of which starts two weeks
/// before the other,
/// When the first comes within four weeks of its first match,
/// Then both are drawn that day, each for its own day, with no club in both; and neither is
///      drawn while the other still has its final to play.
#[test]
fn continental_cups_that_share_their_feeders_are_drawn_together() {
    let mut game = game_with_a_continental_cup(at(2034, 8, 18));
    for id in ["eng-1", "fr-1"] {
        find_mut(&mut game, id).berths = vec![berth("europe-cup", 1, 2), berth("second-cup", 3, 4)];
    }
    let mut second = continental_cup(
        "second-cup",
        ["eng-1-a", "eng-1-b", "fr-1-a", "fr-1-b"],
        at(2033, 9, 15),
    );
    game.competitions.push(second.clone());
    assert_eq!(continental_groups(&game).len(), 1);

    assert_eq!(
        renew_due_continental_cups(&mut game, "2034-08-18"),
        Vec::<String>::new(),
        "the second cup has not been played"
    );
    assert!(!competitions_renewed_at_rollover(&game).contains("europe-cup"));

    crate::competition_test_support::finish(&mut second);
    *find_mut(&mut game, "second-cup") = second;
    assert_eq!(
        renew_due_continental_cups(&mut game, "2034-08-17"),
        Vec::<String>::new(),
        "29 days before the earlier of the two"
    );
    let mut renewed = renew_due_continental_cups(&mut game, "2034-08-18");
    renewed.sort();

    assert_eq!(renewed, ["europe-cup", "second-cup"]);
    assert_eq!(first_match(find(&game, "second-cup")), "2034-09-15");
    assert_eq!(first_match(find(&game, "europe-cup")), "2034-10-01");
    assert_eq!(
        clubs(find(&game, "europe-cup")),
        ["eng-1-a", "eng-1-b", "fr-1-a", "fr-1-b"]
    );
    assert_eq!(
        clubs(find(&game, "second-cup")),
        ["eng-1-c", "eng-1-d", "fr-1-c", "fr-1-d"]
    );
}

/// Given continental cups linked in each of the ways a berth can link two,
/// When they are grouped,
/// Then cups fed by one competition are together, so are a cup and the one its berth's fallback
///      names, and a cup whose winner enters another; a cup no berth names is by itself, and a
///      continental competition played as a league table is not listed.
#[test]
fn continental_cups_are_grouped_by_the_berths_between_them() {
    let mut game = english_game(at(2034, 5, 20));
    let field = ["eng-1-a", "eng-1-b", "eng-1-c", "eng-1-d"];
    for id in ["first", "second", "third", "super", "apart"] {
        game.competitions
            .push(continental_cup(id, field, at(2033, 10, 1)));
    }
    let mut table = continental_cup("table", field, at(2033, 10, 1));
    table.rules.format = domain::league::CompetitionFormat::LeagueTable;
    game.competitions.push(table);
    // One league feeds the first two; a berth of the other division falls back to the third.
    find_mut(&mut game, "eng-1").berths = vec![berth("first", 1, 1), berth("second", 2, 2)];
    find_mut(&mut game, "eng-2").berths = vec![Berth {
        target: "second".into(),
        rule: BerthRule::CupWinner,
        fallback_to: Some("third".into()),
    }];
    // The winner of the first enters the super cup.
    find_mut(&mut game, "first").berths = vec![Berth {
        target: "super".into(),
        rule: BerthRule::CupWinner,
        fallback_to: None,
    }];

    let groups: Vec<Vec<&str>> = continental_groups(&game)
        .into_iter()
        .map(|group| {
            group
                .into_iter()
                .map(|index| game.competitions[index].id.as_str())
                .collect()
        })
        .collect();

    assert_eq!(
        groups,
        [vec!["first", "second", "third", "super"], vec!["apart"]]
    );
}
