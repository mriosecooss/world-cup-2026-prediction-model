#!/usr/bin/env node
// Recálculo en vivo desde cualquier minuto — v4: CLI genérico.
// node halftime.mjs <equipo1> <equipo2> <goles1> <goles2> <minuto>
// node halftime.mjs usa paraguay 3 0 45
// node halftime.mjs brasil marruecos 1 0 67
// node halftime.mjs espana alemania 0 0 45 --home=espana
import { poissonPmf, matchProbBlended, matchProbSPI, matchProb } from './elo.mjs';
import { readFileSync } from 'node:fs';

const { ratings: eloR } = JSON.parse(readFileSync(new URL('./data/elo-calibrated.json', import.meta.url), 'utf8'));
const { ratings: spiR } = JSON.parse(readFileSync(new URL('./data/spi-ratings.json', import.meta.url), 'utf8'));
const SPI_WEIGHT = 0.65;

const SLUG_TO_NAME = {
  argentina:"Argentina", france:"France", spain:"Spain", brazil:"Brazil",
  england:"England", portugal:"Portugal", netherlands:"Netherlands", germany:"Germany",
  belgium:"Belgium", italy:"Italy", colombia:"Colombia", uruguay:"Uruguay",
  croatia:"Croatia", morocco:"Morocco", switzerland:"Switzerland", usa:"USA",
  mexico:"Mexico", japan:"Japan", senegal:"Senegal", denmark:"Denmark",
  ecuador:"Ecuador", australia:"Australia", "south-korea":"South Korea",
  iran:"Iran", poland:"Poland", canada:"Canada", serbia:"Serbia",
  wales:"Wales", ghana:"Ghana", tunisia:"Tunisia", "ivory-coast":"Ivory Coast",
  nigeria:"Nigeria", "saudi-arabia":"Saudi Arabia", qatar:"Qatar", egypt:"Egypt",
  algeria:"Algeria", scotland:"Scotland", cameroon:"Cameroon", paraguay:"Paraguay",
  venezuela:"Venezuela", chile:"Chile", peru:"Peru", "czech-republic":"Czech Republic",
  "bosnia-and-herzegovina":"Bosnia & Herzegovina", "south-africa":"South Africa",
  "new-zealand":"New Zealand", panama:"Panama", jamaica:"Jamaica", honduras:"Honduras",
  jordan:"Jordan", haiti:"Haiti", "el-salvador":"El Salvador",
  "trinidad-and-tobago":"Trinidad & Tobago", guatemala:"Guatemala",
  norway:"Norway", sweden:"Sweden", austria:"Austria", turkey:"Turkey",
  uzbekistan:"Uzbekistan", iraq:"Iraq", "dr-congo":"DR Congo",
  "cape-verde":"Cape Verde", curacao:"Curacao",
};

const argv  = process.argv.slice(2);
const args  = argv.filter(a => !a.startsWith('--'));
const flags = argv.filter(a => a.startsWith('--'));
const getFlag = (name) => { const f = flags.find(f => f.startsWith(`--${name}=`)); return f ? f.split('=')[1] : null; };

const [t1, t2, g1str, g2str, minStr] = args;
if (!t1 || !t2 || g1str == null || g2str == null || minStr == null) {
  console.log('Uso: node halftime.mjs <equipo1> <equipo2> <goles1> <goles2> <minuto>');
  console.log('Ej:  node halftime.mjs usa paraguay 3 0 45');
  console.log('Ej:  node halftime.mjs brasil marruecos 1 0 67 --home=brasil');
  process.exit(0);
}

const g1 = parseInt(g1str), g2 = parseInt(g2str), minute = parseInt(minStr);
if (isNaN(g1) || isNaN(g2) || isNaN(minute)) { console.error('Goles y minuto deben ser números'); process.exit(1); }
if (minute < 1 || minute > 89) { console.error('Minuto debe estar entre 1 y 89'); process.exit(1); }
if (!eloR[t1]) { console.error(`Equipo desconocido: '${t1}'`); process.exit(1); }
if (!eloR[t2]) { console.error(`Equipo desconocido: '${t2}'`); process.exit(1); }

