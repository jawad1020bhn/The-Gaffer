//! The field a domestic cup starts its next edition with, and the order it is drawn in.
//!
//! A cup used to be renewed with the clubs and the pairings it had, so a club relegated out of
//! the divisions a cup is for stayed in it, and its first round was the same tie every season.
//! A cup's field now comes from one of three places, asked in this order.
//!
//! - **Berths.** A domestic cup other competitions award berths into is a super cup: the holders
//!   of the cups that name it, then the clubs in the league places that name it, and, when one
//!   club is both, the next clubs down that league's table.
//! - **`entrants_from`.** The clubs the competitions it names have the day the cup is renewed,
//!   the first one's first and each in the order it last finished.
//! - Otherwise the clubs it had.
//!
//! A knockout cup is then drawn: the clubs first in that order take the byes a field that is
//! not a power of two needs, and the rest are paired by lot, a different lot each season. A cup
//! that opens with groups keeps the order, which is what its groups are seeded from.

use std::collections::HashSet;

use domain::league::{BerthRule, CompetitionFormat, CompetitionScope, CompetitionType, League};
use rand::seq::SliceRandom;

use super::berths::{cup_champion, last_final_table};
use crate::game::Game;

/// A cup of a country or of a region: the competitions this module draws.
pub(crate) fn is_domestic_cup(competition: &League) -> bool {
    competition.kind == CompetitionType::Cup
        && matches!(
            competition.scope,
            CompetitionScope::Domestic | CompetitionScope::Regional
        )
        && competition.rules.format != CompetitionFormat::LeagueTable
}

/// Whether `cup`'s field is read from other competitions each time it is renewed, so that it
/// has to be renewed after they have settled.
pub(crate) fn follows_other_competitions(game: &Game, cup: &League) -> bool {
    is_domestic_cup(cup)
        && (!cup.rules.entrants_from.is_empty()
            || super::competition_has_incoming_berths(game, &cup.id))
}

/// The field `cup` starts `season` with, in the order it is drawn in. `None` for a competition
/// this module does not draw, which keeps what it has.
pub(crate) fn renewed_cup_field(game: &Game, cup: &League, season: u32) -> Option<Vec<String>> {
    if !is_domestic_cup(cup) {
        return None;
    }
    let field = berth_field(game, cup)
        .or_else(|| entrants_field(game, cup))
        .unwrap_or_else(|| cup.participant_ids.clone());
    if field.len() < 2 {
        return None;
    }
    Some(drawn(game, cup, field, season))
}

/// A super cup's field: see the module's note. `None` when no berth names the cup, or when the
/// berths give fewer than two clubs (a cup nobody has won yet).
fn berth_field(game: &Game, cup: &League) -> Option<Vec<String>> {
    if !super::competition_has_incoming_berths(game, &cup.id) {
        return None;
    }
    let size = cup.participant_ids.len().max(2);
    let names_cup = |source: &League, wanted: fn(&BerthRule) -> bool| {
        source
            .berths
            .iter()
            .filter(|berth| berth.target == cup.id && wanted(&berth.rule))
            .map(|berth| berth.rule.clone())
            .collect::<Vec<_>>()
    };
    let is_cup_winner = |rule: &BerthRule| matches!(rule, BerthRule::CupWinner);
    let is_position_range = |rule: &BerthRule| matches!(rule, BerthRule::PositionRange { .. });

    let mut holders = Vec::new();
    let mut placed = Vec::new();
    let mut next_down = Vec::new();
    for source in &game.competitions {
        if !names_cup(source, is_cup_winner).is_empty() {
            holders.extend(cup_champion(game, source));
        }
        let ranges = names_cup(source, is_position_range);
        if ranges.is_empty() {
            continue;
        }
        let table = last_final_table(game, source);
        let mut last_place = 0;
        for rule in ranges {
            if let BerthRule::PositionRange { from, to } = rule {
                let first = (from as usize).saturating_sub(1);
                let count = (to.saturating_sub(from) as usize).saturating_add(1);
                placed.extend(table.iter().skip(first).take(count).cloned());
                last_place = last_place.max(first.saturating_add(count));
            }
        }
        next_down.extend(table.into_iter().skip(last_place));
    }

    let mut seen = HashSet::new();
    let field: Vec<String> = holders
        .into_iter()
        .chain(placed)
        .chain(next_down)
        .filter(|club| seen.insert(club.clone()))
        .take(size)
        .collect();
    (field.len() >= 2).then_some(field)
}

/// The clubs of the competitions `cup` names, as they stand today: the first competition's
/// first, each in the order its clubs last finished (a club that has just arrived after them).
fn entrants_field(game: &Game, cup: &League) -> Option<Vec<String>> {
    if cup.rules.entrants_from.is_empty() {
        return None;
    }
    let mut seen = HashSet::new();
    let mut field = Vec::new();
    for source_id in &cup.rules.entrants_from {
        let Some(source) = game
            .competitions
            .iter()
            .find(|competition| &competition.id == source_id)
        else {
            continue;
        };
        let finished = last_final_table(game, source);
        let place = |club: &String| {
            finished
                .iter()
                .position(|other| other == club)
                .unwrap_or(usize::MAX)
        };
        let mut clubs = source.participant_ids.clone();
        clubs.sort_by_key(place);
        field.extend(clubs.into_iter().filter(|club| seen.insert(club.clone())));
    }
    (field.len() >= 2).then_some(field)
}

/// `field` in the order it is drawn in: see the module's note.
fn drawn(game: &Game, cup: &League, mut field: Vec<String>, season: u32) -> Vec<String> {
    if cup.rules.format != CompetitionFormat::Knockout {
        return field;
    }
    let byes = crate::schedule::knockout_bye_count(field.len())
        .unwrap_or(0)
        .min(field.len());
    let mut rng = game.rng_for("cup-draw", &format!("{}:{season}", cup.id));
    field[byes..].shuffle(&mut rng);
    field
}

#[cfg(test)]
#[path = "cup_fields_tests.rs"]
mod tests;
