//! Which competitions start their next edition, and on which day.
//!
//! The rollover is the day the player's own season ends. It used to be the only day a league or
//! a continental competition could start its next edition, and it left alone anything that was
//! still playing. A league that ended some weeks after the player's own then waited for the
//! same day a year on, and started its next season eleven months late. So a competition is
//! renewed by one of two things.
//!
//! - **The rollover** renews the player's own country, and every other country whose every
//!   division has finished, as it always has.
//! - **Its own day** renews what the rollover left: a country once its ladder has nothing left
//!   to play, and a continental cup once it is finished, each four weeks before its next first
//!   match ([`renew_finished_ladders`], [`renew_due_continental_cups`]). A domestic cup has had
//!   a day of its own for longer (`turn::cup_renewal`).
//!
//! A country's ladder is one unit, because promotion and relegation need every division's final
//! table: a division that has finished waits for the ones beside it, and they start the next
//! season together. So is a country that plays one division twice over (an Apertura and a
//! Clausura): its year ends with the second, the clubs are paid for the table the year ended on,
//! and both are renewed then, as they are when the country is the player's own. A league that
//! belongs to no country is a unit by itself.
//!
//! A continental cup is renewed with the cups it shares its clubs with (one confederation's,
//! whose fields are decided together so that no club is in two), once every one of them is
//! finished. It is not renewed at the rollover unless its first match is near: its field is read
//! from the last season each league finished, and four weeks before its first match is the
//! latest day that can be read.
//!
//! Still left to the rollover alone: a manager with no league of his own (out of work, or at a
//! club that plays in none) has no country to be the player's, so every league waits for the day
//! they have all finished, as before; so does a league table that is not a division (a regional
//! side competition), a cup that is neither domestic, regional nor continental, and a continental
//! cup with no configured start.

use std::collections::{BTreeMap, BTreeSet, HashSet};

use chrono::{DateTime, Days, NaiveDate, Utc};
use domain::league::{CompetitionFormat, CompetitionScope, CompetitionType, League};

use super::season_calendar::next_edition;
use super::{
    has_a_fixture_still_to_come, is_cup_edition_finished, is_league_season_ended,
    is_regenerated_at_rollover, season_has_started, user_league_tables,
};
use crate::game::Game;
use crate::world::ladder::is_ladder_table;

/// The break kept between the day a competition is renewed and its first match, in days: the
/// rollover's, and the same on a competition's own day.
pub(crate) const BREAK_BETWEEN_EDITIONS_DAYS: u64 = 28;

/// What a ladder is settled as: a country's divisions together, or a league with no country.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) enum LadderUnit {
    Country(String),
    Standalone(String),
}

impl LadderUnit {
    /// The unit `competition` belongs to; `None` when it is not a division.
    pub(crate) fn of(competition: &League) -> Option<Self> {
        if !is_ladder_table(competition) {
            return None;
        }
        Some(match &competition.country_id {
            Some(country) => Self::Country(country.clone()),
            None => Self::Standalone(competition.id.clone()),
        })
    }

    pub(crate) fn holds(&self, competition: &League) -> bool {
        Self::of(competition).as_ref() == Some(self)
    }

    /// The country, when the unit is one.
    pub(crate) fn country(&self) -> Option<&str> {
        match self {
            Self::Country(country) => Some(country),
            Self::Standalone(_) => None,
        }
    }
}

/// How far a unit's divisions are through their seasons.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub(crate) struct UnitProgress {
    /// Divisions that have played their season out.
    ended: usize,
    /// Divisions with a match still to come.
    playing: usize,
    /// Divisions in any other state: not started, or started with nothing left that the clock
    /// can reach.
    idle: usize,
}

impl UnitProgress {
    /// Nothing is left to play and there is a season to settle. A division that has not started
    /// (one renewed already) does not hold the others up, and neither does one whose only
    /// fixtures left are days the clock has passed.
    pub(crate) fn has_nothing_left_to_play(self) -> bool {
        self.ended > 0 && self.playing == 0
    }

