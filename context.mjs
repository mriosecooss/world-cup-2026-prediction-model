// Match context adjustments: phase, venue altitude, home advantage per team.
import { readFileSync } from 'node:fs';

const venues = JSON.parse(readFileSync(new URL('./data/venues-wc2026.json', import.meta.url), 'utf8'));

// Phase multipliers on expected goals
export const PHASE_MULT = {
  'group':        1.00,   // baseline
  'round-of-32':  0.90,   // more cautious
  'round-of-16':  0.88,
  'quarterfinal': 0.86,
  'semifinal':    0.84,
  'final':        0.82,   // most cautious, highest stakes
};

// Per-team home advantage calibration (flat 75 Elo default; these refine it)
// Positive = benefits more from home support; negative = nearly unaffected
export const HOME_ADV_OFFSET = {
  'mexico': +20, 'usa': +10, 'canada': +5,
  'argentina': +5, 'brazil': +5, 'england': +8, 'germany': +5, 'france': +5,
  'japan': +12, 'south-korea': +12, 'iran': +10, 'senegal': +8,
};

// Returns the goal multiplier for a given venue key (see venues-wc2026.json)
export function venueGoalMult(venueKey) {
  return venues.venues[venueKey]?.goalMult ?? 1.0;
}

// Returns venue info
export function venueInfo(venueKey) {
  return venues.venues[venueKey] ?? null;
}

// Returns the phase xG multiplier
export function phaseMult(phase = 'group') {
  return PHASE_MULT[phase.toLowerCase()] ?? 1.0;
}

// Effective home bonus for a team at a venue
export function homeBonus(teamSlug, isHome) {
  if (!isHome) return 0;
  return 75 + (HOME_ADV_OFFSET[teamSlug] ?? 0);
}

// Full context multiplier combining phase + venue
export function contextMult(phase = 'group', venueKey = null) {
  const pm = phaseMult(phase);
  const vm = venueKey ? venueGoalMult(venueKey) : 1.0;
  return pm * vm;
}

// CLI: node context.mjs mexico-city quarterfinal
if (process.argv[2]) {
  const v = process.argv[2], p = process.argv[3] || 'group';
  const info = venueInfo(v);
  console.log(`Venue : ${info?.city ?? v} — ${info?.stadium ?? '?'}`);
  console.log(`Altitud : ${info?.altitudeM ?? '?'}m`);
  console.log(`Fase    : ${p}`);
  console.log(`Mult. goles : ×${contextMult(p, v).toFixed(3)}`);
  console.log(`  (venue ×${info?.goalMult ?? 1} × fase ×${phaseMult(p)})`);
}
