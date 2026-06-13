// Halftime recalculation — v3: uses blended Elo+SPI xG + minute distribution.
import { poissonPmf, matchProbBlended, matchProbSPI, matchProb } from './elo.mjs';
import { readFileSync } from 'node:fs';

const { ratings: eloR } = JSON.parse(readFileSync(new URL('./data/elo-calibrated.json', import.meta.url), 'utf8'));
const { ratings: spiR } = JSON.parse(readFileSync(new URL('./data/spi-ratings.json', import.meta.url), 'utf8'));

// Minute distribution
const RATE_BLOCKS = [
  { from:  1, to: 15, rate: 0.714 },
  { from: 16, to: 30, rate: 0.876 },
  { from: 31, to: 45, rate: 1.048 },
  { from: 46, to: 60, rate: 0.790 },
  { from: 61, to: 75, rate: 1.067 },
  { from: 76, to: 90, rate: 1.505 },
];
const FULL_WEIGHT = 90;
function rateIntegral(from, to = 90) {
  let w = 0;
  for (const b of RATE_BLOCKS) { const s=Math.max(from,b.from),e=Math.min(to,b.to); if(e>s) w+=(e-s)*b.rate; }
  return w;
}

// Blended full-match xG
const ra = eloR['usa'], rb = eloR['paraguay'];
const eloFull = matchProb(ra, rb, 0);
const spiA = spiR['usa'], spiB = spiR['paraguay'];
const spiFull = matchProbSPI(spiA.attack, spiB.defense, spiB.attack, spiA.defense, 0, 1.0);
const blendFull = matchProbBlended(eloFull, spiFull, 0.45);

const fullXgUSA = blendFull.expectedGoalsA;
const fullXgPAR = blendFull.expectedGoalsB;

const currentUSA = 3, currentPAR = 0;
const minuteHT   = 45; // halftime

// Remaining xG (second half) weighted by minute distribution
const htRemainingFrac = rateIntegral(minuteHT + 1, 90) / FULL_WEIGHT;
const xgUSA2 = fullXgUSA * htRemainingFrac;
const xgPAR2 = fullXgPAR * htRemainingFrac;

// Final result probabilities
let winUSA=0, drawR=0, winPAR=0;
for (let a=0;a<=8;a++) for (let b=0;b<=8;b++) {
  const p = poissonPmf(a,xgUSA2)*poissonPmf(b,xgPAR2);
  const fA = currentUSA+a, fB = currentPAR+b;
  if(fA>fB) winUSA+=p; else if(fA===fB) drawR+=p; else winPAR+=p;
}

// Final score distribution
const scores=[];
for (let a=0;a<=5;a++) for (let b=0;b<=5;b++) {
  scores.push({ score:`${currentUSA+a}-${currentPAR+b}`, prob:parseFloat((poissonPmf(a,xgUSA2)*poissonPmf(b,xgPAR2)*100).toFixed(2))});
}
scores.sort((x,y)=>y.prob-x.prob);

// Over/under final
let finalTotals={};
for (let a=0;a<=8;a++) for (let b=0;b<=8;b++) {
  const p=poissonPmf(a,xgUSA2)*poissonPmf(b,xgPAR2);
  const t=currentUSA+currentPAR+a+b;
  finalTotals[t]=(finalTotals[t]||0)+p;
}
let o35f=0, o45f=0;
for (const [t,p] of Object.entries(finalTotals)) { if(+t>3)o35f+=p; if(+t>4)o45f+=p; }

console.log('=BLENDED_XG=');
console.log('full_usa', fullXgUSA.toFixed(3), 'full_par', fullXgPAR.toFixed(3));
console.log('2h_frac_weighted', htRemainingFrac.toFixed(3));
console.log('xg_usa2h', xgUSA2.toFixed(3), 'xg_par2h', xgPAR2.toFixed(3));
console.log('=HALFTIME_PROBS=');
console.log('win_usa', (winUSA*100).toFixed(1));
console.log('draw', (drawR*100).toFixed(1));
console.log('win_par', (winPAR*100).toFixed(1));
console.log('=SCORES=');
scores.slice(0,10).forEach(s=>console.log(s.score, s.prob));
console.log('=TOTALS=');
console.log('over35final', (o35f*100).toFixed(1));
console.log('over45final', (o45f*100).toFixed(1));
Object.entries(finalTotals).sort((a,b)=>+a[0]-+b[0]).slice(0,8).forEach(([t,p])=>console.log('total'+t, (p*100).toFixed(1)));
