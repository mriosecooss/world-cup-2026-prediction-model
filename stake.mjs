#!/usr/bin/env node
// Kelly fraccionario + detector de correlacion para apuestas.
// Calcula el tamano optimo de apuesta segun el modelo y detecta acumulacion
// de riesgo cuando multiples boletos dependen del mismo partido.
//
// Uso:
//   node stake.mjs                    apuestas abiertas
//   node stake.mjs --all              todas (incluye cerradas — analisis historico)
//   node stake.mjs --match=ned-jpn    partido especifico
//   node stake.mjs --bankroll=49767   sobreescribir saldo de referencia
//
// Kelly estandar: f* = EV / (odds - 1)  [solo si EV > 0]
// Recomendado: Half-Kelly (f*/2) para reducir volatilidad sin sacrificar mucho EV.
// Cap de seguridad: 5% del bankroll por apuesta independiente.

import { readFileSync, existsSync } from 'node:fs';
import { matchProb, matchProbSPI, matchProbBlended, poissonPmf } from './elo.mjs';
import { SLUG_TO_NAME, rateIntegral } from './constants.mjs';
import { venueGoalMult } from './context.mjs';
import { squadAdjustment } from './squad-strength.mjs';
import { marketValueBoost } from './squad-market-value.mjs';

const D = (f) => new URL(`./data/${f}`, import.meta.url);
const { ratings: eloR } = JSON.parse(readFileSync(D('elo-calibrated.json'), 'utf8'));
const { ratings: spiR } = JSON.parse(readFileSync(D('spi-ratings.json'), 'utf8'));
const { bets } = JSON.parse(readFileSync(D('bets.json'), 'utf8'));
const { account_snapshot } = JSON.parse(readFileSync(D('deposits.json'), 'utf8'));
const fixture = existsSync(D('fixture-wc2026.json'))
  ? JSON.parse(readFileSync(D('fixture-wc2026.json'), 'utf8')).matches
  : [];

const SPI_WEIGHT = 0.65;
const FRAC_1H = rateIntegral(0, 45) / rateIntegral(0, 90);
const FRAC_2H = rateIntegral(45, 90) / rateIntegral(0, 90);
const KELLY_CAP = 0.05; // maximo 5% por apuesta independiente

const argv = process.argv.slice(2);
const getFlag = (n) => { const f = argv.find(a => a.startsWith(`--${n}=`)); return f ? f.split('=')[1] : null; };
const hasFlag = (n) => argv.includes(`--${n}`);

const bankroll   = parseInt(getFlag('bankroll') ?? account_snapshot.saldo_disponible, 10);
const showAll    = hasFlag('all');
const matchSlug  = getFlag('match');

// ── xG del modelo (igual que bet-ev.mjs v2: con squad adj + MV) ──────────────
function matchXg(home, away) {
  const venue = fixture.find(m => (m.t1 === home && m.t2 === away) || (m.t1 === away && m.t2 === home))?.venue;
  const ctx = venue ? venueGoalMult(venue) : 1.0;
  const sqH = squadAdjustment(home), sqA = squadAdjustment(away);
  const mvH = marketValueBoost(home), mvA = marketValueBoost(away);
  const eloAdj = matchProb(
    (eloR[home] ?? 1500) + sqH.adjustment,
    (eloR[away] ?? 1500) + sqA.adjustment,
    0
  );
  let r = eloAdj;
  if (spiR[home] && spiR[away]) {
    const sH = spiR[home], sA = spiR[away];
    const spi = matchProbSPI(
      sH.attack * sqH.ratio * mvH.boost, sA.defense,
      sA.attack * sqA.ratio * mvA.boost, sH.defense,
      0, ctx
    );
    r = matchProbBlended(eloAdj, spi, SPI_WEIGHT);
  }
  return { home: r.expectedGoalsA, away: r.expectedGoalsB };
}

