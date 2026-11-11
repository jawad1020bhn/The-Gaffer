//! Small worlds for the tests of the rollover, of a competition's own day and of the cups:
//! divisions that play a double round robin in a few weeks, in which the club listed first
//! always wins.

use crate::clock::GameClock;
use crate::game::Game;
use chrono::{DateTime, Datelike, TimeZone, Utc};
use domain::competition_calendar::{CalendarMetadata, EditionBasis};
use domain::league::{
    Berth, BerthRule, CompetitionScope, CompetitionType, FixtureCompetition, FixtureStatus, League,
    MatchResult,
};
use domain::manager::Manager;
use domain::team::Team;

pub(crate) fn at(year: i32, month: u32, day: u32) -> DateTime<Utc> {
    Utc.with_ymd_and_hms(year, month, day, 12, 0, 0).unwrap()
}

/// A division of four clubs, `{id}-a` to `{id}-d`: see [`division_of`].
pub(crate) fn division(id: &str, country: &str, priority: u32, start: DateTime<Utc>) -> League {
    division_of(id, country, priority, start, 4)
}

/// A division of `size` clubs, `{id}-a` onwards, whose season opens on `start` and is configured
/// to open on that day of every year. Nothing of it is played.
pub(crate) fn division_of(
    id: &str,
    country: &str,
    priority: u32,
    start: DateTime<Utc>,
    size: u8,
) -> League {
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
pub(crate) fn play_with(league: &mut League, through: &str, upset: bool) {
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

pub(crate) fn play(league: &mut League, through: &str) {
    play_with(league, through, false);
}

pub(crate) fn played_out(mut league: League) -> League {
    play(&mut league, "9999-12-31");
    league
}

pub(crate) fn add(game: &mut Game, league: League) {
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
pub(crate) fn game_on(now: DateTime<Utc>, club: Option<&str>) -> Game {
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
pub(crate) fn english_game(now: DateTime<Utc>) -> Game {
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

pub(crate) fn find<'a>(game: &'a Game, id: &str) -> &'a League {
    game.competitions
        .iter()
        .find(|competition| competition.id == id)
        .unwrap_or_else(|| panic!("{id} is missing"))
}

pub(crate) fn find_mut<'a>(game: &'a mut Game, id: &str) -> &'a mut League {
    game.competitions
        .iter_mut()
        .find(|competition| competition.id == id)
        .unwrap_or_else(|| panic!("{id} is missing"))
}

pub(crate) fn first_match(league: &League) -> String {
    league
        .fixtures
        .iter()
        .filter(|fixture| fixture.competition != FixtureCompetition::Friendly)
        .map(|fixture| fixture.date.clone())
        .min()
        .unwrap_or_default()
}

pub(crate) fn clubs(league: &League) -> Vec<&str> {
    let mut clubs: Vec<&str> = league.participant_ids.iter().map(String::as_str).collect();
    clubs.sort_unstable();
    clubs
}

/// France, abroad: two divisions that opened on 1 September 2033, six weeks of football each.
pub(crate) fn add_france(game: &mut Game) {
    add(game, division("fr-1", "FR", 0, at(2033, 9, 1)));
    add(game, division("fr-2", "FR", 1, at(2033, 9, 1)));
}

pub(crate) fn play_france(game: &mut Game, through: &str) {
    for id in ["fr-1", "fr-2"] {
        play(find_mut(game, id), through);
    }
}

/// A continental knockout cup of four clubs, configured to start on `start`'s day every year,
/// with its first round drawn for `start`.
pub(crate) fn continental_cup(id: &str, field: [&str; 4], start: DateTime<Utc>) -> League {
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

pub(crate) fn finished(mut cup: League) -> League {
    crate::competition_test_support::finish(&mut cup);
    cup
}

pub(crate) fn berth(target: &str, from: u32, to: u32) -> Berth {
    Berth {
        target: target.into(),
        rule: BerthRule::PositionRange { from, to },
        fallback_to: None,
    }
}
