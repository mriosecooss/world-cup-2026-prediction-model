#!/usr/bin/env node
// Live 2026 track record — regenerates the "📊 Live track record" section of README.md from
// data/wc2026-results.json (finished matches) + the model's frozen tournament ratings.
//   node track-record.mjs
//
// HONESTY NOTE: the ratings are frozen for the whole tournament (no mid-tournament re-fit),
// so the probabilities below are exactly what the model said BEFORE each match — recomputing
// them after the fact gives the same numbers. Every call is shown, hits and misses alike.
import { readFileSync, writeFileSync } from "node:fs";
import { matchProb, matchProbSPI, matchProbBlended } from "./elo.mjs";

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
  const pickLabel = pick === 0 ? m.team1 : pick === 2 ? m.team2 : "Draw";
  const pickPct = Math.round(probs[pick] * 100);
  const score = `${m.g1}–${m.g2}${m.status === "PEN" ? ` (${m.pens1}–${m.pens2} p)` : m.status === "AET" ? " aet" : ""}`;
  lines.push(`| ${m.date} | ${m.team1} ${score} ${m.team2} | ${pickLabel} ${pickPct}% | ${hit ? "✅" : "❌"} |`);
}

const stamp = (updated ?? new Date().toISOString()).slice(0, 10);
const body = n === 0
  ? `_The tournament kicked off **Jun 11** — this table fills in automatically as matches finish. Check back after the first matchday._`
  : [
      `**${hits}/${n} correct picks (${Math.round((hits / n) * 100)}%) · avg RPS ${(rpsSum / n).toFixed(3)}** (coin-flip ≈ 0.245) · updated ${stamp}`,
      ``,
      `| Date | Result | Model's pick | |`,
      `|---|---|---|---|`,
      ...lines.reverse(), // newest first
      ``,
      `_Every call is listed — hits and misses. Probabilities are the model's frozen pre-match numbers (ratings don't re-fit mid-tournament), so nothing here is retro-fitted. Reproduce with \`node track-record.mjs\`._`
    ].join("\n");

const section = `<!-- TRACK-RECORD:START -->\n${body}\n<!-- TRACK-RECORD:END -->`;
const readme = readFileSync(new URL("./README.md", import.meta.url), "utf8");
if (!readme.includes("<!-- TRACK-RECORD:START -->")) {
  console.error("✗ README is missing the TRACK-RECORD markers"); process.exit(1);
}
writeFileSync(new URL("./README.md", import.meta.url),
  readme.replace(/<!-- TRACK-RECORD:START -->[\s\S]*?<!-- TRACK-RECORD:END -->/, section));
console.log(`✓ README track record updated — ${n} finished match(es)${n ? `, ${hits}/${n} correct` : ""}.`);