// ── Probabilidades de mercado (misma logica que bet-ev.mjs) ──────────────────
const pAtLeast = (lam, k) => { let b = 0; for (let i = 0; i < k; i++) b += poissonPmf(i, lam); return 1 - b; };
const pExact   = (lam, k) => poissonPmf(k, lam);
const MAXG = 12;
const pWin  = (lf, la) => { let p = 0; for (let a = 0; a <= MAXG; a++) for (let b = 0; b < a; b++) p += poissonPmf(a, lf) * poissonPmf(b, la); return p; };
const pDraw = (lf, la) => { let p = 0; for (let a = 0; a <= MAXG; a++) p += poissonPmf(a, lf) * poissonPmf(a, la); return p; };

function pHtFtCombo(ht, ft, lH1, lA1, lH2, lA2) {
  const res = (h, a) => h > a ? 'home' : h < a ? 'away' : 'draw';
  let p = 0;
  for (let h1 = 0; h1 <= MAXG; h1++) for (let a1 = 0; a1 <= MAXG; a1++) {
    if (res(h1, a1) !== ht) continue;
    const pH = poissonPmf(h1, lH1) * poissonPmf(a1, lA1);
    if (pH < 1e-10) continue;
    for (let h2 = 0; h2 <= MAXG; h2++) for (let a2 = 0; a2 <= MAXG; a2++) {
      if (res(h1 + h2, a1 + a2) !== ft) continue;
      p += pH * poissonPmf(h2, lH2) * poissonPmf(a2, lA2);
    }
  }
  return p;
}

function modelProb(bet, xg) {
  const lH = xg.home, lA = xg.away, lT = lH + lA;
  const half = (l, h) => l * (h === '1H' ? FRAC_1H : FRAC_2H);
  const tL = bet.team === 'home' ? lH : lA;
  const oL = bet.team === 'home' ? lA : lH;
  switch (bet.market) {
    case 'result':             return bet.pick === 'home' ? pWin(lH,lA) : bet.pick === 'away' ? pWin(lA,lH) : pDraw(lH,lA);
    case 'team_win':           return pWin(tL, oL);
    case 'total_over':         return pAtLeast(lT, Math.floor(bet.line) + 1);
    case 'total_under':        return 1 - pAtLeast(lT, Math.ceil(bet.line));
    case 'total_atleast':      return pAtLeast(lT, bet.n);
    case 'total_exact':        return pExact(lT, bet.n);
    case 'total_range':        return pAtLeast(lT, bet.lo) - pAtLeast(lT, bet.hi + 1);
    case 'half_total_over':    return pAtLeast(half(lT, bet.half), Math.floor(bet.line) + 1);
    case 'half_total_under':   return 1 - pAtLeast(half(lT, bet.half), Math.ceil(bet.line));
    case 'half_total_atleast': return pAtLeast(half(lT, bet.half), bet.n);
    case 'half_total_exact':   return pExact(half(lT, bet.half), bet.n);
    case 'odd_even':           { let p = 0; for (let k = 0; k <= 20; k++) if ((k % 2 === 0) === (bet.pick === 'even')) p += poissonPmf(k, lT); return p; }
    case 'half_odd_even':      { const lh = half(lT, bet.half); let p = 0; for (let k = 0; k <= 10; k++) if ((k % 2 === 0) === (bet.pick === 'even')) p += poissonPmf(k, lh); return p; }
    case 'btts':               return bet.pick === 'yes' ? (1 - poissonPmf(0, lH)) * (1 - poissonPmf(0, lA)) : poissonPmf(0, lH) + poissonPmf(0, lA) - poissonPmf(0, lH) * poissonPmf(0, lA);
    case 'exact_score':        { const [gh, ga] = bet.score.split('-').map(Number); return poissonPmf(gh, lH) * poissonPmf(ga, lA); }
    case 'half_exact_score':   { const [gh, ga] = bet.score.split('-').map(Number); return poissonPmf(gh, half(lH, bet.half)) * poissonPmf(ga, half(lA, bet.half)); }
    case 'team_atleast':       return pAtLeast(tL, bet.n);
    case 'team_exact':         return pExact(tL, bet.n);
    case 'team_total_over':    return pAtLeast(tL, Math.floor(bet.line) + 1);
    case 'team_total_under':   return 1 - pAtLeast(tL, Math.ceil(bet.line));
    case 'team_total_exact':   return pExact(tL, bet.n);
    case 'team_half_atleast':  return pAtLeast(half(tL, bet.half), bet.n);
    case 'team_half_exact':    return pExact(half(tL, bet.half), bet.n);
    case 'team_win_half':      return pWin(half(tL, bet.half), half(oL, bet.half));
    case 'half_result':        return bet.pick === 'home' ? pWin(half(lH, bet.half), half(lA, bet.half)) : bet.pick === 'away' ? pWin(half(lA, bet.half), half(lH, bet.half)) : pDraw(half(lH, bet.half), half(lA, bet.half));
    case 'htft_combo':         return pHtFtCombo(bet.ht, bet.ft, half(lH,'1H'), half(lA,'1H'), half(lH,'2H'), half(lA,'2H'));
    case 'team_both_halves':
    case 'team_both_halves_score': return (1 - poissonPmf(0, half(tL, '1H'))) * (1 - poissonPmf(0, half(tL, '2H')));
    default: return null;
  }
}

