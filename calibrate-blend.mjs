#!/usr/bin/env node
// Grid search for optimal SPI blend weight — minimizes RPS on walk-forward backtest.
// Elo updates walk-forward; SPI ratings are static (pre-computed).
// NOTE: static SPI introduces minor look-ahead bias — acceptable for weight optimization.
//   node calibrate-blend.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { matchProb, matchProbSPI, matchProbBlended, expectedScore } from "./elo.mjs";

const D = (f) => new URL(`./data/${f}`, import.meta.url);
const { seed: SEED } = JSON.parse(readFileSync(D("seed-ratings.json"), "utf8"));
const HOME_ADV = 75, BURN_IN = 150;
const baseK = (n = "") => { n = n.toLowerCase();
  if (/world cup(?!.*qual)/.test(n)) return 55;
  if (/world cup.*qual|qualification/.test(n)) return 40;
  if (/copa america|euro championship\b|asian cup|africa cup|gold cup/.test(n)) return 50;
  if (/nations league|nations cup/.test(n)) return 32;
  if (/friendl/.test(n)) return 18;
  return 28; };
const gMult = (gd) => { const d = Math.abs(gd); return d <= 1 ? 1 : d === 2 ? 1.5 : (11 + d) / 8; };
const rps3 = (p, y) => 0.5 * ((p[0] - y[0]) ** 2 + (p[0] + p[1] - y[0] - y[1]) ** 2);

const { matches } = JSON.parse(readFileSync(D("results.json"), "utf8"));
const { ratings: spiR } = JSON.parse(readFileSync(D("spi-ratings.json"), "utf8"));

function runBacktest(spiWeight) {
  const R = {};
  const getR = (s, nm) => { const k = s ?? `ghost:${nm}`; if (R[k] == null) R[k] = s && SEED[s] != null ? SEED[s] : 1500; return R[k]; };
  const setR = (s, nm, v) => { R[s ?? `ghost:${nm}`] = v; };
  let n = 0, hit = 0, rps = 0, i = 0;
  for (const m of matches) {
    if (m.hg == null || m.ag == null) continue;
    const ra = getR(m.homeSlug, m.homeName), rb = getR(m.awaySlug, m.awayName);
    if (i >= BURN_IN) {
      let p;
      if (spiWeight > 0 && spiR[m.homeSlug] && spiR[m.awaySlug]) {
        const sA = spiR[m.homeSlug], sB = spiR[m.awaySlug];
        const eloResult = matchProb(ra, rb, HOME_ADV);
        const spiResult = matchProbSPI(sA.attack, sB.defense, sB.attack, sA.defense, HOME_ADV, 1.0);
        p = matchProbBlended(eloResult, spiResult, spiWeight);
      } else {
        p = matchProb(ra, rb, HOME_ADV);
      }
      const probs = [p.winA, p.draw, p.winB];
      const actual = m.hg > m.ag ? 0 : m.hg < m.ag ? 2 : 1;
      const y = [actual === 0 ? 1 : 0, actual === 1 ? 1 : 0, actual === 2 ? 1 : 0];
      if (probs.indexOf(Math.max(...probs)) === actual) hit++;
      rps += rps3(probs, y);
      n++;
    }
    const exp = expectedScore(ra, rb, HOME_ADV);
    const score = m.hg > m.ag ? 1 : m.hg < m.ag ? 0 : 0.5;
    setR(m.homeSlug, m.homeName, ra + baseK(m.leagueName) * gMult(m.hg - m.ag) * (score - exp));
    setR(m.awaySlug, m.awayName, rb - baseK(m.leagueName) * gMult(m.hg - m.ag) * (score - exp));
    i++;
  }
  return { n, rps: rps / n, accuracy: hit / n };
}

const results = [];
for (let w = 0; w <= 1.001; w += 0.05) {
  const weight = Math.round(w * 100) / 100;
  results.push({ weight, ...runBacktest(weight) });
}

console.log('\n=== Grid search: peso optimo de SPI en el blend ===');
console.log('weight | RPS    | accuracy');
for (const r of results) {
  const mark = r.weight === 0.45 ? ' <- antes' : '';
  console.log(`  ${r.weight.toFixed(2)}  | ${r.rps.toFixed(4)} | ${(r.accuracy * 100).toFixed(1)}%${mark}`);
}

const best = results.reduce((a, b) => a.rps < b.rps ? a : b);
const prev = results.find(r => r.weight === 0.45);
console.log(`\nOptimo : weight=${best.weight.toFixed(2)}  RPS=${best.rps.toFixed(4)}  accuracy=${(best.accuracy * 100).toFixed(1)}%`);
console.log(`Antes  : weight=0.45  RPS=${prev?.rps.toFixed(4)}`);
console.log(`Mejora RPS: ${((prev?.rps - best.rps) * 10000).toFixed(1)} puntos base`);

writeFileSync(D("blend-search.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  optimalWeight: best.weight,
  previousWeight: 0.45,
  rpsImprovement: +((prev?.rps - best.rps).toFixed(6)),
  results: results.map(r => ({ weight: r.weight, rps: +r.rps.toFixed(6), accuracy: +r.accuracy.toFixed(4) })),
}, null, 2) + "\n");
console.log(`-> data/blend-search.json guardado`);
