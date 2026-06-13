#!/usr/bin/env node
// Calibrate Elo ratings on real recent internationals → data/elo-calibrated.json.
// v2: uses 25k+ match dataset, 12-month half-life time-decay, 5-year hard cutoff.
//   node calibrate.mjs [--source full]   (default: full dataset)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { HOST, HOME_ADV, baseK, gMult } from "./constants.mjs";

const D = (f) => new URL(`./data/${f}`, import.meta.url);
const useFullDataset = !process.argv.includes('--source=original');

// Long-run strength priors (Elo anchors) — fuente única en data/seed-ratings.json
const { seed: SEED } = JSON.parse(readFileSync(D("seed-ratings.json"), "utf8"));

// HOST, HOME_ADV, baseK y gMult en constants.mjs (fuente única)

// v3: competition-aware half-life — major tournaments decay slower, friendlies faster.
// WC2022 at ~3.5 years: weight 0.5^(42/30)=0.38 (was 0.09 with uniform 12-month HL).
const MAX_AGE_YEARS = 5;
function competitionHL(leagueName = "") {
  const n = leagueName.toLowerCase();
  if (/world cup(?!.*qual)/.test(n) || /fifa world cup/.test(n)) return 30;
  if (/copa america|euro championship\b|african cup(?!.*qual)|asian cup/.test(n)) return 24;
  if (/nations league|nations cup/.test(n)) return 18;
  if (/friendl/.test(n)) return 6;
  return 12;
}
const recency = (tsSec, nowSec, leagueName = "") => {
  const ageMonths = (nowSec - tsSec) / (30.44 * 86400);
  if (ageMonths > MAX_AGE_YEARS * 12) return 0;
  return Math.pow(0.5, ageMonths / competitionHL(leagueName));
};

const expectedScore = (a, b, hb) => 1 / (1 + Math.pow(10, (b - (a + hb)) / 400));

// Load dataset: prefer full (25k) over original (913).
const srcFile = useFullDataset && existsSync(new URL('./data/results-full.json', import.meta.url))
  ? 'results-full.json' : 'results.json';
const { matches } = JSON.parse(readFileSync(D(srcFile), "utf8"));
const nowSec = Math.floor(Date.now() / 1000);

console.log(`Using: ${srcFile} (${matches.length} matches)`);
console.log(`Time-decay: competition-aware HL (WC:30m Cups:24m NL:18m Qual:12m Friendly:6m), ${MAX_AGE_YEARS}-yr cutoff`);

const R = {};
const getR = (slug, name) => { const k = slug ?? `ghost:${name}`; if (R[k] == null) R[k] = slug && SEED[slug] != null ? SEED[slug] : 1500; return R[k]; };
const setR = (slug, name, v) => { R[slug ?? `ghost:${name}`] = v; };

let applied = 0, skipped = 0;
for (const m of matches) {
  if (m.hg == null || m.ag == null) continue;
  const w = recency(m.ts, nowSec, m.leagueName);
  if (w === 0) { skipped++; continue; } // beyond hard cutoff

  const ra = getR(m.homeSlug, m.homeName), rb = getR(m.awaySlug, m.awayName);
  const homeBonus = HOST.has(m.homeSlug) ? HOME_ADV / 2 : 0;
  const exp = expectedScore(ra, rb, homeBonus);
  const score = m.hg > m.ag ? 1 : m.hg < m.ag ? 0 : 0.5;
  const k = baseK(m.leagueName) * w * gMult(m.hg - m.ag);
  const delta = k * (score - exp);
  setR(m.homeSlug, m.homeName, ra + delta);
  setR(m.awaySlug, m.awayName, rb - delta);
  applied++;
}

// 65% calibrated + 35% prior (slightly more trust in data vs original 70/30).
const ratings = {};
for (const slug of Object.keys(SEED)) ratings[slug] = Math.round(0.65 * (R[slug] ?? SEED[slug]) + 0.35 * SEED[slug]);

writeFileSync(D("elo-calibrated.json"), JSON.stringify({ matchesApplied: applied, skipped, source: srcFile, halfLifeMode: 'competition-aware', ratings }, null, 2) + "\n");
console.log(`Calibrated ${Object.keys(ratings).length} teams from ${applied} matches (${skipped} skipped as too old)`);
console.log(`USA: ${ratings['usa']}  Paraguay: ${ratings['paraguay']}`);