// ── Kelly ─────────────────────────────────────────────────────────────────────
// f* = EV / (odds - 1), con cap de seguridad KELLY_CAP.
// Retorna 0 si EV <= 0 (no apostar con EV negativo segun Kelly).
function kellyFrac(ev, odds) {
  if (ev <= 0 || odds <= 1) return 0;
  return Math.min(ev / (odds - 1), KELLY_CAP);
}

// ── Seleccion de apuestas a mostrar ──────────────────────────────────────────
const pool = showAll ? bets : bets.filter(b => b.status === 'open');
const filtered = matchSlug ? pool.filter(b => b.match === matchSlug) : pool;

const byMatch = {};
for (const b of filtered) (byMatch[b.match] ??= []).push(b);

const W = 44; // ancho descripcion
console.log(`\n=== KELLY SIZING + CORRELACION ===`);
console.log(`Bankroll referencia : $${bankroll.toLocaleString()}`);
const openCount = bets.filter(b => b.status === 'open').length;
console.log(`Apuestas abiertas   : ${openCount} | Mostrando: ${filtered.length}${showAll ? ' (todas incl. cerradas)' : ''}\n`);

let totalOpenStake = 0, worstTotal = 0, matchCount = 0;

for (const [, list] of Object.entries(byMatch)) {
  const open = list.filter(b => b.status === 'open');
  const display = showAll ? list : open;
  if (!display.length) continue;
  matchCount++;

  const xg = matchXg(display[0].home, display[0].away);
  const hName = SLUG_TO_NAME[display[0].home] ?? display[0].home;
  const aName = SLUG_TO_NAME[display[0].away] ?? display[0].away;
  console.log(`── ${hName} vs ${aName} ──────────`);
  console.log(`   xG: ${hName} ${xg.home.toFixed(2)} – ${aName} ${xg.away.toFixed(2)}\n`);

  console.log(`   ${'Descripcion'.padEnd(W)} odds    prob      EV    Kelly  H-Kelly   Sug`);
  console.log(`   ${'─'.repeat(W + 48)}`);

  for (const b of display) {
    const p = modelProb(b, xg);
    const ev  = p != null ? p * b.odds - 1 : null;
    const kf  = ev != null ? kellyFrac(ev, b.odds) : null;
    const hkf = kf != null ? kf / 2 : null;
    const sug = hkf > 0 ? `$${(Math.round(bankroll * hkf / 500) * 500).toLocaleString()}` : '–';
    const evStr = ev != null ? `${ev >= 0 ? '+' : ''}${(ev * 100).toFixed(0).padStart(4)}%` : '   N/A';
    const kStr  = kf  != null && kf  > 0 ? `${(kf * 100).toFixed(1).padStart(4)}%` : '  neg.';
    const hkStr = hkf != null && hkf > 0 ? `${(hkf * 100).toFixed(1).padStart(4)}%` : '  neg.';
    const probStr = p != null ? `${(p * 100).toFixed(1).padStart(5)}%` : '    ?  ';
    const status = b.status === 'won' ? '[G]' : b.status === 'lost' ? '[P]' : '[A]';
    const desc = (b.desc ?? b.market).substring(0, W - 1);
    console.log(`   ${status} ${desc.padEnd(W - 1)} ${b.odds.toFixed(2).padStart(4)}  ${probStr}  ${evStr}  ${kStr}  ${hkStr}  ${sug}`);
  }

  const openStake  = open.reduce((s, b) => s + b.stake, 0);
  const openPayout = open.filter(b => b.payout).reduce((s, b) => s + b.payout, 0);
  console.log('');

  if (open.length) {
    const pct = (openStake / bankroll * 100).toFixed(1);
    console.log(`   Apuestas abiertas : ${open.length}  |  Staked: $${openStake.toLocaleString()} (${pct}% del bankroll)`);
    if (open.length > 1) {
      console.log(`   *** CORRELACION: ${open.length} boletos en el mismo partido ***`);
      console.log(`       Riesgo real > suma de Kellys individuales.`);
      console.log(`       Worst-case si pierde todo: -$${openStake.toLocaleString()}`);
    }
    totalOpenStake += openStake;
    worstTotal += openStake;
  } else if (showAll) {
    const allStake  = list.reduce((s, b) => s + b.stake, 0);
    const allPayout = list.filter(b => b.payout).reduce((s, b) => s + b.payout, 0);
    const net = allPayout - allStake;
    console.log(`   Partido cerrado — staked $${allStake.toLocaleString()} | cobrado $${allPayout.toLocaleString()} | neto ${net >= 0 ? '+' : ''}$${net.toLocaleString()}`);
  }
  console.log('');
}

