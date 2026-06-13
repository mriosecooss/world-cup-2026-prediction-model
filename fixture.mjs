#!/usr/bin/env node
// Calendario WC2026 con predicción del modelo para los próximos partidos.
//   node fixture.mjs                 próximos 8 partidos sin jugar (con predicción)
//   node fixture.mjs --next=12       próximos 12
//   node fixture.mjs --group=C       todos los del grupo C (jugados + por jugar)
//   node fixture.mjs --all           fase de grupos completa
//   node fixture.mjs --live          usa elo-live.json (ratings actualizados con resultados)
import { readFileSync, existsSync } from 'node:fs';
import { matchProb, matchProbSPI, matchProbBlended } from './elo.mjs';
import { SLUG_TO_NAME, HOST, HOME_ADV } from './constants.mjs';
import { venueGoalMult, venueInfo } from './context.mjs';

const SPI_WEIGHT = 0.65;
const D = (f) => new URL(`./data/${f}`, import.meta.url);
const { ratings: eloFrozen } = JSON.parse(readFileSync(D('elo-calibrated.json'), 'utf8'));
const { ratings: spiR } = JSON.parse(readFileSync(D('spi-ratings.json'), 'utf8'));
const { matches: fixture } = JSON.parse(readFileSync(D('fixture-wc2026.json'), 'utf8'));
const { matches: played } = JSON.parse(readFileSync(D('wc2026-results.json'), 'utf8'));

const flags = process.argv.slice(2).filter(a => a.startsWith('--'));
const getFlag = (n) => { const f = flags.find(f => f.startsWith(`--${n}=`)); return f ? f.split('=')[1] : null; };
const hasFlag = (n) => flags.includes(`--${n}`);

const eloLiveFile = D('elo-live.json');
const eloR = hasFlag('live') && existsSync(eloLiveFile)
  ? JSON.parse(readFileSync(eloLiveFile, 'utf8')).ratings : eloFrozen;

// Set de partidos ya jugados (por par de slugs, sin importar orden)
const playedSet = new Set(played.map(m => [m.t1, m.t2].sort().join('|')));
const isPlayed = (m) => playedSet.has([m.t1, m.t2].sort().join('|'));
const resultOf = (m) => played.find(p => [p.t1, p.t2].sort().join('|') === [m.t1, m.t2].sort().join('|'));

// Solo partidos con equipos definidos (fase de grupos)
const groupMatches = fixture.filter(m => m.stage === 'group');

function predict(m) {
  const a = m.t1, b = m.t2;
  if (!eloR[a] || !eloR[b]) return null;
  const hb = (HOST.has(a) ? HOME_ADV : 0) - (HOST.has(b) ? HOME_ADV : 0);
  const ctx = m.venue ? venueGoalMult(m.venue) : 1.0;
  const elo = matchProb(eloR[a], eloR[b], hb);
  let r = elo;
  if (spiR[a] && spiR[b]) {
    const sA = spiR[a], sB = spiR[b];
    const spi = matchProbSPI(sA.attack, sB.defense, sB.attack, sA.defense, hb, ctx);
    r = matchProbBlended(elo, spi, SPI_WEIGHT);
  }
  return r;
}

const name = (s) => SLUG_TO_NAME[s] ?? s;
const pct = (x) => (x * 100).toFixed(0).padStart(3) + '%';

function printMatch(m) {
  const v = m.venue ? venueInfo(m.venue) : null;
  const venueStr = v ? `${v.city}${v.goalMult > 1 ? ` (alt ${v.altitudeM}m ×${v.goalMult})` : ''}` : '';
  const head = `  #${String(m.num).padStart(2)} ${m.date}  G${m.group}  ${name(m.t1)} vs ${name(m.t2)}`;
  if (isPlayed(m)) {
    const r = resultOf(m);
    console.log(`${head.padEnd(52)}  → FT ${r.g1}-${r.g2}`);
    return;
  }
  const p = predict(m);
  if (!p) { console.log(`${head.padEnd(52)}  (sin ratings)`); return; }
  const fav = p.winA >= p.winB ? name(m.t1) : name(m.t2);
  console.log(`${head.padEnd(52)}  ${pct(p.winA)}/${pct(p.draw)}/${pct(p.winB)}  ${venueStr}`);
}

// --- Modos ---
const group = getFlag('group');
if (group) {
  const g = group.toUpperCase();
  console.log(`\n=== Grupo ${g} ===`);
  groupMatches.filter(m => m.group === g).forEach(printMatch);
} else if (hasFlag('all')) {
  console.log(`\n=== Fase de grupos completa ===`);
  groupMatches.forEach(printMatch);
} else {
  const n = parseInt(getFlag('next') || '8');
  const upcoming = groupMatches.filter(m => !isPlayed(m)).slice(0, n);
  console.log(`\n=== Próximos ${upcoming.length} partidos (gana1/empate/gana2) ===`);
  upcoming.forEach(printMatch);
  console.log(`\n  ${played.length} partidos jugados · ${groupMatches.length - played.length} por jugar en fase de grupos`);
}
console.log('');
