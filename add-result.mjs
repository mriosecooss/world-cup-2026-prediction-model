#!/usr/bin/env node
// Agrega un resultado WC2026 a data/wc2026-results.json y muestra el track record actualizado.
//
// USO:
//   node add-result.mjs <equipo1> <equipo2> <goles1> <goles2>
//   node add-result.mjs brasil marruecos 2 1
//   node add-result.mjs espana alemania 1 1 --aet
//   node add-result.mjs argentina francia 3 3 --pens=4-2
//   node add-result.mjs brasil marruecos 2 1 --date=2026-06-14 --group="Group E" --round="Matchday 2"
//
// Con --dry solo muestra lo que agregaría sin escribir nada.

import { readFileSync, writeFileSync } from "node:fs";
import { matchProb } from "./elo.mjs";

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
const args  = argv.filter(a => !a.startsWith("--"));
const flags = argv.filter(a => a.startsWith("--"));
const getFlag = (name) => { const f = flags.find(f => f.startsWith(`--${name}=`)); return f ? f.split("=").slice(1).join("=") : null; };
const hasFlag = (name) => flags.includes(`--${name}`);

const [t1, t2, g1str, g2str] = args;
if (!t1 || !t2 || g1str == null || g2str == null) {
  console.log("Uso: node add-result.mjs <equipo1> <equipo2> <goles1> <goles2> [--date=YYYY-MM-DD] [--group=X] [--round=X] [--aet] [--pens=p1-p2] [--dry]");
  console.log("Ejemplo: node add-result.mjs brasil marruecos 2 1");
  process.exit(0);
}

const g1 = parseInt(g1str), g2 = parseInt(g2str);
if (isNaN(g1) || isNaN(g2)) { console.error("Goles deben ser números"); process.exit(1); }
if (!SLUG_TO_NAME[t1]) { console.error(`Equipo desconocido: '${t1}'. Usar slug (ej: brasil → brazil, marruecos → morocco)`); process.exit(1); }
if (!SLUG_TO_NAME[t2]) { console.error(`Equipo desconocido: '${t2}'. Usar slug (ej: brasil → brazil, marruecos → morocco)`); process.exit(1); }

const pens = getFlag("pens");
const [pens1, pens2] = pens ? pens.split("-").map(Number) : [null, null];
const isAET = hasFlag("aet") || pens != null;
const status = pens ? "PEN" : isAET ? "AET" : "FT";
const date = getFlag("date") ?? new Date().toISOString().slice(0, 10);
const group = getFlag("group") ?? "";
const round = getFlag("round") ?? "";

const winner = g1 > g2 ? t1 : g2 > g1 ? t2 : pens1 != null ? (pens1 > pens2 ? t1 : t2) : null;

const entry = {
  date, round, group,
  team1: SLUG_TO_NAME[t1], team2: SLUG_TO_NAME[t2],
  t1, t2, g1, g2,
  pens1: pens1 ?? null, pens2: pens2 ?? null,
  status, winner,
};

console.log("\nResultado a agregar:");
const scoreStr = `${g1}–${g2}${status === "PEN" ? ` (${pens1}–${pens2} pen)` : status === "AET" ? " aet" : ""}`;
console.log(`  ${SLUG_TO_NAME[t1]} ${scoreStr} ${SLUG_TO_NAME[t2]}  [${date}]${group ? "  " + group : ""}${round ? "  " + round : ""}`);

if (hasFlag("dry")) { console.log("\n(--dry activo, no se escribió nada)"); process.exit(0); }

// Cargar y actualizar
const D = (f) => new URL(`./data/${f}`, import.meta.url);
const db = JSON.parse(readFileSync(D("wc2026-results.json"), "utf8"));

// Verificar duplicado
const dup = db.matches.find(m => m.t1 === t1 && m.t2 === t2 && m.date === date);
if (dup) {
  console.error(`\nERROR: ya existe ${SLUG_TO_NAME[t1]} vs ${SLUG_TO_NAME[t2]} el ${date}. Usa --date= si es otro partido.`);
  process.exit(1);
}

db.matches.push(entry);
db.updated = new Date().toISOString();
writeFileSync(D("wc2026-results.json"), JSON.stringify(db, null, 1) + "\n");
console.log(`\n✓ Guardado. Total partidos: ${db.matches.length}`);

// Track record rápido
const { ratings } = JSON.parse(readFileSync(D("elo-calibrated.json"), "utf8"));
const HOST = new Set(["mexico", "usa", "canada"]);
const HOME_ADV = 75;
const rps3 = (p, y) => 0.5 * ((p[0]-y[0])**2 + (p[0]+p[1]-y[0]-y[1])**2);
let hits = 0, n = 0, rpsSum = 0;
for (const m of db.matches) {
  const ra = ratings[m.t1], rb = ratings[m.t2];
  if (!ra || !rb) continue;
  const hb = (HOST.has(m.t1) ? HOME_ADV : 0) - (HOST.has(m.t2) ? HOME_ADV : 0);
  const p = matchProb(ra, rb, hb);
  const probs = [p.winA, p.draw, p.winB];
  const actual = m.g1 > m.g2 ? 0 : m.g1 < m.g2 ? 2 : 1;
  const y = [actual===0?1:0, actual===1?1:0, actual===2?1:0];
  const pick = probs.indexOf(Math.max(...probs));
  if (pick === actual) hits++;
  rpsSum += rps3(probs, y);
  n++;
}
console.log(`\nTrack record WC2026: ${hits}/${n} correctos (${Math.round(hits/n*100)}%)  avg RPS ${(rpsSum/n).toFixed(3)}`);
