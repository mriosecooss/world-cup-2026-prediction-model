#!/usr/bin/env node
// Reconcilia abonos (capital propio) + apuestas → saldo, P&L y ROI sobre capital.
// Distingue capital propio depositado de la plata reinvertida (ganancias recicladas).
//   node bankroll.mjs
import { readFileSync } from 'node:fs';

const D = (f) => new URL(`./data/${f}`, import.meta.url);
const { deposits, account_snapshot: snap } = JSON.parse(readFileSync(D('deposits.json'), 'utf8'));
const { bets } = JSON.parse(readFileSync(D('bets.json'), 'utf8'));

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CL');
const pct = (n, base) => (100 * n / base).toFixed(1).replace('.', ',') + '%';

// --- Totales de apuestas ---
const staked = bets.reduce((s, b) => s + b.stake, 0);
const returned = bets.reduce((s, b) => s + (b.payout || 0), 0);            // cobrado (solo 'won' traen payout)
const settled = bets.filter(b => b.status !== 'open');
const open = bets.filter(b => b.status === 'open');
const stakedSettled = settled.reduce((s, b) => s + b.stake, 0);
const stakedOpen = open.reduce((s, b) => s + b.stake, 0);
const realizedPL = returned - stakedSettled;                              // P&L sobre lo ya cerrado

// --- Capital propio ---
const deposited = deposits.reduce((s, d) => s + d.amount, 0);

// --- Saldo libre reconstruido = depósitos − apostado + devuelto ---
const freeBalance = deposited - staked + returned;
const accountValue = freeBalance + stakedOpen;                            // saldo + plata viva en apuestas
const reinvested = staked - deposited;                                    // turnover financiado con ganancias

// --- Por partido ---
const byMatch = {};
for (const b of bets) {
  const m = byMatch[b.match] ??= { stake: 0, payout: 0, won: 0, lost: 0, open: 0 };
  m.stake += b.stake; m.payout += b.payout || 0; m[b.status]++;
}

console.log('\n=== BANKROLL — WC2026 ===\n');
console.log('Capital propio depositado :', fmt(deposited), `(${deposits.length} abonos)`, '= 100%');
console.log('Total apostado (turnover) :', fmt(staked));
console.log('  · financiado c/ depósito:', fmt(deposited), `(${pct(deposited, staked)} del turnover)`);
console.log('  · financiado c/ ganancia:', fmt(reinvested), `(${pct(reinvested, staked)} del turnover) ← reinversión`);
console.log('Total cobrado (liquidado) :', fmt(returned));

console.log('\n--- Estado de cuenta (sobre capital propio) ---');
const rows = [
  ['Saldo disponible (no en apuestas)', freeBalance],
  ['En apuestas abiertas', stakedOpen],
  ['Valor total de la cuenta', accountValue],
  ['P&L realizado (cerrado)', realizedPL],
];
for (const [label, val] of rows) {
  console.log('  ' + label.padEnd(36), fmt(val).padStart(10), pct(val, deposited).padStart(8));
}
if (snap?.saldo_disponible != null) {
  const ok = Math.round(freeBalance) === snap.saldo_disponible ? '✅ cuadra' : '⚠️ NO cuadra';
  console.log(`\n  Saldo reportado por la casa: ${fmt(snap.saldo_disponible)} → ${ok} con el reconstruido (${fmt(freeBalance)})`);
}

console.log('\n--- Por partido ---');
for (const k in byMatch) {
  const m = byMatch[k];
  const pl = m.open ? '(en juego)' : (m.payout - m.stake >= 0 ? '+' : '') + fmt(m.payout - m.stake);
  console.log('  ' + k.padEnd(18), `stake ${fmt(m.stake).padStart(9)}`,
    `cobrado ${fmt(m.payout).padStart(9)}`, '→', pl);
}
console.log('');
