#!/usr/bin/env node
// Walk-forward, OUT-OF-SAMPLE backtest of the model on real internationals (data/results.json).
// Each match is predicted from ratings built ONLY on prior matches, then scored — no look-ahead.
//   node backtest.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { matchProb, matchProbSPI, matchProbBlended, expectedScore } from "./elo.mjs";
import { HOME_ADV, baseK, gMult } from "./constants.mjs";

const D = (f) => new URL(`./data/${f}`, import.meta.url);
const { ratings: spiR } = JSON.parse(readFileSync(D("spi-ratings.json"), "utf8"));
const SPI_WEIGHT = 0.65; // optimizado via calibrate-blend.mjs (grid search RPS, conservador vs 1.00 puro)
const { seed: SEED } = JSON.parse(readFileSync(D("seed-ratings.json"), "utf8"));
const BURN_IN = 150; // HOME_ADV, baseK, gMult en constants.mjs

const { matches } = JSON.parse(readFileSync(D("results.json"), "utf8"));
const R = {};
const getR = (s, nm) => { const k = s ?? `ghost:${nm}`; if (R[k] == null) R[k] = s && SEED[s] != null ? SEED[s] : 1500; return R[k]; };
const setR = (s, nm, v) => { R[s ?? `ghost:${nm}`] = v; };

let n = 0, hit = 0, brier = 0, logloss = 0, favN = 0, favHit = 0, baseHome = 0, baseElo = 0, i = 0;
let eH = 0, eD = 0, eA = 0;
// RPS (Ranked Probability Score) — the standard proper scoring rule for ORDERED 1X2 outcomes:
// 0.5 * [ (P(home)−Y(home))² + (P(home+draw)−Y(home+draw))² ]. Lower = better.
let rps = 0, rpsU = 0;
const rps3 = (p, y) => 0.5 * ((p[0] - y[0]) ** 2 + (p[0] + p[1] - y[0] - y[1]) ** 2);
// Calibration: pool every (predicted prob, outcome) pair across all 3 outcomes into 10 bins
// → reliability curve + Expected Calibration Error.
const BINS = 10;
const calib = Array.from({ length: BINS }, () => ({ sumP: 0, sumY: 0, n: 0 }));
for (const m of matches) {
  if (m.hg == null || m.ag == null) continue;
  const ra = getR(m.homeSlug, m.homeName), rb = getR(m.awaySlug, m.awayName);
  if (i >= BURN_IN) {
    let p;
    if (spiR[m.homeSlug] && spiR[m.awaySlug]) {
      const sA = spiR[m.homeSlug], sB = spiR[m.awaySlug];
      const eloResult = matchProb(ra, rb, HOME_ADV);
      const spiResult = matchProbSPI(sA.attack, sB.defense, sB.attack, sA.defense, HOME_ADV, 1.0);
      p = matchProbBlended(eloResult, spiResult, SPI_WEIGHT);
    } else {
      p = matchProb(ra, rb, HOME_ADV);
    }
    const probs = [p.winA, p.draw, p.winB];
    const actual = m.hg > m.ag ? 0 : m.hg < m.ag ? 2 : 1;
    const y = [actual === 0 ? 1 : 0, actual === 1 ? 1 : 0, actual === 2 ? 1 : 0];
    const pred = probs.indexOf(Math.max(...probs));
    if (pred === actual) hit++;
    brier += (probs[0]-y[0])**2 + (probs[1]-y[1])**2 + (probs[2]-y[2])**2;
    logloss += -Math.log(Math.max(1e-12, probs[actual]));
    rps += rps3(probs, y); rpsU += rps3([1/3, 1/3, 1/3], y);
    for (let k = 0; k < 3; k++) {
      const b = Math.min(BINS - 1, Math.floor(probs[k] * BINS));
      calib[b].sumP += probs[k]; calib[b].sumY += y[k]; calib[b].n++;
    }
    if (Math.max(...probs) >= 0.5) { favN++; if (pred === actual) favHit++; }
    if (actual === 0) baseHome++;
    if ((expectedScore(ra, rb, HOME_ADV) >= 0.5 ? 0 : 2) === actual) baseElo++;
    if (actual === 0) eH++; else if (actual === 1) eD++; else eA++;
    n++;
  }
  const exp = expectedScore(ra, rb, HOME_ADV);
  const score = m.hg > m.ag ? 1 : m.hg < m.ag ? 0 : 0.5;
  const delta = baseK(m.leagueName) * gMult(m.hg - m.ag) * (score - exp);
  setR(m.homeSlug, m.homeName, ra + delta);
  setR(m.awaySlug, m.awayName, rb - delta);
  i++;
}

