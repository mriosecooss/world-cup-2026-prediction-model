// Next-goal market via competing Poisson processes
// P(A scores before B) = λA/(λA+λB), weighted by P(at least one goal)

const xgUSA = 0.855;
const xgPAR = 0.495;
const total  = xgUSA + xgPAR;

const pNoGoal   = Math.exp(-total);               // neither team scores again
const pGoal     = 1 - pNoGoal;                    // at least one more goal
const pUSAnext  = (xgUSA / total) * pGoal;        // USA scores first
const pPARnext  = (xgPAR / total) * pGoal;        // Paraguay scores first

console.log('xG restante USA :', xgUSA.toFixed(3));
console.log('xG restante PAR :', xgPAR.toFixed(3));
console.log('');
console.log('P(USA anota primero) :', (pUSAnext  * 100).toFixed(1) + '%');
console.log('P(PAR anota primero) :', (pPARnext  * 100).toFixed(1) + '%');
console.log('P(no más goles)      :', (pNoGoal   * 100).toFixed(1) + '%');
console.log('');
console.log('Check (suma):', ((pUSAnext + pPARnext + pNoGoal)*100).toFixed(1) + '%');
