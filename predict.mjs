#!/usr/bin/env node
// Predict any head-to-head — v3: Elo + SPI blended, squad adjustment, venue & phase context.
// node predict.mjs usa paraguay
// node predict.mjs usa mexico usa                   (home team as 3rd arg)
// node predict.mjs usa paraguay --venue dallas --phase group
// node predict.mjs usa paraguay --no-squad --elo-only
import { readFileSync } from 'node:fs';
import { matchProb, matchProbSPI, matchProbBlended } from './elo.mjs';
import { squadAdjustment } from './squad-strength.mjs';
import { phaseMult, venueInfo, venueGoalMult } from './context.mjs';

const { ratings: eloR } = JSON.parse(readFileSync(new URL('./data/elo-calibrated.json', import.meta.url), 'utf8'));
const { ratings: spiR } = JSON.parse(readFileSync(new URL('./data/spi-ratings.json', import.meta.url), 'utf8'));

const argv   = process.argv.slice(2);
const args   = argv.filter(a => !a.startsWith('--'));
const flags  = argv.filter(a => a.startsWith('--'));
const getFlag = (name) => { const f = flags.find(f => f.startsWith(`--${name}=`)); return f ? f.split('=')[1] : null; };
const hasFlag = (name) => flags.includes(`--${name}`);

const [a, b, home] = args;
if (!a || !b) {
  console.log('Usage: node predict.mjs <teamA> <teamB> [homeTeam] [--venue=dallas] [--phase=group] [--no-squad] [--elo-only]');
  process.exit(0);
}

const ra = eloR[a], rb = eloR[b];
if (!ra || !rb) { console.error(`Unknown: ${!ra ? a : b}`); process.exit(1); }

const venueKey  = getFlag('venue');
const phase     = getFlag('phase') || 'group';
const useSquad  = !hasFlag('no-squad');
const eloOnly   = hasFlag('elo-only');

// Squad adjustments
const sqA = squadAdjustment(a);
const sqB = squadAdjustment(b);
const raAdj = useSquad ? ra + sqA.adjustment : ra;
const rbAdj = useSquad ? rb + sqB.adjustment : rb;

// Home bonus
const hb = home === a ? 75 : home === b ? -75 : 0;

// Context multiplier
const pm = phaseMult(phase);
const vm = venueKey ? venueGoalMult(venueKey) : 1.0;
const ctxMult = pm * vm;

// Elo prediction
const eloResult = matchProb(raAdj, rbAdj, hb);

// SPI prediction
let blended = eloResult;
if (!eloOnly && spiR[a] && spiR[b]) {
  const sA = spiR[a], sB = spiR[b];
  const sqMultA = useSquad ? sqA.ratio : 1;
  const sqMultB = useSquad ? sqB.ratio : 1;
  const spiResult = matchProbSPI(
    sA.attack * sqMultA, sB.defense,
    sB.attack * sqMultB, sA.defense,
    hb, ctxMult
  );
  blended = matchProbBlended(eloResult, spiResult, 0.65);
}

const bar = (x) => '█'.repeat(Math.round(x * 30));
const venue = venueKey ? venueInfo(venueKey) : null;

console.log(`\n  ${'─'.repeat(58)}`);
console.log(`  ${a.toUpperCase()} vs ${b.toUpperCase()}${hb ? `  [${home} home]` : '  [neutral]'}${venue ? `  @ ${venue.city}` : ''}`);
console.log(`  Phase: ${phase}  │  Context ×${ctxMult.toFixed(3)}${venue ? `  │  Altitud ${venue.altitudeM}m` : ''}`);
console.log(`  ${'─'.repeat(58)}`);
if (useSquad && (sqA.missing.length || sqB.missing.length)) {
  if (sqA.missing.length) console.log(`  ⚠ ${a} bajas: ${sqA.missing.map(p=>p.name).join(', ')}`);
  if (sqB.missing.length) console.log(`  ⚠ ${b} bajas: ${sqB.missing.map(p=>p.name).join(', ')}`);
}
console.log('');
console.log(`  ${a.padEnd(16)} win  ${(blended.winA*100).toFixed(1).padStart(5)}%  ${bar(blended.winA)}`);
console.log(`  ${'draw'.padEnd(16)}      ${(blended.draw*100).toFixed(1).padStart(5)}%  ${bar(blended.draw)}`);
console.log(`  ${b.padEnd(16)} win  ${(blended.winB*100).toFixed(1).padStart(5)}%  ${bar(blended.winB)}`);
console.log(`\n  xG esperados     :  ${blended.expectedGoalsA.toFixed(2)} – ${blended.expectedGoalsB.toFixed(2)}`);
console.log(`  Modelo Elo       :  ${a} ${(eloResult.winA*100).toFixed(1)}% / ${(eloResult.draw*100).toFixed(1)}% / ${(eloResult.winB*100).toFixed(1)}%`);
if (!eloOnly && spiR[a]) {
  const s = spiR;
  console.log(`  Ataque/Defensa   :  ${a} α=${s[a]?.attack} β=${s[a]?.defense}  │  ${b} α=${s[b]?.attack} β=${s[b]?.defense}`);
  console.log(`  Squad strength   :  ${a} ${(sqA.ratio*100).toFixed(0)}%  │  ${b} ${(sqB.ratio*100).toFixed(0)}%`);
}
console.log(`  Elo (ajustado)   :  ${a} ${raAdj}  │  ${b} ${rbAdj}\n`);
