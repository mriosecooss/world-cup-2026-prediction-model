#!/usr/bin/env node
// Calcula el EV de las apuestas en data/bets.json usando el modelo (V1 tracker).
// EV = prob_modelo × cuota − 1.  Split por tiempo via rateIntegral.
//   node bet-ev.mjs                 todas las apuestas abiertas
//   node bet-ev.mjs qatar-switzerland   solo ese partido
import { readFileSync, existsSync } from 'node:fs';
import { matchProb, matchProbSPI, matchProbBlended, poissonPmf } from './elo.mjs';
import { SLUG_TO_NAME, rateIntegral } from './constants.mjs';
import { venueGoalMult } from './context.mjs';

const SPI_WEIGHT = 0.65;
const D = (f) => new URL(`./data/${f}`, import.meta.url);
const { ratings: eloR } = JSON.parse(readFileSync(D('elo-calibrated.json'), 'utf8'));
const { ratings: spiR } = JSON.parse(readFileSync(D('spi-ratings.json'), 'utf8'));
const { bets } = JSON.parse(readFileSync(D('bets.json'), 'utf8'));
const fixture = existsSync(D('fixture-wc2026.json')) ? JSON.parse(readFileSync(D('fixture-wc2026.json'), 'utf8')).matches : [];

const filter = process.argv[2];

// Fracción de goles en cada mitad (split empírico por minuto-distribución).
const FRAC_1H = rateIntegral(0, 45) / rateIntegral(0, 90);
const FRAC_2H = rateIntegral(45, 90) / rateIntegral(0, 90);

// xG full del modelo blended para un partido.
function matchXg(home, away) {
  const venue = fixture.find(m => (m.t1 === home && m.t2 === away) || (m.t1 === away && m.t2 === home))?.venue;
  const ctx = venue ? venueGoalMult(venue) : 1.0;
  const elo = matchProb(eloR[home], eloR[away], 0);
  let r = elo;
  if (spiR[home] && spiR[away]) {
    const sA = spiR[home], sB = spiR[away];
    const spi = matchProbSPI(sA.attack, sB.defense, sB.attack, sA.defense, 0, ctx);
    r = matchProbBlended(elo, spi, SPI_WEIGHT);
  }
  return { home: r.expectedGoalsA, away: r.expectedGoalsB };
}

// P(X >= k) y P(X = k) para Poisson(λ)
const pAtLeast = (lambda, k) => { let below = 0; for (let i = 0; i < k; i++) below += poissonPmf(i, lambda); return 1 - below; };
const pExact = (lambda, k) => poissonPmf(k, lambda);

// P(equipo A marca más que B) sobre dos Poisson independientes (0..MAXG goles).
const MAXG = 12;
function pTeamWins(lamFor, lamAgainst) {
  let p = 0;
  for (let a = 0; a <= MAXG; a++) for (let b = 0; b < a; b++) p += poissonPmf(a, lamFor) * poissonPmf(b, lamAgainst);
  return p;
}
// P(gana 1er tiempo Y gana el partido) — convolución 1T+2T independientes por equipo.
function pHtFt(lamForH1, lamAgH1, lamForH2, lamAgH2) {
  let p = 0;
  for (let f1 = 0; f1 <= MAXG; f1++) for (let a1 = 0; a1 <= MAXG; a1++) {
    if (f1 <= a1) continue;                                   // debe ganar el 1er tiempo
    const pHalf1 = poissonPmf(f1, lamForH1) * poissonPmf(a1, lamAgH1);
    if (pHalf1 < 1e-9) continue;
    for (let f2 = 0; f2 <= MAXG; f2++) for (let a2 = 0; a2 <= MAXG; a2++) {
      if (f1 + f2 <= a1 + a2) continue;                       // debe ganar el partido
      p += pHalf1 * poissonPmf(f2, lamForH2) * poissonPmf(a2, lamAgH2);
    }
  }
  return p;
}
// P(resultado 1T = ht Y resultado FT = ft) para cualquier combo. lamH=local, lamA=visitante.
// ht/ft ∈ {'home','draw','away'}.
function pHtFtCombo(ht, ft, lamH1, lamA1, lamH2, lamA2) {
  const res = (h, a) => h > a ? 'home' : h < a ? 'away' : 'draw';
  let p = 0;
  for (let h1 = 0; h1 <= MAXG; h1++) for (let a1 = 0; a1 <= MAXG; a1++) {
    if (res(h1, a1) !== ht) continue;
    const pHalf1 = poissonPmf(h1, lamH1) * poissonPmf(a1, lamA1);
    if (pHalf1 < 1e-10) continue;
    for (let h2 = 0; h2 <= MAXG; h2++) for (let a2 = 0; a2 <= MAXG; a2++) {
      if (res(h1 + h2, a1 + a2) !== ft) continue;
      p += pHalf1 * poissonPmf(h2, lamH2) * poissonPmf(a2, lamA2);
    }
  }
  return p;
}

