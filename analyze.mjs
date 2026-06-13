import { matchProb, poissonPmf } from './elo.mjs';
import { readFileSync } from 'node:fs';

const { ratings } = JSON.parse(readFileSync('./data/elo-calibrated.json', 'utf8'));
const ra = ratings['usa'];
const rb = ratings['paraguay'];
const p = matchProb(ra, rb, 0);
const lambda = p.expectedGoalsA;
const mu = p.expectedGoalsB;

// Score probability matrix
const scores = [];
for (let a = 0; a <= 5; a++) {
  for (let b = 0; b <= 5; b++) {
    const prob = poissonPmf(a, lambda) * poissonPmf(b, mu);
    scores.push({ score: a + '-' + b, prob: parseFloat((prob * 100).toFixed(2)), a, b });
  }
}
scores.sort((x, y) => y.prob - x.prob);

console.log('=SCORES=');
scores.slice(0, 12).forEach(s => console.log(s.score, s.prob));

// Goals distribution
console.log('=GOALS_DIST=');
for (let total = 0; total <= 6; total++) {
  let pt = 0;
  for (let a = 0; a <= total; a++) pt += poissonPmf(a, lambda) * poissonPmf(total - a, mu);
  console.log(total, parseFloat((pt * 100).toFixed(1)));
}

// Over/Under
let u25 = 0, o25 = 0, u35 = 0, o35 = 0;
for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8; b++) {
  const prob = poissonPmf(a, lambda) * poissonPmf(b, mu);
  if (a + b <= 2) u25 += prob; else o25 += prob;
  if (a + b <= 3) u35 += prob; else o35 += prob;
}
console.log('=MARKETS=');
console.log('under25', parseFloat((u25 * 100).toFixed(1)));
console.log('over25', parseFloat((o25 * 100).toFixed(1)));
console.log('under35', parseFloat((u35 * 100).toFixed(1)));
console.log('over35', parseFloat((o35 * 100).toFixed(1)));

// BTTS
let btts = 0;
for (let a = 1; a <= 8; a++) for (let b = 1; b <= 8; b++) btts += poissonPmf(a, lambda) * poissonPmf(b, mu);
console.log('btts', parseFloat((btts * 100).toFixed(1)));

// USA clean sheet
let cs = 0;
for (let a = 0; a <= 8; a++) cs += poissonPmf(a, lambda) * poissonPmf(0, mu);
console.log('usa_cs', parseFloat((cs * 100).toFixed(1)));

// Paraguay clean sheet
let cs2 = 0;
for (let b = 0; b <= 8; b++) cs2 += poissonPmf(0, lambda) * poissonPmf(b, mu);
console.log('par_cs', parseFloat((cs2 * 100).toFixed(1)));

// Global rankings
const allRatings = Object.entries(ratings).sort((a, b) => b[1] - a[1]);
const usaRank = allRatings.findIndex(([t]) => t === 'usa') + 1;
const parRank = allRatings.findIndex(([t]) => t === 'paraguay') + 1;
console.log('=RANKINGS=');
console.log('usa_rank', usaRank, 'of', allRatings.length);
console.log('par_rank', parRank, 'of', allRatings.length);
