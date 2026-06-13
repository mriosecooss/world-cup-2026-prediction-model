#!/usr/bin/env node
// MLE calibration del Dixon-Coles ρ sobre datos walk-forward.
// ρ solo afecta marcadores bajos: (0,0), (0,1), (1,0), (1,1).
// Para otros marcadores τ=1, log(τ)=0 → no contribuyen a la optimización.
//   node calibrate-rho.mjs
import { readFileSync } from "node:fs";
import { expectedGoals } from "./elo.mjs";

const D = (f) => new URL(`./data/${f}`, import.meta.url);
const SEED = {
  argentina:2085,france:2065,spain:2055,brazil:2045,england:2000,portugal:1980,netherlands:1965,germany:1945,belgium:1925,italy:1915,colombia:1890,uruguay:1875,croatia:1870,morocco:1840,switzerland:1825,usa:1830,mexico:1825,japan:1810,senegal:1795,denmark:1790,ecuador:1760,australia:1735,"south-korea":1730,iran:1720,poland:1715,canada:1700,serbia:1695,wales:1665,ghana:1665,tunisia:1655,"ivory-coast":1655,nigeria:1645,"saudi-arabia":1640,qatar:1630,egypt:1620,algeria:1615,scotland:1610,cameroon:1600,paraguay:1595,venezuela:1590,chile:1580,peru:1575,"czech-republic":1570,"bosnia-and-herzegovina":1545,"south-africa":1520,"new-zealand":1495,panama:1480,jamaica:1460,honduras:1440,jordan:1420,haiti:1380,"el-salvador":1370,"trinidad-and-tobago":1360,guatemala:1345
};
const HOME_ADV = 75, BURN_IN = 150;
const baseK = (n = "") => { n = n.toLowerCase();
  if (/world cup(?!.*qual)/.test(n)) return 55;
  if (/world cup.*qual|qualification/.test(n)) return 40;
  if (/copa america|euro championship\b|asian cup|africa cup|gold cup/.test(n)) return 50;
  if (/nations league|nations cup/.test(n)) return 32;
  if (/friendl/.test(n)) return 18;
  return 28; };
const gMult = (gd) => { const d = Math.abs(gd); return d <= 1 ? 1 : d === 2 ? 1.5 : (11 + d) / 8; };
const expectedScore = (a, b, hb) => 1 / (1 + Math.pow(10, (b - (a + hb)) / 400));

function dcTau(a, b, lambda, mu, rho) {
  if (a === 0 && b === 0) return 1 - lambda * mu * rho;
  if (a === 0 && b === 1) return 1 + lambda * rho;
  if (a === 1 && b === 0) return 1 + mu * rho;
  if (a === 1 && b === 1) return 1 - rho;
  return 1;
}

const { matches } = JSON.parse(readFileSync(D("results.json"), "utf8"));
const R = {};
const getR = (s, nm) => { const k = s ?? `ghost:${nm}`; if (R[k] == null) R[k] = s && SEED[s] != null ? SEED[s] : 1500; return R[k]; };
const setR = (s, nm, v) => { R[s ?? `ghost:${nm}`] = v; };

// Recopilar (a, b, λ, μ) para marcadores bajos en walk-forward
const lowScoreData = [];
let i = 0;
for (const m of matches) {
  if (m.hg == null || m.ag == null) continue;
  const ra = getR(m.homeSlug, m.homeName), rb = getR(m.awaySlug, m.awayName);
  if (i >= BURN_IN && m.hg <= 1 && m.ag <= 1) {
    const lambda = expectedGoals(ra, rb, HOME_ADV);
    const mu = expectedGoals(rb, ra, -HOME_ADV / 2);
    lowScoreData.push({ a: m.hg, b: m.ag, lambda, mu });
  }
  const exp = expectedScore(ra, rb, HOME_ADV);
  const score = m.hg > m.ag ? 1 : m.hg < m.ag ? 0 : 0.5;
  const delta = baseK(m.leagueName) * gMult(m.hg - m.ag) * (score - exp);
  setR(m.homeSlug, m.homeName, ra + delta);
  setR(m.awaySlug, m.awayName, rb - delta);
  i++;
}

console.log(`\nMarcadores bajos usados para MLE: ${lowScoreData.length} de ${i - BURN_IN} partidos evaluados`);
console.log(`(0-0: ${lowScoreData.filter(d=>d.a===0&&d.b===0).length} | 1-0: ${lowScoreData.filter(d=>d.a===1&&d.b===0).length} | 0-1: ${lowScoreData.filter(d=>d.a===0&&d.b===1).length} | 1-1: ${lowScoreData.filter(d=>d.a===1&&d.b===1).length})`);

// Grid search de ρ minimizando log-likelihood negativo
let best = { rho: null, ll: -Infinity };
const results = [];

for (let rho = -0.30; rho <= 0.005; rho += 0.005) {
  const r = Math.round(rho * 1000) / 1000;
  let ll = 0, valid = true;
  for (const { a, b, lambda, mu } of lowScoreData) {
    const tau = dcTau(a, b, lambda, mu, r);
    if (tau <= 0) { valid = false; break; }
    ll += Math.log(tau);
  }
  if (!valid) continue;
  results.push({ rho: r, ll });
  if (ll > best.ll) best = { rho: r, ll };
}

console.log("\n=== MLE para DC_RHO ===");
console.log("rho    | log-lik  | nota");
for (const r of results) {
  const mark = Math.abs(r.rho - (-0.13)) < 0.001 ? " <- antes" : r.rho === best.rho ? " <- optimo" : "";
  console.log(`  ${r.rho.toFixed(3)} | ${r.ll.toFixed(3).padStart(8)} |${mark}`);
}

console.log(`\nOptimo  : ρ = ${best.rho.toFixed(3)}  (log-lik = ${best.ll.toFixed(3)})`);
console.log(`Anterior: ρ = -0.130`);
console.log(`Diferencia: ${((best.ll - results.find(r=>Math.abs(r.rho-(-0.13))<0.001)?.ll) ?? 0).toFixed(3)} log-lik`);
