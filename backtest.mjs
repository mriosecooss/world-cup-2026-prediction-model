#!/usr/bin/env node
// Walk-forward, OUT-OF-SAMPLE backtest del modelo en partidos internacionales reales.
// Cada partido se predice con ratings construidos SOLO con partidos anteriores — sin look-ahead.
// Compara dos modelos en paralelo:
//   - 2-WAY: Elo 35% + SPI 65% (baseline anterior)
//   - 3-WAY: Elo 25% + SPI 45% + Pi 30% (modelo actual con pi-rating walk-forward)
//   node backtest.mjs
import { readFileSync } from "node:fs";
import { matchProb, matchProbSPI, matchProbBlended, matchProbBlended3, expectedScore } from "./elo.mjs";
import { HOME_ADV, baseK, gMult, writeStableJSON } from "./constants.mjs";

const D = (f) => new URL(`./data/${f}`, import.meta.url);
const { ratings: spiR } = JSON.parse(readFileSync(D("spi-ratings.json"), "utf8"));
const { seed: SEED }    = JSON.parse(readFileSync(D("seed-ratings.json"), "utf8"));

const SPI_WEIGHT_2WAY = 0.65;
const BURN_IN = 150;

// Pi-rating: constantes idénticas a calibrate-pi.mjs
const G_SCALE_PI = 1.3;
const K_SCALE_PI = 1.5;
const piOutcome  = (gA, gB) => 1 / (1 + Math.pow(10, -(gA - gB) / G_SCALE_PI));
const piExpected = (rA, rB, hb) => 1 / (1 + Math.pow(10, (rB - (rA + hb)) / 400));

const { matches } = JSON.parse(readFileSync(D("results.json"), "utf8"));

// Estado Elo (walk-forward)
const R = {};
const getR  = (s, nm) => { const k = s ?? `ghost:${nm}`; if (R[k] == null) R[k] = s && SEED[s] != null ? SEED[s] : 1500; return R[k]; };
const setR  = (s, nm, v) => { R[s ?? `ghost:${nm}`] = v; };

// Estado Pi-rating (walk-forward paralelo)
const Pi = {};
const getPi = (s, nm) => { const k = s ?? `ghost:${nm}`; if (Pi[k] == null) Pi[k] = s && SEED[s] != null ? SEED[s] : 1500; return Pi[k]; };
const setPi = (s, nm, v) => { Pi[s ?? `ghost:${nm}`] = v; };

// Acumuladores para 2-way y 3-way por separado
const m2 = { n:0, hit:0, brier:0, logloss:0, rps:0, favN:0, favHit:0 };
const m3 = { n:0, hit:0, brier:0, logloss:0, rps:0, favN:0, favHit:0 };
let rpsU = 0, eH = 0, eD = 0, eA = 0, baseHome = 0, baseElo = 0, i = 0;

const rps3 = (p, y) => 0.5 * ((p[0]-y[0])**2 + (p[0]+p[1]-y[0]-y[1])**2);

const BINS = 10;
const calib2 = Array.from({ length: BINS }, () => ({ sumP:0, sumY:0, n:0 }));
const calib3 = Array.from({ length: BINS }, () => ({ sumP:0, sumY:0, n:0 }));

const score_match = (acc, calib, probs, actual, y) => {
  const pred = probs.indexOf(Math.max(...probs));
  if (pred === actual) acc.hit++;
  acc.brier   += (probs[0]-y[0])**2 + (probs[1]-y[1])**2 + (probs[2]-y[2])**2;
  acc.logloss += -Math.log(Math.max(1e-12, probs[actual]));
  acc.rps     += rps3(probs, y);
  if (Math.max(...probs) >= 0.5) { acc.favN++; if (pred === actual) acc.favHit++; }
  for (let k = 0; k < 3; k++) {
    const b = Math.min(BINS-1, Math.floor(probs[k]*BINS));
    calib[b].sumP += probs[k]; calib[b].sumY += y[k]; calib[b].n++;
  }
  acc.n++;
};

