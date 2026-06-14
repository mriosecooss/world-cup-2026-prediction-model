#!/usr/bin/env node
// Recalculo en vivo desde cualquier minuto — v5: modelo unificado con predict.mjs.
// Cambios vs v4: Dixon-Coles en probabilidades restantes, squad adj + market value,
// pi-rating como 3er blend, homeBonus() por equipo, minuto hasta 120 (proxorroga).
// node halftime.mjs <equipo1> <equipo2> <goles1> <goles2> <minuto>
// node halftime.mjs usa paraguay 3 0 45
// node halftime.mjs brasil marruecos 1 0 67 --home=brasil
// node halftime.mjs espana alemania 0 0 93              (tiempo de descuento)
import { poissonPmf, dcTau, DC_RHO, matchProbBlended, matchProbBlended3, matchProbSPI, matchProb } from './elo.mjs';
import { SLUG_TO_NAME, rateIntegral } from './constants.mjs';
import { homeBonus } from './context.mjs';
import { squadAdjustment } from './squad-strength.mjs';
import { marketValueBoost } from './squad-market-value.mjs';
import { readFileSync, existsSync } from 'node:fs';

const { ratings: eloR } = JSON.parse(readFileSync(new URL('./data/elo-calibrated.json', import.meta.url), 'utf8'));
const { ratings: spiR } = JSON.parse(readFileSync(new URL('./data/spi-ratings.json', import.meta.url), 'utf8'));
const piFile = new URL('./data/pi-ratings.json', import.meta.url);
const piR = existsSync(piFile) ? JSON.parse(readFileSync(piFile, 'utf8')).ratings : null;

const SPI_WEIGHT = 0.65;
// Goles en proxorroga: tasa relativa al promedio del partido normal (equipos cansados, mas defensivo)
const ET_RATE = 0.80;

const argv  = process.argv.slice(2);
const args  = argv.filter(a => !a.startsWith('--'));
const flags = argv.filter(a => a.startsWith('--'));
const getFlag = (name) => { const f = flags.find(f => f.startsWith(`--${name}=`)); return f ? f.split('=')[1] : null; };
const hasFlag = (name) => flags.includes(`--${name}`);

const [t1, t2, g1str, g2str, minStr] = args;
if (!t1 || !t2 || g1str == null || g2str == null || minStr == null) {
  console.log('Uso: node halftime.mjs <equipo1> <equipo2> <goles1> <goles2> <minuto>');
  console.log('Ej:  node halftime.mjs usa paraguay 3 0 45');
  console.log('Ej:  node halftime.mjs brasil marruecos 1 0 67 --home=brasil');
  console.log('Ej:  node halftime.mjs espana alemania 0 0 93   (tiempo de descuento)');
  process.exit(0);
}

const g1 = parseInt(g1str), g2 = parseInt(g2str), minute = parseInt(minStr);
if (isNaN(g1) || isNaN(g2) || g1 < 0 || g2 < 0) { console.error('Goles deben ser numeros no negativos'); process.exit(1); }
if (isNaN(minute) || minute < 1 || minute > 120) { console.error('Minuto debe estar entre 1 y 120 (usa 90-120 para proxorroga)'); process.exit(1); }
if (!eloR[t1]) { console.error(`Equipo desconocido: '${t1}'`); process.exit(1); }
if (!eloR[t2]) { console.error(`Equipo desconocido: '${t2}'`); process.exit(1); }

const homeTeam  = getFlag('home');
const useSquad  = !hasFlag('no-squad');
const useMV     = !hasFlag('no-mv');

// Home bonus por equipo (respeta HOME_ADV_OFFSET: mexico +95, usa +85, canada +80...)
const hb = homeTeam === t1 ? homeBonus(t1, true) : homeTeam === t2 ? -homeBonus(t2, true) : 0;

// Squad adjustment + market value
const sqA = squadAdjustment(t1);
const sqB = squadAdjustment(t2);
const mvA = marketValueBoost(t1);
const mvB = marketValueBoost(t2);

