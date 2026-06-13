// Calculates an Elo adjustment based on player availability.
// Each key player has an elo_impact; missing players reduce the team's effective Elo.
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('./data/players.json', import.meta.url), 'utf8'));

export function squadAdjustment(teamSlug) {
  const team = data.teams[teamSlug];
  if (!team) return { adjustment: 0, available: [], missing: [], ratio: 1 };

  const totalImpact = team.players.reduce((s, p) => s + p.elo_impact, 0);
  const missingImpact = team.players.filter(p => !p.available).reduce((s, p) => s + p.elo_impact, 0);
  const ratio = totalImpact > 0 ? 1 - (missingImpact / totalImpact) : 1;

  // Adjustment scales the Elo impact: full squad = 0, all missing = -totalImpact
  const adjustment = -missingImpact;

  return {
    adjustment: Math.round(adjustment),
    ratio: parseFloat(ratio.toFixed(3)),
    available: team.players.filter(p => p.available).map(p => p.name),
    missing: team.players.filter(p => !p.available).map(p => ({ name: p.name, impact: p.elo_impact })),
    totalImpact,
    missingImpact,
  };
}

export function adjustedElo(baseElo, teamSlug) {
  const { adjustment } = squadAdjustment(teamSlug);
  return baseElo + adjustment;
}

// CLI: node squad-strength.mjs usa paraguay
const isMain = process.argv[1]?.endsWith('squad-strength.mjs');
if (isMain && process.argv[2]) {
  for (const slug of process.argv.slice(2)) {
    const s = squadAdjustment(slug);
    console.log(`\n${slug.toUpperCase()}`);
    console.log(`  Jugadores disponibles : ${s.available.length}`);
    console.log(`  Ajuste Elo            : ${s.adjustment >= 0 ? '+' : ''}${s.adjustment}`);
    console.log(`  Ratio fuerza          : ${(s.ratio * 100).toFixed(1)}%`);
    if (s.missing.length) {
      console.log(`  Bajas:`);
      s.missing.forEach(p => console.log(`    - ${p.name} (impacto: -${p.impact})`));
    } else {
      console.log(`  Sin bajas registradas.`);
    }
  }
}