for (const m of matches) {
  if (m.hg == null || m.ag == null) continue;
  const ra   = getR(m.homeSlug,  m.homeName);
  const rb   = getR(m.awaySlug,  m.awayName);
  const piA  = getPi(m.homeSlug, m.homeName);
  const piB  = getPi(m.awaySlug, m.awayName);

  if (i >= BURN_IN) {
    const actual = m.hg > m.ag ? 0 : m.hg < m.ag ? 2 : 1;
    const y = [actual===0?1:0, actual===1?1:0, actual===2?1:0];

    // 2-way blend (Elo + SPI)
    let p2;
    if (spiR[m.homeSlug] && spiR[m.awaySlug]) {
      const sA = spiR[m.homeSlug], sB = spiR[m.awaySlug];
      const eloResult = matchProb(ra, rb, HOME_ADV);
      const spiResult = matchProbSPI(sA.attack, sB.defense, sB.attack, sA.defense, HOME_ADV, 1.0);
      p2 = matchProbBlended(eloResult, spiResult, SPI_WEIGHT_2WAY);
    } else {
      p2 = matchProb(ra, rb, HOME_ADV);
    }

    // 3-way blend (Elo + SPI + Pi)
    let p3;
    if (spiR[m.homeSlug] && spiR[m.awaySlug]) {
      const sA = spiR[m.homeSlug], sB = spiR[m.awaySlug];
      const eloResult = matchProb(ra, rb, HOME_ADV);
      const spiResult = matchProbSPI(sA.attack, sB.defense, sB.attack, sA.defense, HOME_ADV, 1.0);
      const piResult  = matchProb(piA, piB, HOME_ADV);
      p3 = matchProbBlended3(eloResult, spiResult, piResult);
    } else {
      p3 = matchProb(ra, rb, HOME_ADV);
    }

    score_match(m2, calib2, [p2.winA, p2.draw, p2.winB], actual, y);
    score_match(m3, calib3, [p3.winA, p3.draw, p3.winB], actual, y);

    rpsU    += rps3([1/3, 1/3, 1/3], y);
    if (actual === 0) eH++; else if (actual === 1) eD++; else eA++;
    if (actual === 0) baseHome++;
    if ((expectedScore(ra, rb, HOME_ADV) >= 0.5 ? 0 : 2) === actual) baseElo++;
  }

  // Actualizar Elo (walk-forward)
  const exp   = expectedScore(ra, rb, HOME_ADV);
  const score = m.hg > m.ag ? 1 : m.hg < m.ag ? 0 : 0.5;
  const delta = baseK(m.leagueName) * gMult(m.hg - m.ag) * (score - exp);
  setR(m.homeSlug, m.homeName, ra + delta);
  setR(m.awaySlug, m.awayName, rb - delta);

  // Actualizar Pi-rating (walk-forward, misma lógica que calibrate-pi.mjs)
  const piE  = piExpected(piA, piB, HOME_ADV);
  const piO  = piOutcome(m.hg, m.ag);
  const piK  = baseK(m.leagueName) * K_SCALE_PI;
  setPi(m.homeSlug, m.homeName, piA + piK * (piO - piE));
  setPi(m.awaySlug, m.awayName, piB - piK * (piO - piE));

  i++;
}

const n = m2.n;
const pct = (x) => (x * 100).toFixed(1) + "%";
const ece = (calib) => calib.reduce((s,b) => s + (b.n ? Math.abs(b.sumP/b.n - b.sumY/b.n)*b.n : 0), 0) / (3*n);

console.log(`\n=== Walk-forward backtest — ${n} partidos evaluados (burn-in ${BURN_IN}) ===`);
console.log(`Distribución: home ${pct(eH/n)}  empate ${pct(eD/n)}  away ${pct(eA/n)}\n`);