const ra = (eloR[t1] ?? 1500) + (useSquad ? sqA.adjustment : 0);
const rb = (eloR[t2] ?? 1500) + (useSquad ? sqB.adjustment : 0);
const sqMultA    = useSquad ? sqA.attack_ratio   : 1;
const sqMultB    = useSquad ? sqB.attack_ratio   : 1;
const sqDefMultA = useSquad ? (2 - sqA.defense_ratio) : 1;
const sqDefMultB = useSquad ? (2 - sqB.defense_ratio) : 1;
const mvMultA = useMV ? mvA.boost : 1;
const mvMultB = useMV ? mvB.boost : 1;

// xG partido completo (3-way si pi disponible, igual que predict.mjs)
const eloFull = matchProb(ra, rb, hb);
let blendFull;
if (spiR[t1] && spiR[t2]) {
  const sA = spiR[t1], sB = spiR[t2];
  const spiFull = matchProbSPI(
    sA.attack * sqMultA * mvMultA, sB.defense * sqDefMultB,
    sB.attack * sqMultB * mvMultB, sA.defense * sqDefMultA,
    hb, 1.0
  );
  if (piR && piR[t1] != null && piR[t2] != null) {
    blendFull = matchProbBlended3(eloFull, spiFull, matchProb(piR[t1], piR[t2], hb));
  } else {
    blendFull = matchProbBlended(eloFull, spiFull, SPI_WEIGHT);
  }
} else {
  blendFull = eloFull;
}
const fullXg1 = blendFull.expectedGoalsA;
const fullXg2 = blendFull.expectedGoalsB;

// Fraccion de tiempo restante (con soporte hasta 120' para proxorroga)
const FULL_WEIGHT = rateIntegral(0, 90);
const regularFrac = rateIntegral(Math.min(minute, 90), 90) / FULL_WEIGHT;
const etMinutes   = minute > 90 ? Math.max(0, 120 - minute) : 0;
const etFrac      = etMinutes / 90 * ET_RATE;
const remainingFrac = regularFrac + etFrac;

// Game state: equipo que pierde ataca más, el que gana administra. Escala de min 30 a 90.
const scoreDiff    = g1 - g2;
const absDiff      = Math.min(Math.abs(scoreDiff), 2);
const minuteFactor = Math.min(1, Math.max(0, (minute - 30) / 60));
const gs1 = scoreDiff < 0
  ? 1 + absDiff * 0.12 * minuteFactor   // perdiendo: boost ofensivo
  : scoreDiff > 0
  ? 1 - absDiff * 0.08 * minuteFactor   // ganando: repliegue
  : 1;
const gs2 = scoreDiff > 0
  ? 1 + absDiff * 0.12 * minuteFactor
  : scoreDiff < 0
  ? 1 - absDiff * 0.08 * minuteFactor
  : 1;

const xg1r = fullXg1 * remainingFrac * gs1;
const xg2r = fullXg2 * remainingFrac * gs2;

// Distribucion de marcadores adicionales con correccion Dixon-Coles (como matchProb en elo.mjs)
function dcGrid(lam1, lam2, maxG = 8) {
  const cells = [];
  let total = 0;
  for (let a = 0; a <= maxG; a++) for (let b = 0; b <= maxG; b++) {
    const p = poissonPmf(a, lam1) * poissonPmf(b, lam2) * dcTau(a, b, lam1, lam2, DC_RHO);
    cells.push([a, b, p]);
    total += p;
  }
  return cells.map(([a, b, p]) => [a, b, p / total]);
}

const grid = dcGrid(xg1r, xg2r);

let win1 = 0, draw = 0, win2 = 0;
for (const [a, b, p] of grid) {
  const fA = g1 + a, fB = g2 + b;
  if (fA > fB) win1 += p; else if (fA === fB) draw += p; else win2 += p;
}

