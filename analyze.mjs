// Full pre-match analysis: probabilities, score matrix, markets, context.
// v3: uses blended Elo+SPI model with venue/phase context.
import { matchProb, matchProbSPI, matchProbBlended, poissonPmf } from './elo.mjs';
import { squadAdjustment } from './squad-strength.mjs';
import { phaseMult, venueGoalMult } from './context.mjs';
import { readFileSync } from 'node:fs';

const { ratings: eloR } = JSON.parse(readFileSync(new URL('./data/elo-calibrated.json', import.meta.url), 'utf8'));
const { ratings: spiR } = JSON.parse(readFileSync(new URL('./data/spi-ratings.json', import.meta.url), 'utf8'));

const ra = eloR['usa'], rb = eloR['paraguay'];
const sqA = squadAdjustment('usa'), sqB = squadAdjustment('paraguay');
const phase = 'group', venue = null;
const pm = phaseMult(phase), vm = venue ? venueGoalMult(venue) : 1.0;
const ctx = pm * vm;

// --- Elo prediction ---
const eloResult = matchProb(ra + sqA.adjustment, rb + sqB.adjustment, 0);

// --- SPI prediction ---
const sA = spiR['usa'], sB = spiR['paraguay'];
const spiResult = matchProbSPI(sA.attack * sqA.ratio, sB.defense, sB.attack * sqB.ratio, sA.defense, 0, ctx);

// --- Blended (45% SPI weight) ---
const blended = matchProbBlended(eloResult, spiResult, 0.45);

const lambda = blended.expectedGoalsA;
const mu     = blended.expectedGoalsB;

// Rankings
const allRatings = Object.entries(eloR).sort((a,b) => b[1]-a[1]);
const usaRank = allRatings.findIndex(([t]) => t==='usa') + 1;
const parRank = allRatings.findIndex(([t]) => t==='paraguay') + 1;

// Score matrix
const scores = [];
for (let a = 0; a <= 5; a++)
  for (let b = 0; b <= 5; b++)
    scores.push({ score: `${a}-${b}`, prob: parseFloat((poissonPmf(a,lambda)*poissonPmf(b,mu)*100).toFixed(2)) });
scores.sort((x,y) => y.prob - x.prob);

// Goals distribution
const goalsDist = [];
for (let total = 0; total <= 6; total++) {
  let p = 0;
  for (let a = 0; a <= total; a++) p += poissonPmf(a, lambda) * poissonPmf(total-a, mu);
  goalsDist.push(parseFloat((p*100).toFixed(1)));
}

// Markets
let u25=0, o25=0, u35=0, o35=0, btts=0, csA=0, csB=0;
for (let a=0;a<=8;a++) for (let b=0;b<=8;b++) {
  const p = poissonPmf(a,lambda)*poissonPmf(b,mu);
  if(a+b<=2) u25+=p; else o25+=p;
  if(a+b<=3) u35+=p; else o35+=p;
  if(a>0&&b>0) btts+=p;
  if(b===0) csA+=p;
  if(a===0) csB+=p;
}

// SPI breakdown
console.log('=ELO=');
console.log('usa_elo', ra, 'par_elo', rb);
console.log('usa_rank', usaRank, 'par_rank', parRank, 'total', allRatings.length);

console.log('=SPI=');
console.log('usa_attack',  sA.attack,  'usa_defense',  sA.defense);
console.log('par_attack',  sB.attack,  'par_defense',  sB.defense);

console.log('=ELO_PROBS=');
console.log('win_usa', (eloResult.winA*100).toFixed(1));
console.log('draw',    (eloResult.draw*100).toFixed(1));
console.log('win_par', (eloResult.winB*100).toFixed(1));
console.log('xg_elo', eloResult.expectedGoalsA.toFixed(2), eloResult.expectedGoalsB.toFixed(2));

console.log('=SPI_PROBS=');
console.log('win_usa', (spiResult.winA*100).toFixed(1));
console.log('draw',    (spiResult.draw*100).toFixed(1));
console.log('win_par', (spiResult.winB*100).toFixed(1));
console.log('xg_spi', spiResult.expectedGoalsA.toFixed(2), spiResult.expectedGoalsB.toFixed(2));

console.log('=BLENDED_PROBS=');
console.log('win_usa', (blended.winA*100).toFixed(1));
console.log('draw',    (blended.draw*100).toFixed(1));
console.log('win_par', (blended.winB*100).toFixed(1));
console.log('xg_blend', lambda.toFixed(2), mu.toFixed(2));

console.log('=SCORES=');
scores.slice(0,12).forEach(s => console.log(s.score, s.prob));

console.log('=GOALS_DIST=');
goalsDist.forEach((p,i) => console.log(i, p));

console.log('=MARKETS=');
console.log('under25', (u25*100).toFixed(1));
console.log('over25',  (o25*100).toFixed(1));
console.log('under35', (u35*100).toFixed(1));
console.log('over35',  (o35*100).toFixed(1));
console.log('btts',    (btts*100).toFixed(1));
console.log('usa_cs',  (csA*100).toFixed(1));
console.log('par_cs',  (csB*100).toFixed(1));
