#!/usr/bin/env node
// Mercado "siguiente gol" vía procesos de Poisson en competencia.
// v3: CLI genérico + xG del modelo blended Elo+SPI 0.65 (consistente con predict.mjs).
//   node nextgoal.mjs <equipo1> <equipo2> <minuto>
//   node nextgoal.mjs usa paraguay 64
//   node nextgoal.mjs brazil morocco 70 --xg=1.5,1.2   (override manual de xG full)
import { readFileSync } from 'node:fs';
import { matchProb, matchProbSPI, matchProbBlended } from './elo.mjs';
import { SLUG_TO_NAME, RATE_BLOCKS, rateIntegral } from './constants.mjs';

const SPI_WEIGHT = 0.65;
const FULL_WEIGHT = rateIntegral(0, 90); // = 90

const { ratings: eloR } = JSON.parse(readFileSync(new URL('./data/elo-calibrated.json', import.meta.url), 'utf8'));
const { ratings: spiR } = JSON.parse(readFileSync(new URL('./data/spi-ratings.json', import.meta.url), 'utf8'));

const argv  = process.argv.slice(2);
const args  = argv.filter(a => !a.startsWith('--'));
const flags = argv.filter(a => a.startsWith('--'));
const getFlag = (name) => { const f = flags.find(f => f.startsWith(`--${name}=`)); return f ? f.split('=')[1] : null; };

const [t1, t2, minStr] = args;
if (!t1 || !t2 || minStr == null) {
  console.log('Uso: node nextgoal.mjs <equipo1> <equipo2> <minuto> [--xg=full1,full2]');
  console.log('Ej:  node nextgoal.mjs usa paraguay 64');
  process.exit(0);
}
const minuteNow = parseInt(minStr);
if (isNaN(minuteNow) || minuteNow < 0 || minuteNow > 90) { console.error('Minuto debe estar entre 0 y 90'); process.exit(1); }
if (!eloR[t1]) { console.error(`Equipo desconocido: '${t1}'`); process.exit(1); }
if (!eloR[t2]) { console.error(`Equipo desconocido: '${t2}'`); process.exit(1); }

// xG del partido completo — del modelo blended, o override manual
let fullXgA, fullXgB;
const xgOverride = getFlag('xg');
if (xgOverride) {
  [fullXgA, fullXgB] = xgOverride.split(',').map(Number);
} else {
  const eloResult = matchProb(eloR[t1], eloR[t2], 0);
  let blended = eloResult;
  if (spiR[t1] && spiR[t2]) {
    const sA = spiR[t1], sB = spiR[t2];
    const spiResult = matchProbSPI(sA.attack, sB.defense, sB.attack, sA.defense, 0, 1.0);
    blended = matchProbBlended(eloResult, spiResult, SPI_WEIGHT);
  }
  fullXgA = blended.expectedGoalsA;
  fullXgB = blended.expectedGoalsB;
}

const fracLinear   = (90 - minuteNow) / 90;
const fracWeighted = rateIntegral(minuteNow, 90) / FULL_WEIGHT;

const xgA = fullXgA * fracWeighted;
const xgB = fullXgB * fracWeighted;
const total = xgA + xgB;

const pNoGoal = Math.exp(-total);
const pGoal   = 1 - pNoGoal;
const pA      = total > 0 ? (xgA / total) * pGoal : 0;
const pB      = total > 0 ? (xgB / total) * pGoal : 0;

const n1 = SLUG_TO_NAME[t1] ?? t1.toUpperCase();
const n2 = SLUG_TO_NAME[t2] ?? t2.toUpperCase();

console.log(`\n=== SIGUIENTE GOL · ${n1} vs ${n2} · Minuto ${minuteNow}' ===`);
console.log(`xG partido completo  : ${n1} ${fullXgA.toFixed(3)}  ${n2} ${fullXgB.toFixed(3)}`);
console.log(`Minutos restantes    : ${90 - minuteNow} min`);
console.log(`Fracción (lineal)    : ${(fracLinear * 100).toFixed(1)}%`);
console.log(`Fracción (ponderada) : ${(fracWeighted * 100).toFixed(1)}%  ← ajustado por frecuencia goleadora tardía`);
console.log(`xG restante          : ${n1} ${xgA.toFixed(3)}  ${n2} ${xgB.toFixed(3)}`);
console.log('');
console.log(`P(${n1} anota primero) : ${(pA * 100).toFixed(1)}%`);
console.log(`P(${n2} anota primero) : ${(pB * 100).toFixed(1)}%`);
console.log(`P(no más goles)      : ${(pNoGoal * 100).toFixed(1)}%`);

const currentBlock = RATE_BLOCKS.find(b => minuteNow >= b.from && minuteNow <= b.to);
if (currentBlock) console.log(`\nIntensidad goleadora actual (min ${minuteNow}): ×${currentBlock.rate.toFixed(3)} vs promedio`);
