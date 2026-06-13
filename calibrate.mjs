#!/usr/bin/env node
// Calibrate Elo ratings on real recent internationals → data/elo-calibrated.json.
// v2: uses 25k+ match dataset, 12-month half-life time-decay, 5-year hard cutoff.
//   node calibrate.mjs [--source full]   (default: full dataset)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const D = (f) => new URL(`./data/${f}`, import.meta.url);
const useFullDataset = !process.argv.includes('--source=original');

// Long-run strength priors (Elo anchors).
const SEED = {
  argentina:2085,france:2065,spain:2055,brazil:2045,england:2000,portugal:1980,netherlands:1965,germany:1945,belgium:1925,italy:1915,colombia:1890,uruguay:1875,croatia:1870,morocco:1840,switzerland:1825,usa:1830,mexico:1825,japan:1810,senegal:1795,denmark:1790,ecuador:1760,australia:1735,"south-korea":1730,iran:1720,poland:1715,canada:1700,serbia:1695,wales:1665,ghana:1665,tunisia:1655,"ivory-coast":1655,nigeria:1645,"saudi-arabia":1640,qatar:1630,egypt:1620,algeria:1615,scotland:1610,cameroon:1600,paraguay:1595,venezuela:1590,chile:1580,peru:1575,"czech-republic":1570,"bosnia-and-herzegovina":1545,"south-africa":1520,"new-zealand":1495,panama:1480,jamaica:1460,honduras:1440,jordan:1420,haiti:1380,"el-salvador":1370,"trinidad-and-tobago":1360,guatemala:1345,norway:1850,sweden:1780,austria:1740,turkey:1730,uzbekistan:1690,iraq:1680,"dr-congo":1670,"cape-verde":1640,curacao:1560
};
const HOST = new Set(["mexico", "usa", "canada"]);
const HOME_ADV = 75;

// K-factor by competition importance.
function baseK(leagueName = "") {
  const n = leagueName.toLowerCase();
  if (/world cup(?!.*qual)/.test(n) || /fifa world cup/.test(n)) return 60;
  if (/world cup.*qual|qualification/.test(n)) return 42;
  if (/copa america|euro championship\b|african cup|asian cup|gold cup|afcon/.test(n)) return 52;
  if (/nations league|nations cup/.test(n)) return 34;
  if (/friendl/.test(n)) return 16;
  return 28;
}

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
const gMult = (gd) => { const d = Math.abs(gd); return d <= 1 ? 1 : d === 2 ? 1.5 : (11 + d) / 8; };

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