const pct = (x) => (x * 100).toFixed(1) + "%";
console.log(`\n=== Walk-forward backtest — ${n} of ${matches.length} matches (burn-in ${BURN_IN}) ===`);
console.log(`Eval outcome split: home ${pct(eH/n)}  draw ${pct(eD/n)}  away ${pct(eA/n)}\n`);
console.log(`MODEL`);
console.log(`  Accuracy (top pick):   ${pct(hit/n)}`);
console.log(`  Favourite acc (p≥50%): ${pct(favHit/favN)}  (${favN} matches)`);
console.log(`  Brier (3-way, ↓):      ${(brier/n).toFixed(3)}`);
console.log(`  Log-loss (↓):          ${(logloss/n).toFixed(3)}`);
console.log(`  RPS (↓):               ${(rps/n).toFixed(4)}`);
const ece = calib.reduce((s, b) => s + (b.n ? Math.abs(b.sumP / b.n - b.sumY / b.n) * b.n : 0), 0) / (3 * n);
console.log(`  ECE (calibration, ↓):  ${(ece * 100).toFixed(1)}%\n`);
console.log(`BASELINES (same matches)`);
console.log(`  Always pick home:      ${pct(baseHome/n)}`);
console.log(`  Pick higher-Elo team:  ${pct(baseElo/n)}`);
console.log(`  Coin-flip (uniform):   Brier ${(2*(1/3)**2+(1-1/3)**2).toFixed(3)} · log-loss ${(-Math.log(1/3)).toFixed(3)} · RPS ${(rpsU/n).toFixed(4)}\n`);
console.log(`CALIBRATION (reliability — predicted vs observed per probability band)`);
for (const [k, b] of calib.entries()) {
  if (!b.n) continue;
  console.log(`  ${String(k*10).padStart(2)}–${String((k+1)*10).padStart(3)}%   model said ${(b.sumP/b.n*100).toFixed(0).padStart(3)}%  →  happened ${(b.sumY/b.n*100).toFixed(0).padStart(3)}%   (n=${b.n})`);
}
console.log(`\nLive title odds (full 50k-sim tournament model, conditioned on real results): https://cup26matches.com`);

// Persist the metrics so data/model-backtest.json always matches a fresh `node backtest.mjs` run.
writeFileSync(new URL("./data/model-backtest.json", import.meta.url), JSON.stringify({
  generatedAt: new Date().toISOString(),
  method: `Walk-forward out-of-sample: blended Elo+SPI (spiWeight=${SPI_WEIGHT}); Elo updates walk-forward, SPI static. Burn-in ${BURN_IN} skipped.`,
  totalMatches: matches.length, evaluated: n, burnIn: BURN_IN,
  outcomeSplit: { home: +(eH/n).toFixed(4), draw: +(eD/n).toFixed(4), away: +(eA/n).toFixed(4) },
  model: { accuracy: +(hit/n).toFixed(4), brier: +(brier/n).toFixed(4), logloss: +(logloss/n).toFixed(4),
           rps: +(rps/n).toFixed(4), ece: +ece.toFixed(4), favouriteAccuracy: +(favHit/favN).toFixed(4), favouriteCount: favN },
  baselines: { alwaysHome: +(baseHome/n).toFixed(4), eloPickNoDraw: +(baseElo/n).toFixed(4),
               uniformBrier: 0.6667, uniformLogloss: 1.0986, uniformRps: +(rpsU/n).toFixed(4) },
  calibration: { bins: calib.map((c,k)=>({ range:[k/10,(k+1)/10], n:c.n,
    avgPred: c.n? +(c.sumP/c.n).toFixed(4):null, obsFreq: c.n? +(c.sumY/c.n).toFixed(4):null })),
    ece: +ece.toFixed(4) },
}, null, 2) + "\n");
console.log("→ wrote data/model-backtest.json");
