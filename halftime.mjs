import { poissonPmf } from './elo.mjs';

// Full-match xG from the model
const fullXgUSA = 1.71;
const fullXgPAR = 0.99;

// Second half xG (approx half of full match)
const xgUSA2 = fullXgUSA / 2;
const xgPAR2 = fullXgPAR / 2;

const currentUSA = 3;
const currentPAR = 0;

// Simulate all possible 2nd half scorelines
let winUSA = 0, draw = 0, winPAR = 0;

for (let a = 0; a <= 8; a++) {
  for (let b = 0; b <= 8; b++) {
    const prob = poissonPmf(a, xgUSA2) * poissonPmf(b, xgPAR2);
    const finalUSA = currentUSA + a;
    const finalPAR = currentPAR + b;
    if (finalUSA > finalPAR) winUSA += prob;
    else if (finalUSA === finalPAR) draw += prob;
    else winPAR += prob;
  }
}

console.log('=HALFTIME_PROBS=');
console.log('win_usa', (winUSA * 100).toFixed(1));
console.log('draw', (draw * 100).toFixed(1));
console.log('win_par', (winPAR * 100).toFixed(1));

// Most likely final scorelines
const scores = [];
for (let a = 0; a <= 5; a++) {
  for (let b = 0; b <= 5; b++) {
    const prob = poissonPmf(a, xgUSA2) * poissonPmf(b, xgPAR2);
    const finalUSA = currentUSA + a;
    const finalPAR = currentPAR + b;
    scores.push({ score: finalUSA + '-' + finalPAR, prob: parseFloat((prob * 100).toFixed(2)) });
  }
}
scores.sort((x, y) => y.prob - x.prob);
console.log('=SCORES=');
scores.slice(0, 10).forEach(s => console.log(s.score, s.prob));

// Expected additional goals 2nd half
console.log('=XG2H=');
console.log('usa2h', xgUSA2.toFixed(2));
console.log('par2h', xgPAR2.toFixed(2));

// Over/Under for FINAL score
let finalTotals = {};
for (let a = 0; a <= 8; a++) {
  for (let b = 0; b <= 8; b++) {
    const prob = poissonPmf(a, xgUSA2) * poissonPmf(b, xgPAR2);
    const total = currentUSA + currentPAR + a + b;
    finalTotals[total] = (finalTotals[total] || 0) + prob;
  }
}
let over35 = 0, over45 = 0;
for (const [t, p] of Object.entries(finalTotals)) {
  if (parseInt(t) > 3) over35 += p;
  if (parseInt(t) > 4) over45 += p;
}
console.log('=TOTALS=');
console.log('over35final', (over35 * 100).toFixed(1));
console.log('over45final', (over45 * 100).toFixed(1));
Object.entries(finalTotals).sort((a,b)=>parseInt(a[0])-parseInt(b[0])).forEach(([t,p])=>console.log('total'+t, (p*100).toFixed(1)));
