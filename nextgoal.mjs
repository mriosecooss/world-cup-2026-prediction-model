// Next-goal market via competing Poisson processes
// Adjusted for time remaining in the match

const fullXgUSA = 1.71;
const fullXgPAR = 0.99;
const matchMinutes = 90;

const minuteNow = parseInt(process.argv[2] || '64');
const remaining = matchMinutes - minuteNow;
const fraction  = remaining / matchMinutes;

const xgUSA = fullXgUSA * fraction;
const xgPAR = fullXgPAR * fraction;
const total  = xgUSA + xgPAR;

const pNoGoal  = Math.exp(-total);
const pGoal    = 1 - pNoGoal;
const pUSAnext = (xgUSA / total) * pGoal;
const pPARnext = (xgPAR / total) * pGoal;

console.log(`Minuto        : ${minuteNow}'`);
console.log(`Tiempo restante: ${remaining} min (${(fraction*100).toFixed(0)}% del partido)`);
console.log(`xG restante USA: ${xgUSA.toFixed(3)}`);
console.log(`xG restante PAR: ${xgPAR.toFixed(3)}`);
console.log('');
console.log(`P(USA anota primero) : ${(pUSAnext*100).toFixed(1)}%`);
console.log(`P(PAR anota primero) : ${(pPARnext*100).toFixed(1)}%`);
console.log(`P(no más goles)      : ${(pNoGoal*100).toFixed(1)}%`);
console.log(`Check (suma)         : ${((pUSAnext+pPARnext+pNoGoal)*100).toFixed(1)}%`);
