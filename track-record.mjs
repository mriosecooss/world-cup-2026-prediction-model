#!/usr/bin/env node
// Track record en vivo 2026 — regenera la sección "📊 Track record en vivo" del README.md a partir de
// data/wc2026-results.json (partidos terminados) + los ratings congelados del torneo.
//   node track-record.mjs
//
// NOTA DE HONESTIDAD: los ratings quedan congelados para todo el torneo (sin recalibrar a mitad
// de camino), así que las probabilidades de abajo son exactamente lo que dijo el modelo ANTES de
// cada partido — recalcularlas después da los mismos números. Se muestran todos los pronósticos,
// aciertos y errores por igual.
import { readFileSync, writeFileSync } from "node:fs";
import { matchProb, matchProbSPI, matchProbBlended } from "./elo.mjs";
import { SLUG_TO_NAME_ES } from "./constants.mjs";

const nameEs = (slug, fallback) => SLUG_TO_NAME_ES[slug] ?? fallback;
const D = (f) => new URL(`./data/${f}`, import.meta.url);
const { ratings } = JSON.parse(readFileSync(D("elo-calibrated.json"), "utf8"));
const { ratings: spiR } = JSON.parse(readFileSync(D("spi-ratings.json"), "utf8"));
const SPI_WEIGHT = 0.65;
const { updated, matches } = JSON.parse(readFileSync(D("wc2026-results.json"), "utf8"));

const HOST = new Set(["mexico", "usa", "canada"]);
const HOME_ADV = 75;
const rps3 = (p, y) => 0.5 * ((p[0] - y[0]) ** 2 + (p[0] + p[1] - y[0] - y[1]) ** 2);

let lines = [];
let hits = 0, n = 0, rpsSum = 0;

for (const m of matches) {
  const ra = ratings[m.t1], rb = ratings[m.t2];
  if (ra == null || rb == null) continue;
  const hb = (HOST.has(m.t1) ? HOME_ADV : 0) - (HOST.has(m.t2) ? HOME_ADV : 0);
  let p;
  if (spiR[m.t1] && spiR[m.t2]) {
    const sA = spiR[m.t1], sB = spiR[m.t2];
    const eloResult = matchProb(ra, rb, hb);
    const spiResult = matchProbSPI(sA.attack, sB.defense, sB.attack, sA.defense, hb, 1.0);
    p = matchProbBlended(eloResult, spiResult, SPI_WEIGHT);
  } else {
    p = matchProb(ra, rb, hb);
  }
  const probs = [p.winA, p.draw, p.winB];
  const actual = m.g1 > m.g2 ? 0 : m.g1 < m.g2 ? 2 : 1;
  const y = [actual === 0 ? 1 : 0, actual === 1 ? 1 : 0, actual === 2 ? 1 : 0];
  const pick = probs.indexOf(Math.max(...probs));
  const hit = pick === actual;
  if (hit) hits++;
  n++;
  rpsSum += rps3(probs, y);
  const team1Es = nameEs(m.t1, m.team1);
  const team2Es = nameEs(m.t2, m.team2);
  const pickLabel = pick === 0 ? team1Es : pick === 2 ? team2Es : "Empate";
  const pickPct = Math.round(probs[pick] * 100);
  const score = `${m.g1}–${m.g2}${m.status === "PEN" ? ` (${m.pens1}–${m.pens2} p)` : m.status === "AET" ? " prórroga" : ""}`;
  lines.push(`| ${m.date} | ${team1Es} ${score} ${team2Es} | ${pickLabel} ${pickPct}% | ${hit ? "✅" : "❌"} |`);
}

const stamp = (updated ?? new Date().toISOString()).slice(0, 10);
const body = n === 0
  ? `_El torneo arrancó el **11 de junio** — esta tabla se completa automáticamente a medida que terminan los partidos. Vuelve después de la primera jornada._`
  : [
      `**${hits}/${n} pronósticos correctos (${Math.round((hits / n) * 100)}%) · RPS promedio ${(rpsSum / n).toFixed(3)}** (cara o sello ≈ 0.245) · actualizado ${stamp}`,
      ``,
      `| Fecha | Resultado | Pronóstico del modelo | |`,
      `|---|---|---|---|`,
      ...lines.reverse(), // más recientes primero
      ``,
      `_Se muestran todos los pronósticos — aciertos y errores. Las probabilidades son los números congelados del modelo antes de cada partido (los ratings no se recalibran a mitad de torneo), así que nada acá está ajustado en retrospectiva. Reprodúcelo con \`node track-record.mjs\`._`
    ].join("\n");

const section = `<!-- TRACK-RECORD:START -->\n${body}\n<!-- TRACK-RECORD:END -->`;
const readme = readFileSync(new URL("./README.md", import.meta.url), "utf8");
if (!readme.includes("<!-- TRACK-RECORD:START -->")) {
  console.error("✗ Al README le faltan los marcadores TRACK-RECORD"); process.exit(1);
}
writeFileSync(new URL("./README.md", import.meta.url),
  readme.replace(/<!-- TRACK-RECORD:START -->[\s\S]*?<!-- TRACK-RECORD:END -->/, section));
console.log(`✓ Track record del README actualizado — ${n} partido(s) terminado(s)${n ? `, ${hits}/${n} correctos` : ""}.`);
