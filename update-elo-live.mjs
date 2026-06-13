#!/usr/bin/env node
// Actualiza ratings Elo con resultados WC2026 usando K=20 (conservador).
// Lee elo-calibrated.json (congelado) como base + wc2026-results.json.
// Escribe elo-live.json — usar con: node predict.mjs brasil marruecos --live
//   node update-elo-live.mjs
import { readFileSync } from 'node:fs';
import { expectedScore } from './elo.mjs';
import { HOST, HOME_ADV, writeStableJSON } from './constants.mjs';

const D = (f) => new URL(`./data/${f}`, import.meta.url);
const K_LIVE  = 20;

const { ratings: base } = JSON.parse(readFileSync(D('elo-calibrated.json'), 'utf8'));
const { updated, matches } = JSON.parse(readFileSync(D('wc2026-results.json'), 'utf8'));

const R = { ...base };
let applied = 0;

for (const m of matches) {
  if (m.g1 == null || m.g2 == null) continue;
  const ra = R[m.t1], rb = R[m.t2];
  if (ra == null || rb == null) continue;
  const hb = (HOST.has(m.t1) ? HOME_ADV : 0) - (HOST.has(m.t2) ? HOME_ADV : 0);
  const exp = expectedScore(ra, rb, hb);
  const score = m.g1 > m.g2 ? 1 : m.g1 < m.g2 ? 0 : 0.5;
  const delta = K_LIVE * (score - exp);
  R[m.t1] = Math.round(R[m.t1] + delta);
  R[m.t2] = Math.round(R[m.t2] - delta);
  applied++;
}

writeStableJSON(D('elo-live.json'), {
  generatedAt: new Date().toISOString(),
  basedOn: 'elo-calibrated.json',
  wcResultsUpdated: updated,
  matchesApplied: applied,
  kFactor: K_LIVE,
  ratings: R,
});

console.log(`elo-live.json generado — ${applied} partidos WC2026 aplicados (K=${K_LIVE})`);

const changes = Object.entries(R)
  .map(([t, r]) => ({ t, r, diff: r - (base[t] ?? r) }))
  .filter(x => x.diff !== 0)
  .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

if (changes.length) {
  console.log('\nCambios vs ratings congelados:');
  changes.forEach(({ t, r, diff }) =>
    console.log(`  ${t.padEnd(22)} ${base[t]} → ${r}  (${diff > 0 ? '+' : ''}${diff})`));
} else {
  console.log('Sin cambios (wc2026-results.json vacío o sin partidos reconocidos)');
}