    /// Every division has played its season out.
    pub(crate) fn is_finished(self) -> bool {
        self.ended > 0 && self.playing == 0 && self.idle == 0
    }
}

/// Every unit and how far through its season it is on `today`.
pub(crate) fn ladder_units(game: &Game, today: &str) -> BTreeMap<LadderUnit, UnitProgress> {
    let mut units: BTreeMap<LadderUnit, UnitProgress> = BTreeMap::new();
    for table in &game.competitions {
        let Some(unit) = LadderUnit::of(table) else {
            continue;
        };
        let progress = units.entry(unit).or_default();
        if is_league_season_ended(table) {
            progress.ended += 1;
        } else if season_has_started(table) && has_a_fixture_still_to_come(table, today) {
            progress.playing += 1;
        } else {
            progress.idle += 1;
        }
    }
    units
}

/// The countries with a division that has played its season out and not been renewed: their
/// clubs have still to go up and down.
pub(crate) fn countries_with_a_season_to_settle(game: &Game, today: &str) -> BTreeSet<String> {
    ladder_units(game, today)
        .into_iter()
        .filter(|(_, progress)| progress.ended > 0)
        .filter_map(|(unit, _)| unit.country().map(str::to_string))
        .collect()
}

/// The units the player's own club plays its league football in. Empty for a manager out of
/// work, and for one whose club plays in no league.
pub(crate) fn home_units(game: &Game) -> BTreeSet<LadderUnit> {
    user_league_tables(game)
        .into_iter()
        .filter_map(LadderUnit::of)
        .collect()
}

pub(crate) fn is_continental_cup(competition: &League) -> bool {
    competition.scope == CompetitionScope::Continental
        && competition.kind == CompetitionType::ContinentalClub
        && competition.rules.format != CompetitionFormat::LeagueTable
}

/// The continental cups, grouped by the clubs they share: two are in one group when a
/// competition awards a berth (or a berth's fallback) into both, or when one awards a berth into
/// the other. Each group is the indices of its members in `game.competitions`, in that order; a
/// cup no berth names is a group by itself. A continental competition played as a league table
/// is not a cup and is not listed.
pub(crate) fn continental_groups(game: &Game) -> Vec<Vec<usize>> {
    let members: Vec<usize> = game
        .competitions
        .iter()
        .enumerate()
        .filter(|(_, competition)| is_continental_cup(competition))
        .map(|(index, _)| index)
        .collect();
    let slot_of = |id: &str| {
        members
            .iter()
            .position(|&index| game.competitions[index].id == id)
    };

    // Each member starts in its own group; a group is named by its smallest slot.
    let mut group_of: Vec<usize> = (0..members.len()).collect();
    for source in &game.competitions {
        let mut linked: Vec<usize> = source
            .berths
            .iter()
            .flat_map(|berth| [Some(berth.target.as_str()), berth.fallback_to.as_deref()])
            .flatten()
            .filter_map(slot_of)
            .collect();
        if linked.is_empty() {
            continue;
        }
        linked.extend(slot_of(&source.id));
        let merged: BTreeSet<usize> = linked.iter().map(|&slot| group_of[slot]).collect();
        let name = *merged.first().unwrap_or(&0);
        for group in &mut group_of {
            if merged.contains(group) {
                *group = name;
            }
        }
    }

    let mut groups: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
    for (slot, &index) in members.iter().enumerate() {
        groups.entry(group_of[slot]).or_default().push(index);
    }
    groups.into_values().collect()
}

/// Midnight of `today`, and the earliest day an edition renewed today may start.
fn renewal_window(today: &str) -> Option<(DateTime<Utc>, DateTime<Utc>)> {
    let day_start = NaiveDate::parse_from_str(today, "%Y-%m-%d")
        .ok()?
        .and_hms_opt(0, 0, 0)?
        .and_utc();
    Some((
        day_start,
        day_start + Days::new(BREAK_BETWEEN_EDITIONS_DAYS),
    ))
}