const homeTeam = getFlag('home');
const hb = homeTeam === t1 ? 75 : homeTeam === t2 ? -75 : 0;

// Blended full-match xG
const ra = eloR[t1], rb = eloR[t2];
const eloFull = matchProb(ra, rb, hb);
let blendFull;
if (spiR[t1] && spiR[t2]) {
  const sA = spiR[t1], sB = spiR[t2];
  const spiFull = matchProbSPI(sA.attack, sB.defense, sB.attack, sA.defense, hb, 1.0);
  blendFull = matchProbBlended(eloFull, spiFull, SPI_WEIGHT);
} else {
  blendFull = eloFull;
}
const fullXg1 = blendFull.expectedGoalsA;
const fullXg2 = blendFull.expectedGoalsB;

// Distribución por minutos
const RATE_BLOCKS = [
  { from:  1, to: 15, rate: 0.714 },
  { from: 16, to: 30, rate: 0.876 },
  { from: 31, to: 45, rate: 1.048 },
  { from: 46, to: 60, rate: 0.790 },
  { from: 61, to: 75, rate: 1.067 },
  { from: 76, to: 90, rate: 1.505 },
];
const FULL_WEIGHT = 90;
function rateIntegral(from, to = 90) {
  let w = 0;
  for (const b of RATE_BLOCKS) { const s = Math.max(from, b.from), e = Math.min(to, b.to); if (e > s) w += (e - s) * b.rate; }
  return w;
}

const remainingFrac = rateIntegral(minute + 1, 90) / FULL_WEIGHT;
const xg1r = fullXg1 * remainingFrac;
const xg2r = fullXg2 * remainingFrac;

// Probabilidades de resultado final
let win1 = 0, draw = 0, win2 = 0;
for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8; b++) {
  const p = poissonPmf(a, xg1r) * poissonPmf(b, xg2r);
  const fA = g1 + a, fB = g2 + b;
  if (fA > fB) win1 += p; else if (fA === fB) draw += p; else win2 += p;
}

// Distribución de marcadores finales
const scores = [];
for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) {
  scores.push({ score: `${g1+a}-${g2+b}`, prob: poissonPmf(a, xg1r) * poissonPmf(b, xg2r) * 100 });
}
scores.sort((x, y) => y.prob - x.prob);

// Over/under final
const totals = {};
for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8; b++) {
  const p = poissonPmf(a, xg1r) * poissonPmf(b, xg2r);
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

console.log(`\n  ${'─'.repeat(55)}`);
console.log(`  ${name1} ${g1}–${g2} ${name2}   min ${minute}'${homeTeam ? `  [${SLUG_TO_NAME[homeTeam] ?? homeTeam} local]` : '  [neutral]'}`);
console.log(`  ${'─'.repeat(55)}`);
console.log(`\n  xG restante  :  ${name1} ${xg1r.toFixed(2)}  |  ${name2} ${xg2r.toFixed(2)}  (${Math.round(remainingFrac * 100)}% del partido)`);
console.log(`  xG partido   :  ${name1} ${fullXg1.toFixed(2)}  |  ${name2} ${fullXg2.toFixed(2)}\n`);
console.log(`  ${name1.padEnd(18)} gana  ${pct(win1).padStart(6)}  ${bar(win1)}`);
console.log(`  ${'Empate'.padEnd(18)}       ${pct(draw).padStart(6)}  ${bar(draw)}`);
console.log(`  ${name2.padEnd(18)} gana  ${pct(win2).padStart(6)}  ${bar(win2)}`);
console.log(`\n  Marcadores más probables:`);
scores.slice(0, 8).forEach(s => console.log(`    ${s.score.padEnd(8)} ${s.prob.toFixed(1).padStart(5)}%`));
console.log(`\n  Over/Under final:`);
console.log(`    Over 2.5  ${pct(o25).padStart(6)}  |  Under 2.5  ${pct(1-o25).padStart(6)}`);
console.log(`    Over 3.5  ${pct(o35).padStart(6)}  |  Under 3.5  ${pct(1-o35).padStart(6)}`);
console.log(`    Over 4.5  ${pct(o45).padStart(6)}  |  Under 4.5  ${pct(1-o45).padStart(6)}\n`);
