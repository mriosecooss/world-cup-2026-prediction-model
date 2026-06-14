// Multiplicador de presión de torneo por equipo y fase.
// Combina: historial mundialista (profundidad de campañas, apariciones consecutivas)
// + calidad del entrenador (años con el equipo, pedigree en partidos de alta presión).
// Referencia: Goldman Sachs WC2026 model menciona "mentality" (campeones defensores
// rinden por debajo en siguiente torneo); Syracuse Univ. model: "veteran vs first-time coach".
import { readFileSync } from 'node:fs';

const data = JSON.parse(
  readFileSync(new URL('./data/pressure-context.json', import.meta.url), 'utf8')
);

// Retorna el multiplicador de presión para attack del equipo según la fase.
// phase: 'group' | 'round-of-32' | 'round-of-16' | 'quarterfinal' | 'semifinal' | 'final'
export function pressureBoost(teamSlug, phase = 'group') {
  const t = data.teams[teamSlug];
  if (!t) return 1.0;
  const isKnockout = phase !== 'group' && phase !== 'round-of-32';
  return isKnockout ? (t.knockout_mult ?? 1.0) : (t.group_mult ?? 1.0);
}

export function getCoachNote(teamSlug) {
  return data.teams[teamSlug]?.coach ?? null;
}

// CLI: node pressure-context.mjs [equipos...]
const isMain = process.argv[1]?.endsWith('pressure-context.mjs');
if (isMain) {
  const teams = process.argv.slice(2).length
    ? process.argv.slice(2)
    : Object.keys(data.teams);
  console.log(`\n  ${'Equipo'.padEnd(28)} ${'Grupo'.padStart(6)}  ${'KO'.padStart(6)}  Coach`);
  console.log(`  ${'-'.repeat(72)}`);
  for (const t of teams) {
    const d = data.teams[t];
    if (!d) { console.log(`  ${t}: sin datos`); continue; }
    console.log(`  ${t.padEnd(28)} ${String(d.group_mult).padStart(6)}  ${String(d.knockout_mult).padStart(6)}  ${d.coach}`);
  }
}