/// Whether the next edition of any of `competitions` is due to start within the break, so that
/// renewing them today starts none of them late. A competition with no configured start (month
/// 0) is never due: it is left to the rollover.
fn next_edition_is_near<'a>(
    game: &Game,
    competitions: impl IntoIterator<Item = &'a League>,
    day_start: DateTime<Utc>,
    earliest_start: DateTime<Utc>,
) -> bool {
    competitions.into_iter().any(|competition| {
        competition.season_start_month != 0
            && next_edition(competition, &game.clock, day_start).start <= earliest_start
    })
}

/// Whether a group of continental cups is renewed on a day of its own: every one has played its
/// edition out, has a configured start, and the first of their next editions is near.
fn continental_group_is_due(
    game: &Game,
    group: &[usize],
    day_start: DateTime<Utc>,
    earliest_start: DateTime<Utc>,
) -> bool {
    let members = || group.iter().map(|&index| &game.competitions[index]);
    members().all(|cup| {
        !cup.fixtures.is_empty() && is_cup_edition_finished(cup) && cup.season_start_month != 0
    }) && next_edition_is_near(game, members(), day_start, earliest_start)
}

/// Whether the rollover renews a group of continental cups: every one is finished (or has not
/// been drawn at all), and either no day of its own will come for one of them (it has no
/// configured start, or no fixtures to finish), or the first of their next editions is near.
fn continental_group_renews_at_rollover(
    game: &Game,
    group: &[usize],
    window: Option<(DateTime<Utc>, DateTime<Utc>)>,
) -> bool {
    let members = || group.iter().map(|&index| &game.competitions[index]);
    if !members().all(is_cup_edition_finished) {
        return false;
    }
    let has_no_day_of_its_own =
        members().any(|cup| cup.season_start_month == 0 || cup.fixtures.is_empty());
    has_no_day_of_its_own
        || window.is_none_or(|(day_start, earliest_start)| {
            next_edition_is_near(game, members(), day_start, earliest_start)
        })
}

/// Whether a finished domestic cup is left by this rollover for a day of its own: its field is
/// read from its country's divisions or cups (`cup_fields`), that country's ladder is not
/// settled by this rollover, and a day of its own will come (it has a configured start and an
/// edition played). Drawn now, it would take the clubs of a season that is still being played.
fn waits_for_its_country(
    game: &Game,
    cup: &League,
    settles: impl Fn(&LadderUnit) -> bool,
    units: &BTreeMap<LadderUnit, UnitProgress>,
) -> bool {
    if cup.season_start_month == 0 || cup.fixtures.is_empty() {
        return false;
    }
    let Some(country) = cup.country_id.as_deref() else {
        return false;
    };
    let unit = LadderUnit::Country(country.to_string());
    units.contains_key(&unit)
        && !settles(&unit)
        && super::cup_fields::follows_other_competitions(game, cup)
}

/// What one rollover renews, decided once, before it moves anything.
pub(crate) struct RolloverPlan {
    renewed: HashSet<String>,
    /// The countries whose clubs move between divisions at this rollover.
    countries: BTreeSet<String>,
}

impl RolloverPlan {
    pub(crate) fn at(game: &Game) -> Self {
        let today = game.clock.current_date.format("%Y-%m-%d").to_string();
        let home = home_units(game);
        let units = ladder_units(game, &today);
        // With no league of his own the player has no country, and no day but this one renews a
        // league: every finished division is renewed here, as it was before leagues had a day
        // of their own.
        let settles = |unit: &LadderUnit| {
            home.is_empty()
                || home.contains(unit)
                || units.get(unit).is_some_and(|unit| unit.is_finished())
        };

        let window = renewal_window(&today);
        let continental: HashSet<usize> = continental_groups(game)
            .into_iter()
            .filter(|group| continental_group_renews_at_rollover(game, group, window))
            .flatten()
            .collect();

        let mut renewed = HashSet::new();
        let mut countries = BTreeSet::new();
        for (index, competition) in game.competitions.iter().enumerate() {
            let unit = LadderUnit::of(competition);
            if let Some(unit) = &unit
                && settles(unit)
                && let Some(country) = unit.country()
            {
                countries.insert(country.to_string());
            }
            let renews = if crate::world_cup::is_world_cup_competition(competition) {
                // Retired and staged by the World Cup's own calendar; what is asked here is only
                // whether its dates are ones the player has been shown.
                is_regenerated_at_rollover(competition)
            } else if let Some(unit) = &unit {
                is_league_season_ended(competition) && settles(unit)
            } else if is_continental_cup(competition) {
                continental.contains(&index)
            } else if waits_for_its_country(game, competition, settles, &units) {
                false
            } else {
                is_regenerated_at_rollover(competition)
            };
            if renews {
                renewed.insert(competition.id.clone());
            }
        }
        Self { renewed, countries }
    }