const scores = grid
  .filter(([a, b]) => a <= 5 && b <= 5)
  .map(([a, b, p]) => ({ score: `${g1+a}-${g2+b}`, prob: p * 100 }))
  .sort((x, y) => y.prob - x.prob);

const totals = {};
for (const [a, b, p] of grid) {
  const t = g1 + g2 + a + b;
  totals[t] = (totals[t] || 0) + p;
}
let o25 = 0, o35 = 0, o45 = 0;
for (const [t, p] of Object.entries(totals)) {
  if (+t > 2) o25 += p;
  if (+t > 3) o35 += p;
  if (+t > 4) o45 += p;
}

const name1 = SLUG_TO_NAME[t1] ?? t1.toUpperCase();
const name2 = SLUG_TO_NAME[t2] ?? t2.toUpperCase();
const bar = (x) => '█'.repeat(Math.round(x * 25));
const pct = (x) => (x * 100).toFixed(1) + '%';
const isET = minute > 90;

console.log(`\n  ${'─'.repeat(58)}`);
console.log(`  ${name1} ${g1}–${g2} ${name2}   min ${minute}'${homeTeam ? `  [${SLUG_TO_NAME[homeTeam] ?? homeTeam} local]` : '  [neutral]'}${isET ? '  [PRORROGA]' : ''}`);
if (piR && piR[t1] != null) console.log(`  Blend: Elo 25% + SPI 45% + Pi 30%  |  DC-corrected`);
else                          console.log(`  Blend: Elo 35% + SPI 65%  |  DC-corrected`);
console.log(`  ${'─'.repeat(58)}`);
if (useSquad) {
  if (sqA.missing.length) console.log(`  ⚠ ${t1} bajas: ${sqA.missing.map(p => p.name).join(', ')}`);
  if (sqB.missing.length) console.log(`  ⚠ ${t2} bajas: ${sqB.missing.map(p => p.name).join(', ')}`);
}
console.log(`\n  xG restante  :  ${name1} ${xg1r.toFixed(2)}  |  ${name2} ${xg2r.toFixed(2)}  (${Math.round(remainingFrac * 100)}% del partido${isET ? ', incluye ET' : ''})`);
console.log(`  xG partido   :  ${name1} ${fullXg1.toFixed(2)}  |  ${name2} ${fullXg2.toFixed(2)}`);
if (scoreDiff !== 0 && minuteFactor > 0) {
  const remontaName = scoreDiff < 0 ? name1 : name2;
  const adminName   = scoreDiff < 0 ? name2 : name1;
  const gsRemonta = scoreDiff < 0 ? gs1 : gs2;
  const gsAdmin   = scoreDiff < 0 ? gs2 : gs1;
  console.log(`  Game state   :  ${remontaName} remonta ×${gsRemonta.toFixed(2)} atk  |  ${adminName} administra ×${gsAdmin.toFixed(2)} atk`);
}
console.log('');
console.log(`  ${name1.padEnd(18)} gana  ${pct(win1).padStart(6)}  ${bar(win1)}`);
console.log(`  ${'Empate'.padEnd(18)}       ${pct(draw).padStart(6)}  ${bar(draw)}`);
console.log(`  ${name2.padEnd(18)} gana  ${pct(win2).padStart(6)}  ${bar(win2)}`);
console.log(`\n  Marcadores mas probables:`);
scores.slice(0, 8).forEach(s => console.log(`    ${s.score.padEnd(8)} ${s.prob.toFixed(1).padStart(5)}%`));
console.log(`\n  Over/Under final:`);
console.log(`    Over 2.5  ${pct(o25).padStart(6)}  |  Under 2.5  ${pct(1-o25).padStart(6)}`);
console.log(`    Over 3.5  ${pct(o35).padStart(6)}  |  Under 3.5  ${pct(1-o35).padStart(6)}`);
console.log(`    Over 4.5  ${pct(o45).padStart(6)}  |  Under 4.5  ${pct(1-o45).padStart(6)}\n`);