const printModel = (label, acc, calib) => {
  const e = ece(calib);
  console.log(`${label}`);
  console.log(`  Accuracy (pick top):   ${pct(acc.hit/n)}`);
  console.log(`  Favourite acc (p≥50%): ${pct(acc.favHit/acc.favN)}  (${acc.favN} partidos)`);
  console.log(`  Brier (3-way, ↓):      ${(acc.brier/n).toFixed(3)}`);
  console.log(`  Log-loss (↓):          ${(acc.logloss/n).toFixed(3)}`);
  console.log(`  RPS (↓):               ${(acc.rps/n).toFixed(4)}`);
  console.log(`  ECE (calibración, ↓):  ${(e*100).toFixed(1)}%\n`);
};

printModel('MODELO 2-WAY (Elo 35% + SPI 65%) — baseline', m2, calib2);
printModel('MODELO 3-WAY (Elo 25% + SPI 45% + Pi 30%) — nuevo', m3, calib3);

const rps2 = (m2.rps/n).toFixed(4), rps3v = (m3.rps/n).toFixed(4);
const rpsDiff = ((m2.rps - m3.rps)/n * 10000).toFixed(1);
console.log(`RPS delta (2-way → 3-way): ${rpsDiff > 0 ? '-' : '+'}${Math.abs(rpsDiff)}bp ${rpsDiff > 0 ? '✓ mejora' : '✗ peor'}\n`);

console.log(`BASELINES`);
console.log(`  Siempre home:          ${pct(baseHome/n)}`);
console.log(`  Pick higher-Elo:       ${pct(baseElo/n)}`);
console.log(`  Uniforme (1/3):        Brier ${(2*(1/3)**2+(1-1/3)**2).toFixed(3)}  RPS ${(rpsU/n).toFixed(4)}\n`);

console.log(`CALIBRACIÓN 3-WAY (predicho vs observado por banda)`);
for (const [k, b] of calib3.entries()) {
  if (!b.n) continue;
  console.log(`  ${String(k*10).padStart(2)}–${String((k+1)*10).padStart(3)}%   modelo ${(b.sumP/b.n*100).toFixed(0).padStart(3)}%  →  real ${(b.sumY/b.n*100).toFixed(0).padStart(3)}%   (n=${b.n})`);
}

const ece2 = ece(calib2), ece3 = ece(calib3);
writeStableJSON(new URL("./data/model-backtest.json", import.meta.url), {
  generatedAt:   new Date().toISOString(),
  method:        `Walk-forward out-of-sample. 2-way: Elo+SPI (spiW=${SPI_WEIGHT_2WAY}). 3-way: Elo+SPI+Pi (0.25/0.45/0.30). Burn-in ${BURN_IN}.`,
  totalMatches:  matches.length,
  evaluated:     n,
  burnIn:        BURN_IN,
  outcomeSplit:  { home: +(eH/n).toFixed(4), draw: +(eD/n).toFixed(4), away: +(eA/n).toFixed(4) },
  model_2way:    { accuracy: +(m2.hit/n).toFixed(4), brier: +(m2.brier/n).toFixed(4), logloss: +(m2.logloss/n).toFixed(4), rps: +(m2.rps/n).toFixed(4), ece: +ece2.toFixed(4), favouriteAccuracy: +(m2.favHit/m2.favN).toFixed(4) },
  model_3way:    { accuracy: +(m3.hit/n).toFixed(4), brier: +(m3.brier/n).toFixed(4), logloss: +(m3.logloss/n).toFixed(4), rps: +(m3.rps/n).toFixed(4), ece: +ece3.toFixed(4), favouriteAccuracy: +(m3.favHit/m3.favN).toFixed(4) },
  rps_delta_bp:  +rpsDiff,
  baselines:     { alwaysHome: +(baseHome/n).toFixed(4), eloPickNoDraw: +(baseElo/n).toFixed(4), uniformRps: +(rpsU/n).toFixed(4) },
});
console.log(`\n→ data/model-backtest.json actualizado`);