    /// Whether this rollover starts `competition`'s next edition.
    pub(crate) fn renews(&self, competition: &League) -> bool {
        self.renewed.contains(&competition.id)
    }

    /// Whether this rollover moves clubs between the divisions of `country`.
    pub(crate) fn settles_country(&self, country: &str) -> bool {
        self.countries.contains(country)
    }
}

/// The competitions a rollover run now would start the next edition of, by id. A competition
/// that has finished and is not here is renewed on a day of its own (see the module's note).
pub fn competitions_renewed_at_rollover(game: &Game) -> HashSet<String> {
    RolloverPlan::at(game).renewed
}

/// Ends the season of every ladder the rollover left, once it has nothing left to play and its
/// next season is near, and returns the ids of the divisions it renewed.
///
/// A foreign country's season ends as the player's own does, but without him: its divisions are
/// paid out and recorded, their editions archived and their managers credited, its clubs go up
/// and down, and each division is drawn for its next season on its own configured day. The
/// player's own country is left to the rollover, which is his to trigger; with no country of his
/// own nothing is renewed here (see the module's note).
pub(crate) fn renew_finished_ladders(game: &mut Game, today: &str) -> Vec<String> {
    let Some((day_start, earliest_start)) = renewal_window(today) else {
        return Vec::new();
    };
    let home = home_units(game);
    if home.is_empty() {
        return Vec::new();
    }
    let due: Vec<LadderUnit> = ladder_units(game, today)
        .into_iter()
        .filter(|(unit, progress)| progress.has_nothing_left_to_play() && !home.contains(unit))
        .map(|(unit, _)| unit)
        .filter(|unit| {
            let finished = game
                .competitions
                .iter()
                .filter(|table| unit.holds(table) && is_league_season_ended(table));
            next_edition_is_near(game, finished, day_start, earliest_start)
        })
        .collect();

    let mut renewed = Vec::new();
    for unit in due {
        renewed.extend(settle_unit(game, &unit, today, earliest_start));
    }
    if !renewed.is_empty() {
        // From tomorrow: this runs once today's matches have been played, so a friendly dated
        // today (the first of four, when the season opens in exactly four weeks) would never be.
        crate::schedule::append_preseason_friendlies_where(
            &mut game.competitions,
            day_start + Days::new(1),
            |league| renewed.contains(&league.id),
        );
    }
    renewed
}

