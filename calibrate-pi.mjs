#!/usr/bin/env node
// Pi-rating: variante de Elo con outcome continuo basado en la diferencia de goles.
// Referencia: Constantinou & Fenton (2012) "Determining the level of ability of football
// teams by dynamic ratings based on the relative discrepancies in scores".
//
// Ventaja vs Elo puro: señal más granular — un 3-0 mueve más que un 1-0, pero con
// rendimientos decrecientes (sigmoid, no lineal como gMult). Un 5-0 no mueve mucho
// más que un 3-0, evitando distorsión por goleadas ante rivales débiles.
// Ventaja vs SPI: actualización online (secuencial), captura tendencias recientes
// sin requerir recalibración batch de todos los datos.
//
// Produce data/pi-ratings.json — usado por predict.mjs como 3er componente del blend.
import { readFileSync, existsSync } from 'node:fs';
import { HOST, HOME_ADV, baseK, writeStableJSON } from './constants.mjs';

const D     = (f) => new URL(`./data/${f}`, import.meta.url);
const { seed: SEED } = JSON.parse(readFileSync(D('seed-ratings.json'), 'utf8'));

// G_SCALE: cuántos goles de diferencia equivalen a una "victoria clara" en la sigmoid.
// 1.3 → 1 gol: O=0.854  |  2 goles: O=0.972  |  3 goles: O=0.995
// Constantinou usó 3 para football inglés; 1.3 es más ajustado para internacionales
// donde los márgenes grandes son menos frecuentes y más informativos.
const G_SCALE   = 1.3;

// K scale: las actualizaciones pi son ~60% del tamaño de Elo (sigmoid no llega a 1).
// Multiplicar por 1.5 mantiene los ratings en escala comparable al Elo calibrado.
const K_SCALE   = 1.5;

const MAX_AGE_YEARS = 5;

function competitionHL(leagueName = '') {
  const n = (leagueName || '').toLowerCase();
  if (/world cup(?!.*qual)/.test(n) || /fifa world cup/.test(n)) return 30;
  if (/copa america|euro championship\b|african cup(?!.*qual)|asian cup/.test(n)) return 24;
  if (/nations league|nations cup/.test(n)) return 18;
  if (/friendl/.test(n)) return 6;
  return 12;
}

function isWeakCompetition(leagueName = '') {
  return /cecafa|cosafa|cfu|island games|aff championship|saff|uncaf/i.test(leagueName || '');
}

const nowSec  = Math.floor(Date.now() / 1000);
const recency = (ts, league) => {
  const ageMonths = (nowSec - ts) / (30.44 * 86400);
  if (ageMonths > MAX_AGE_YEARS * 12) return 0;
  return Math.pow(0.5, ageMonths / competitionHL(league));
};

// Función de outcome continuo: convierte diferencia de goles en [0,1].
// Pi-rating núcleo: en lugar de {0, 0.5, 1}, el outcome es una función sigmoid suave.
const piOutcome = (gA, gB) => 1 / (1 + Math.pow(10, -(gA - gB) / G_SCALE));
const piExpected = (rA, rB, hb = 0) => 1 / (1 + Math.pow(10, (rB - (rA + hb)) / 400));

const srcFile = existsSync(D('results-full.json')) ? 'results-full.json' : 'results.json';
const { matches } = JSON.parse(readFileSync(D(srcFile), 'utf8'));

const R = {};
const getR = (slug) => R[slug] ?? (SEED[slug] ?? 1500);
const setR = (slug, v) => { if (slug) R[slug] = v; };

let applied = 0, skipped = 0;
for (const m of matches) {
  if (m.hg == null || m.ag == null || !m.homeSlug || !m.awaySlug) continue;
  if (isWeakCompetition(m.leagueName)) continue;
  const w = recency(m.ts, m.leagueName);
  if (w === 0) { skipped++; continue; }

  const rA = getR(m.homeSlug), rB = getR(m.awaySlug);
  const hb = HOST.has(m.homeSlug) ? HOME_ADV / 2 : 0;
  const E  = piExpected(rA, rB, hb);
  const O  = piOutcome(m.hg, m.ag);
  const k  = baseK(m.leagueName) * K_SCALE * w;

  setR(m.homeSlug, rA + k * (O - E));
  setR(m.awaySlug, rB - k * (O - E));
  applied++;
}

// 65% calibrado + 35% prior — mismo blend que calibrate.mjs.
const ratings = {};
for (const slug of Object.keys(SEED)) {
  ratings[slug] = Math.round(0.65 * (R[slug] ?? SEED[slug]) + 0.35 * SEED[slug]);
}

const changed = writeStableJSON(D('pi-ratings.json'), {
  calibratedAt: new Date().toISOString(),
  source: srcFile,
  gScale: G_SCALE,
  kScale: K_SCALE,
  matchesApplied: applied,
  skipped,
  ratings,
});

console.log(`Pi-rating calibrado: ${applied} partidos | ${skipped} omitidos`);
console.log(`Archivo: ${changed ? 'actualizado' : 'sin cambios'}\n`);

// Top 10 por pi-rating
const sorted = Object.entries(ratings).sort(([,a],[,b]) => b - a);
console.log('Top 15 pi-ratings:');
sorted.slice(0, 15).forEach(([t, r], i) => {
  const elo = SEED[t] ?? '?';
  const diff = r - elo;
  console.log(`  ${String(i+1).padStart(2)}. ${t.padEnd(24)} π=${r}  (seed ${elo}, diff ${diff >= 0 ? '+' : ''}${diff})`);
});
console.log('\nBottom 5:');
sorted.slice(-5).reverse().forEach(([t, r]) => console.log(`  ${t.padEnd(24)} π=${r}`));
