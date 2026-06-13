#!/usr/bin/env node
// Análisis pre-partido completo: probabilidades, matriz de marcadores, mercados, contexto.
// v4: CLI genérico + blended Elo+SPI 0.65 (consistente con predict.mjs).
//   node analyze.mjs <equipo1> <equipo2> [local] [--venue=X] [--phase=X]
//   node analyze.mjs usa paraguay
//   node analyze.mjs brazil morocco --phase=round-of-16
import { matchProb, matchProbSPI, matchProbBlended, poissonPmf } from './elo.mjs';
import { squadAdjustment } from './squad-strength.mjs';
import { phaseMult, venueGoalMult } from './context.mjs';
import { readFileSync } from 'node:fs';

const SPI_WEIGHT = 0.65;
const { ratings: eloR } = JSON.parse(readFileSync(new URL('./data/elo-calibrated.json', import.meta.url), 'utf8'));
const { ratings: spiR } = JSON.parse(readFileSync(new URL('./data/spi-ratings.json', import.meta.url), 'utf8'));

const argv  = process.argv.slice(2);
const args  = argv.filter(a => !a.startsWith('--'));
const flags = argv.filter(a => a.startsWith('--'));
const getFlag = (name) => { const f = flags.find(f => f.startsWith(`--${name}=`)); return f ? f.split('=')[1] : null; };

const [t1, t2, home] = args;
if (!t1 || !t2) {
  console.log('Uso: node analyze.mjs <equipo1> <equipo2> [local] [--venue=X] [--phase=X]');
  process.exit(0);
}
if (!eloR[t1]) { console.error(`Equipo desconocido: '${t1}'`); process.exit(1); }
if (!eloR[t2]) { console.error(`Equipo desconocido: '${t2}'`); process.exit(1); }

const phase = getFlag('phase') || 'group';
const venueKey = getFlag('venue');
const pm = phaseMult(phase), vm = venueKey ? venueGoalMult(venueKey) : 1.0;
const ctx = pm * vm;
const hb = home === t1 ? 75 : home === t2 ? -75 : 0;

const ra = eloR[t1], rb = eloR[t2];
const sqA = squadAdjustment(t1), sqB = squadAdjustment(t2);

// --- Elo prediction ---
const eloResult = matchProb(ra + sqA.adjustment, rb + sqB.adjustment, hb);

// --- Blended ---
let blended = eloResult;
if (spiR[t1] && spiR[t2]) {
  const sA = spiR[t1], sB = spiR[t2];
  const spiResult = matchProbSPI(sA.attack * sqA.ratio, sB.defense, sB.attack * sqB.ratio, sA.defense, hb, ctx);
  blended = matchProbBlended(eloResult, spiResult, SPI_WEIGHT);
}

const lambda = blended.expectedGoalsA;
const mu     = blended.expectedGoalsB;

// Rankings
const allRatings = Object.entries(eloR).sort((a, b) => b[1] - a[1]);
const rank1 = allRatings.findIndex(([t]) => t === t1) + 1;
const rank2 = allRatings.findIndex(([t]) => t === t2) + 1;

// Score matrix
const scores = [];
for (let a = 0; a <= 5; a++)
  for (let b = 0; b <= 5; b++)
    scores.push({ score: `${a}-${b}`, prob: parseFloat((poissonPmf(a, lambda) * poissonPmf(b, mu) * 100).toFixed(2)) });
scores.sort((x, y) => y.prob - x.prob);

// Goals distribution
const goalsDist = [];
for (let total = 0; total <= 6; total++) {
  let p = 0;
  for (let a = 0; a <= total; a++) p += poissonPmf(a, lambda) * poissonPmf(total - a, mu);
  goalsDist.push(parseFloat((p * 100).toFixed(1)));
}

// Markets
let u25 = 0, o25 = 0, u35 = 0, o35 = 0, btts = 0, csA = 0, csB = 0;
for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8; b++) {
  const p = poissonPmf(a, lambda) * poissonPmf(b, mu);
  if (a + b <= 2) u25 += p; else o25 += p;
  if (a + b <= 3) u35 += p; else o35 += p;
  if (a > 0 && b > 0) btts += p;
  if (b === 0) csA += p;
  if (a === 0) csB += p;
}

const pct = (x) => (x * 100).toFixed(1);
const U = (s) => s.toUpperCase();

console.log(`\n========== ${U(t1)} vs ${U(t2)} ==========`);
console.log(`Fase: ${phase}${venueKey ? `  Venue: ${venueKey}` : ''}${hb ? `  Local: ${home}` : '  (neutral)'}  Context x${ctx.toFixed(3)}`);

console.log('\n=ELO=');
console.log(`${t1}_elo`, ra, `(rank ${rank1}/${allRatings.length})`);
console.log(`${t2}_elo`, rb, `(rank ${rank2}/${allRatings.length})`);

if (spiR[t1] && spiR[t2]) {
  console.log('\n=SPI=');
  console.log(`${t1}: attack ${spiR[t1].attack}  defense ${spiR[t1].defense}`);
  console.log(`${t2}: attack ${spiR[t2].attack}  defense ${spiR[t2].defense}`);
}

console.log('\n=BLENDED_PROBS=');
console.log(`win_${t1}`, pct(blended.winA));
console.log('draw', pct(blended.draw));
console.log(`win_${t2}`, pct(blended.winB));
console.log('xg', lambda.toFixed(2), mu.toFixed(2));

console.log('\n=SCORES (top 12)=');
scores.slice(0, 12).forEach(s => console.log(s.score, s.prob));

console.log('\n=GOALS_DIST=');
goalsDist.forEach((p, i) => console.log(i, p));

console.log('\n=MARKETS=');
console.log('under25', pct(u25), 'over25', pct(o25));
console.log('under35', pct(u35), 'over35', pct(o35));
console.log('btts', pct(btts));
console.log(`${t1}_clean_sheet`, pct(csA));
console.log(`${t2}_clean_sheet`, pct(csB));
console.log('');
