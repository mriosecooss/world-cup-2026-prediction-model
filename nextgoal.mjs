// Next-goal market via competing Poisson processes.
// v2: minute-weighted scoring rate — late minutes have higher goal frequency.
// Usage: node nextgoal.mjs <minute> [xgA] [xgB]
//   node nextgoal.mjs 64              (uses default USA/PAR xG from spi-ratings.json)
//   node nextgoal.mjs 64 1.71 0.99   (manual xG override)
import { readFileSync } from 'node:fs';
import { RATE_BLOCKS, rateIntegral } from './constants.mjs';

const FULL_WEIGHT = rateIntegral(1, 90); // = 90.0 (verified)

// Get xG from SPI ratings (or fallback to Elo-based)
function getBaseXg() {
  try {
    const { ratings } = JSON.parse(readFileSync(new URL('./data/spi-ratings.json', import.meta.url), 'utf8'));
    const { ratings: elo } = JSON.parse(readFileSync(new URL('./data/elo-calibrated.json', import.meta.url), 'utf8'));
    const usa = ratings.usa, par = ratings.paraguay;
    const BASE = 1.35;
    // Blended: 55% SPI + 45% Elo
    const spiXgA = BASE * usa.attack * par.defense;
    const spiXgB = BASE * par.attack * usa.defense;
    const diffElo = elo.ratings.usa - elo.ratings.paraguay;
    const eloXgA = Math.max(0.3, BASE + diffElo / 400);
    const eloXgB = Math.max(0.3, BASE - diffElo / 400);
    return {
      xgA: 0.55 * spiXgA + 0.45 * eloXgA,
      xgB: 0.55 * spiXgB + 0.45 * eloXgB,
    };
  } catch {
    return { xgA: 1.71, xgB: 0.99 }; // fallback
  }
}

const minuteNow = parseInt(process.argv[2] || '64');
const argXgA    = parseFloat(process.argv[3]);
const argXgB    = parseFloat(process.argv[4]);

// Remaining rate weight
const remaining = rateIntegral(minuteNow, 90);
const fracLinear = (90 - minuteNow) / 90;
const fracWeighted = remaining / FULL_WEIGHT;

// Load base xG
let fullXgA, fullXgB;
try {
  const spi = JSON.parse(readFileSync(new URL('./data/spi-ratings.json', import.meta.url), 'utf8'));
  const elo = JSON.parse(readFileSync(new URL('./data/elo-calibrated.json', import.meta.url), 'utf8'));
  const BASE = 1.35;
  const spiA = BASE * spi.ratings.usa.attack    * spi.ratings.paraguay.defense;
  const spiB = BASE * spi.ratings.paraguay.attack * spi.ratings.usa.defense;
  const diffElo = elo.ratings.usa - elo.ratings.paraguay;
  const eloA = Math.max(0.3, BASE + diffElo / 400);
  const eloB = Math.max(0.3, BASE - diffElo / 400);
  fullXgA = isNaN(argXgA) ? (0.55 * spiA + 0.45 * eloA) : argXgA;
  fullXgB = isNaN(argXgB) ? (0.55 * spiB + 0.45 * eloB) : argXgB;
} catch {
  fullXgA = isNaN(argXgA) ? 1.71 : argXgA;
  fullXgB = isNaN(argXgB) ? 0.99 : argXgB;
}

const xgA = fullXgA * fracWeighted;
const xgB = fullXgB * fracWeighted;
const total = xgA + xgB;

const pNoGoal = Math.exp(-total);
const pGoal   = 1 - pNoGoal;
const pA      = (xgA / total) * pGoal;
const pB      = (xgB / total) * pGoal;

console.log(`\n=== SIGUIENTE GOL · Minuto ${minuteNow}' ===`);
console.log(`xG partido completo  : USA ${fullXgA.toFixed(3)}  PAR ${fullXgB.toFixed(3)}`);
console.log(`Minutos restantes    : ${90 - minuteNow} min`);
console.log(`Fracción (lineal)    : ${(fracLinear*100).toFixed(1)}%`);
console.log(`Fracción (ponderada) : ${(fracWeighted*100).toFixed(1)}%  ← ajustado por frecuencia goleadora tardía`);
console.log(`xG restante          : USA ${xgA.toFixed(3)}  PAR ${xgB.toFixed(3)}`);
console.log('');
console.log(`P(USA anota primero) : ${(pA*100).toFixed(1)}%`);
console.log(`P(PAR anota primero) : ${(pB*100).toFixed(1)}%`);
console.log(`P(no más goles)      : ${(pNoGoal*100).toFixed(1)}%`);

// Scoring rate at current minute
const currentBlock = RATE_BLOCKS.find(b => minuteNow >= b.from && minuteNow <= b.to);
if (currentBlock) console.log(`\nIntensidad goleadora actual (min ${minuteNow}): ×${currentBlock.rate.toFixed(3)} vs promedio`);
