#!/usr/bin/env node
// Predict any head-to-head from the calibrated ratings.
// v2: integrates squad availability adjustment from players.json
//   node predict.mjs brazil argentina            (neutral venue)
//   node predict.mjs usa mexico usa               (3rd arg = home team)
//   node predict.mjs usa paraguay --no-squad      (skip squad adjustment)
import { readFileSync } from "node:fs";
import { matchProb } from "./elo.mjs";
import { squadAdjustment } from "./squad-strength.mjs";

const { ratings } = JSON.parse(readFileSync(new URL("./data/elo-calibrated.json", import.meta.url), "utf8"));
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const useSquad = !process.argv.includes('--no-squad');
const [a, b, home] = args;

if (!a || !b) {
  console.log("Usage: node predict.mjs <teamA> <teamB> [homeTeam] [--no-squad]\n");
  console.log("Teams:\n  " + Object.keys(ratings).sort().join(", "));
  process.exit(0);
}
const ra = ratings[a], rb = ratings[b];
if (ra == null || rb == null) {
  console.error(`Unknown team: ${ra == null ? a : b}\nAvailable: ${Object.keys(ratings).sort().join(", ")}`);
  process.exit(1);
}

// Squad adjustments
const sqA = squadAdjustment(a);
const sqB = squadAdjustment(b);
const raAdj = useSquad ? ra + sqA.adjustment : ra;
const rbAdj = useSquad ? rb + sqB.adjustment : rb;

const hb = home === a ? 75 : home === b ? -75 : 0;
const p = matchProb(raAdj, rbAdj, hb);
const bar = (x) => "█".repeat(Math.round(x * 30));

console.log(`\n  ${a} (Elo ${ra}${sqA.adjustment !== 0 ? ` → ${raAdj}` : ''})  vs  ${b} (Elo ${rb}${sqB.adjustment !== 0 ? ` → ${rbAdj}` : ''})${hb ? `   [${home} at home]` : "   [neutral]"}\n`);

if (useSquad && (sqA.missing.length || sqB.missing.length)) {
  if (sqA.missing.length) console.log(`  ⚠  ${a} bajas: ${sqA.missing.map(p=>p.name).join(', ')}`);
  if (sqB.missing.length) console.log(`  ⚠  ${b} bajas: ${sqB.missing.map(p=>p.name).join(', ')}`);
  console.log('');
}

console.log(`  ${a.padEnd(16)} win  ${(p.winA * 100).toFixed(1).padStart(5)}%  ${bar(p.winA)}`);
console.log(`  ${"draw".padEnd(16)}      ${(p.draw * 100).toFixed(1).padStart(5)}%  ${bar(p.draw)}`);
console.log(`  ${b.padEnd(16)} win  ${(p.winB * 100).toFixed(1).padStart(5)}%  ${bar(p.winB)}`);
console.log(`\n  expected goals:  ${p.expectedGoalsA.toFixed(2)} – ${p.expectedGoalsB.toFixed(2)}\n`);
if (useSquad) console.log(`  Squad strength  →  ${a}: ${(sqA.ratio*100).toFixed(0)}%   ${b}: ${(sqB.ratio*100).toFixed(0)}%`);
console.log("\n  Full 48-team tournament title odds: https://cup26matches.com");