/// Settles one ladder: see [`renew_finished_ladders`]. Returns the ids of the divisions renewed.
fn settle_unit(
    game: &mut Game,
    unit: &LadderUnit,
    today: &str,
    earliest_start: DateTime<Utc>,
) -> Vec<String> {
    let finished: Vec<String> = game
        .competitions
        .iter()
        .filter(|table| unit.holds(table) && is_league_season_ended(table))
        .map(|table| table.id.clone())
        .collect();
    if finished.is_empty() {
        return finished;
    }
    log::debug!("[league-renewal] {unit:?} has finished; renewing {finished:?} on {today}");

    // Paid the day the season is settled. No club of this ladder is the player's, so nobody is
    // watched for a prize.
    for division in super::finished_divisions(game, |league| unit.holds(league)) {
        super::pay_out_division(game, &division, today, "");
    }

    let first_new_edition = game.edition_archive.len();
    for table in game
        .competitions
        .iter()
        .filter(|table| finished.contains(&table.id))
    {
        if let Err(failure) =
            crate::edition_archive::archive_completed_edition(&mut game.edition_archive, table)
        {
            log::debug!(
                "[league-renewal] {} season {} not archived: {failure:?}",
                table.id,
                table.season
            );
        }
    }
    crate::manager_records::credit_managers_of_newly_archived_leagues(game, first_new_edition);

    if let Some(country) = unit.country() {
        let mut berth_fields = super::resolve_domestic_berth_fields(game);
        berth_fields.retain(|target, _| {
            game.competitions.iter().any(|competition| {
                &competition.id == target && competition.country_id.as_deref() == Some(country)
            })
        });
        super::apply_pyramid_promotion_relegation_in(&mut game.competitions, |candidate| {
            candidate == country
        });
        super::apply_domestic_berth_promotion_relegation(game, &berth_fields);
    }

    let Game {
        competitions,
        clock,
        ..
    } = game;
    for table in competitions
        .iter_mut()
        .filter(|table| finished.contains(&table.id))
    {
        let edition = next_edition(table, clock, earliest_start);
        crate::schedule::regenerate_league_for_season(table, edition.season, edition.start);
    }
    finished
}

/// Renews every group of continental cups that has played its editions out and whose next
/// first match is near, and returns the ids of the cups it renewed.
///
/// The fields are worked out as the rollover works them out, for the whole group at once, from
/// the last season each league finished and the holder of each cup. An edition that cannot be
/// archived is renewed all the same: a domestic cup that is left unrenewed is picked up by the
/// rollover, and a continental cup has no other day than this.
pub(crate) fn renew_due_continental_cups(game: &mut Game, today: &str) -> Vec<String> {
    let Some((day_start, earliest_start)) = renewal_window(today) else {
        return Vec::new();
    };
    let due: Vec<Vec<usize>> = continental_groups(game)
        .into_iter()
        .filter(|group| continental_group_is_due(game, group, day_start, earliest_start))
        .collect();

    let mut renewed = Vec::new();
    for group in due {
        for &index in &group {
            let cup = &game.competitions[index];
            if let Err(failure) =
                crate::edition_archive::archive_completed_edition(&mut game.edition_archive, cup)
            {
                log::warn!(
                    "[continental-renewal] {} season {} is renewed without being archived: {failure:?}",
                    cup.id,
                    cup.season
                );
            }
        }
        // Read before any cup of the group is redrawn: a cup's holder is a berth into another.
        let berth_fields = super::resolve_continental_fields(game);
        let fields: Vec<Vec<String>> = group
            .iter()
            .map(|&index| {
                let cup = &game.competitions[index];
                berth_fields
                    .get(&cup.id)
                    .cloned()
                    .unwrap_or_else(|| super::continental_qualified_entrants(game, cup))
            })
            .collect();
        for (&index, field) in group.iter().zip(fields) {
            let edition = next_edition(&game.competitions[index], &game.clock, earliest_start);
            let cup = &mut game.competitions[index];
            log::debug!(
                "[continental-renewal] {} season {} finished; renewing as season {} on {today}",
                cup.id,
                cup.season,
                edition.season
            );
            if field.len() >= 2 {
                cup.participant_ids = field;
            }
            match cup.rules.format {
                CompetitionFormat::Knockout => crate::schedule::regenerate_knockout_for_season(
                    cup,
                    edition.season,
                    edition.start,
                ),
                CompetitionFormat::GroupAndKnockout => {
                    crate::group_stage::regenerate_for_season(cup, edition.season, edition.start)
                }
                CompetitionFormat::LeagueTable => continue,
            }
            renewed.push(cup.id.clone());
        }
    }
    renewed
}

#[cfg(test)]
#[path = "renewal_tests.rs"]
mod tests;