// Probabilidad del modelo según el tipo de mercado.
function modelProb(bet, xg) {
  const lamH = xg.home, lamA = xg.away;
  const lamTotal = lamH + lamA;
  const half = (lam, h) => lam * (h === '1H' ? FRAC_1H : FRAC_2H);
  const teamLam = bet.team === 'home' ? lamH : lamA;
  const oppLam  = bet.team === 'home' ? lamA : lamH;
  switch (bet.market) {
    case 'total_over':         return pAtLeast(lamTotal, Math.floor(bet.line) + 1);
    case 'total_atleast':      return pAtLeast(lamTotal, bet.n);
    case 'half_total_over':    return pAtLeast(half(lamTotal, bet.half), Math.floor(bet.line) + 1);
    case 'half_total_atleast': return pAtLeast(half(lamTotal, bet.half), bet.n);
    case 'team_atleast':       return pAtLeast(teamLam, bet.n);
    case 'team_exact':         return pExact(teamLam, bet.n);
    case 'team_total_over':    return pAtLeast(teamLam, Math.floor(bet.line) + 1);
    case 'team_total_under':   return 1 - pAtLeast(teamLam, Math.floor(bet.line) + 1);
    case 'team_total_exact':   return pExact(teamLam, bet.n);
    case 'team_half_atleast':  return pAtLeast(half(teamLam, bet.half), bet.n);
    case 'team_half_exact':    return pExact(half(teamLam, bet.half), bet.n);
    case 'team_win':           return pTeamWins(teamLam, oppLam);
    case 'team_win_half':      return pTeamWins(half(teamLam, bet.half), half(oppLam, bet.half));
    case 'ht_ft':              return pHtFt(half(teamLam, '1H'), half(oppLam, '1H'), half(teamLam, '2H'), half(oppLam, '2H'));
    case 'htft_combo':         return pHtFtCombo(bet.ht, bet.ft, half(lamH, '1H'), half(lamA, '1H'), half(lamH, '2H'), half(lamA, '2H'));
    case 'team_both_halves':   return (1 - poissonPmf(0, half(teamLam, '1H'))) * (1 - poissonPmf(0, half(teamLam, '2H')));
    default: return null;
  }
}

const sel = bets.filter(b => !filter || b.match === filter);
const byMatch = {};
for (const b of sel) (byMatch[b.match] ??= []).push(b);

let openStake = 0, openExpReturn = 0;
let settledStake = 0, settledReturn = 0;

for (const [, list] of Object.entries(byMatch)) {
  const xg = matchXg(list[0].home, list[0].away);
  console.log(`\n=== ${SLUG_TO_NAME[list[0].home] ?? list[0].home} vs ${SLUG_TO_NAME[list[0].away] ?? list[0].away} ===`);
  console.log(`xG modelo: ${xg.home.toFixed(2)} – ${xg.away.toFixed(2)}  (1T ${(FRAC_1H*100).toFixed(0)}% / 2T ${(FRAC_2H*100).toFixed(0)}%)\n`);
  console.log(`  cuota  prob    EV       apuesta`);
  list.sort((x, y) => (modelProb(y, xg) * y.odds) - (modelProb(x, xg) * x.odds));
  for (const b of list) {
    const p = modelProb(b, xg);
    const ev = p * b.odds - 1;
    if (b.status === 'won' || b.status === 'lost') {
      const ret = b.status === 'won' ? b.stake * b.odds : 0;
      settledStake += b.stake; settledReturn += ret;
      const mark = b.status === 'won' ? '🟢 GANADA' : '🔴 PERDIDA';
      console.log(`  ${b.odds.toFixed(2).padStart(5)}  ${(p*100).toFixed(1).padStart(5)}%  ${(ev>=0?'+':'')}${(ev*100).toFixed(1).padStart(5)}%  ${mark} ${b.desc}`);
    } else {
      openStake += b.stake; openExpReturn += b.stake * p * b.odds;
      const flag = ev > 0.05 ? '✅' : ev < 0 ? '❌' : '➖';
      console.log(`  ${b.odds.toFixed(2).padStart(5)}  ${(p*100).toFixed(1).padStart(5)}%  ${(ev>=0?'+':'')}${(ev*100).toFixed(1).padStart(5)}%  ${flag} ${b.desc}`);
    }
  }
}

console.log(`\n--- Resumen ---`);
if (settledStake) {
  console.log(`Resueltas:  apostado $${settledStake.toLocaleString()} → cobrado $${settledReturn.toLocaleString()}  (P&L ${settledReturn-settledStake>=0?'+':''}$${(settledReturn-settledStake).toLocaleString()})`);
}
if (openStake) {
  console.log(`Abiertas:   apostado $${openStake.toLocaleString()} → retorno esperado $${Math.round(openExpReturn).toLocaleString()} (EV ${((openExpReturn/openStake-1)*100).toFixed(1)}%, según modelo)`);
}
console.log(`\nNota: EV alto y uniforme en mercados de goles indica λ sobreestimado (sesgo CAF/AFC), no valor real.`);