// ── Resumen global ────────────────────────────────────────────────────────────
console.log(`── RESUMEN ──────────────────────────────────`);
if (openCount === 0) {
  console.log(`   Sin apuestas abiertas.`);
  if (!showAll) console.log(`   Usa --all para ver el analisis historico de todos los partidos.`);
} else {
  console.log(`   Capital en apuestas abiertas : $${totalOpenStake.toLocaleString()} (${(totalOpenStake / bankroll * 100).toFixed(1)}% del bankroll)`);
  console.log(`   Worst-case combinado         : -$${worstTotal.toLocaleString()}`);
  console.log(`   Kelly recomienda             : ≤${(KELLY_CAP * 100).toFixed(0)}% por apuesta independiente (Half-Kelly ≤${(KELLY_CAP * 50).toFixed(0)}%)`);
}

if (showAll && bets.length > 0) {
  const allStake  = bets.reduce((s, b) => s + b.stake, 0);
  const allPayout = bets.filter(b => b.payout).reduce((s, b) => s + b.payout, 0);
  const net = allPayout - allStake;
  console.log(`\n   Historico total — staked $${allStake.toLocaleString()} | cobrado $${allPayout.toLocaleString()} | neto ${net >= 0 ? '+' : ''}$${net.toLocaleString()}`);

  // Partidos con mas de 1 boleto: resumen de correlacion historica
  const matches = {};
  for (const b of bets) (matches[b.match] ??= []).push(b);
  const correlated = Object.entries(matches).filter(([, l]) => l.length > 1).sort((x, y) => y[1].length - x[1].length);
  if (correlated.length) {
    console.log(`\n   Partidos con multiples boletos (correlacion detectada):`);
    for (const [m, l] of correlated) {
      const s = l.reduce((sum, b) => sum + b.stake, 0);
      const c = l.filter(b => b.payout).reduce((sum, b) => sum + b.payout, 0);
      const won = l.filter(b => b.status === 'won').length;
      console.log(`     ${m.padEnd(30)} ${l.length} boletos  staked $${s.toLocaleString()}  cobrado $${c.toLocaleString()}  (${won}/${l.length} gan.)`);
    }
  }
}
console.log('');
