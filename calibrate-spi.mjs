#!/usr/bin/env node
// Calibrate separate attack & defense parameters via Dixon-Coles EM algorithm.
// Reference: Dixon & Coles (1997) — "Modelling Association Football Scores"
// Produces data/spi-ratings.json with alpha (attack) and beta (defense vulnerability).
//   alpha > 1 = above-average attack    beta > 1 = weak defense (concedes more)
//   alpha < 1 = weak attack             beta < 1 = strong defense (concedes less)
import { readFileSync, writeFileSync } from 'node:fs';

const BASE   = 1.35;
const CUTOFF = 3;
const ITERS  = 80;

// Competition-aware half-life (igual que calibrate.mjs)
function competitionHL(leagueName = '') {
  const n = (leagueName || '').toLowerCase();
  if (/world cup(?!.*qual)/.test(n) || /fifa world cup/.test(n)) return 30;
  if (/copa america|euro championship\b|african cup(?!.*qual)|asian cup/.test(n)) return 24;
  if (/nations league|nations cup/.test(n)) return 18;
  if (/friendl/.test(n)) return 6;
  return 12;
}

// Excluir competiciones regionales débiles que inflan ataque CAF/AFC
function isWeakCompetition(leagueName = '') {
  return /cecafa|cosafa|cfu|island games|aff championship|saff|uncaf/i.test(leagueName || '');
}

const now = Date.now() / 1000;
const decay = (ts, leagueName = '') => {
  const ageMonths = (now - ts) / (30.44 * 86400);
  if (ageMonths > CUTOFF * 12) return 0;
  return Math.pow(0.5, ageMonths / competitionHL(leagueName));
};

const { matches } = JSON.parse(readFileSync(new URL('./data/results-full.json', import.meta.url), 'utf8'));

// Filter: scored matches, dentro del cutoff, ambos equipos conocidos, sin competiciones débiles
const data = matches.filter(m =>
  m.hg != null && m.ag != null && m.homeSlug && m.awaySlug &&
  decay(m.ts, m.leagueName) > 0 && !isWeakCompetition(m.leagueName)
);
console.log(`SPI calibration: ${data.length} matches in last ${CUTOFF} years`);

// Collect all known team slugs
const teams = [...new Set(data.flatMap(m => [m.homeSlug, m.awaySlug]))];

// Initialize attack (alpha) and defense vulnerability (beta) to 1.0
const alpha = Object.fromEntries(teams.map(t => [t, 1.0]));
const beta  = Object.fromEntries(teams.map(t => [t, 1.0]));

// EM iterations
for (let iter = 0; iter < ITERS; iter++) {
  const aN = {}, aD = {}, bN = {}, bD = {};  // numerators / denominators

  for (const m of data) {
    const w  = decay(m.ts, m.leagueName);
    const ha = m.homeSlug, aw = m.awaySlug;
    const ah = alpha[ha] || 1, bh = beta[ha] || 1;
    const aa = alpha[aw] || 1, ba = beta[aw] || 1;

    // Home team attacks (alpha[ha]) vs away defense (beta[aw])
    aN[ha] = (aN[ha] || 0) + w * m.hg;
    aD[ha] = (aD[ha] || 0) + w * BASE * ba;

    // Away team attacks (alpha[aw]) vs home defense (beta[ha])
    aN[aw] = (aN[aw] || 0) + w * m.ag;
    aD[aw] = (aD[aw] || 0) + w * BASE * bh;

    // Home defense: goals conceded at home = away goals (m.ag)
    bN[ha] = (bN[ha] || 0) + w * m.ag;
    bD[ha] = (bD[ha] || 0) + w * BASE * aa;

    // Away defense: goals conceded away = home goals (m.hg)
    bN[aw] = (bN[aw] || 0) + w * m.hg;
    bD[aw] = (bD[aw] || 0) + w * BASE * ah;
  }

  for (const t of teams) {
    if (aN[t] && aD[t]) alpha[t] = aN[t] / aD[t];
    if (bN[t] && bD[t]) beta[t]  = bN[t] / bD[t];
  }

  // Normalize: keep mean(alpha) = 1 and mean(beta) = 1
  const mA = teams.reduce((s,t) => s + alpha[t], 0) / teams.length;
  const mB = teams.reduce((s,t) => s + beta[t],  0) / teams.length;
  teams.forEach(t => { alpha[t] /= mA; beta[t] /= mB; });
}

// Build output — only include teams in SEED (the 63 teams we care about)
const SEED_TEAMS = [
  'argentina','france','spain','brazil','england','portugal','netherlands','germany','belgium',
  'italy','colombia','uruguay','croatia','morocco','switzerland','usa','mexico','japan','senegal',
  'denmark','ecuador','australia','south-korea','iran','poland','canada','serbia','wales','ghana',
  'tunisia','ivory-coast','nigeria','saudi-arabia','qatar','egypt','algeria','scotland','cameroon',
  'paraguay','venezuela','chile','peru','czech-republic','bosnia-and-herzegovina','south-africa',
  'new-zealand','panama','jamaica','honduras','jordan','haiti','el-salvador','trinidad-and-tobago',
  'guatemala','norway','sweden','austria','turkey','uzbekistan','iraq','dr-congo','cape-verde','curacao'
];

const ratings = {};
for (const t of SEED_TEAMS) {
  ratings[t] = {
    attack: parseFloat((alpha[t] || 1).toFixed(4)),
    defense: parseFloat((beta[t]  || 1).toFixed(4)),
    // xG against average opponent at neutral venue:
    xg_for:     parseFloat((BASE * (alpha[t] || 1)).toFixed(3)),
    xg_against: parseFloat((BASE * (beta[t]  || 1)).toFixed(3)),
  };
}

writeFileSync(new URL('./data/spi-ratings.json', import.meta.url), JSON.stringify({ calibratedAt: new Date().toISOString(), base: BASE, matchesUsed: data.length, ratings }, null, 2) + '\n');

// Print top 10 attack + top 10 defense
const sortedAtk = SEED_TEAMS.filter(t=>ratings[t]).sort((a,b) => ratings[b].attack - ratings[a].attack);
const sortedDef = SEED_TEAMS.filter(t=>ratings[t]).sort((a,b) => ratings[a].defense - ratings[b].defense);
console.log('\nTop 10 ATAQUE:');
sortedAtk.slice(0,10).forEach((t,i) => console.log(`  ${i+1}. ${t.padEnd(20)} α=${ratings[t].attack}  xG_scored=${ratings[t].xg_for}`));
console.log('\nTop 10 DEFENSA (menor beta = mejor):');
sortedDef.slice(0,10).forEach((t,i) => console.log(`  ${i+1}. ${t.padEnd(20)} β=${ratings[t].defense}  xG_conceded=${ratings[t].xg_against}`));
console.log(`\nUSA     → ataque=${ratings.usa?.attack}  defensa=${ratings.usa?.defense}`);
console.log(`Paraguay → ataque=${ratings.paraguay?.attack}  defensa=${ratings.paraguay?.defense}`);
