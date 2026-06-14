// Calculates an Elo adjustment based on player availability.
// Each key player has an elo_impact; missing players reduce the team's effective Elo.
// v2: adds attack_ratio and defense_ratio split by position (FW/MF/DF/GK).
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('./data/players.json', import.meta.url), 'utf8'));

// How much each position contributes to the attack vs defense pools.
function posWeights(pos) {
  switch (pos) {
    case 'FW': return { att: 1.0, def: 0.0 };
    case 'MF': return { att: 0.5, def: 0.5 };
    case 'DF': return { att: 0.0, def: 1.0 };
    case 'GK': return { att: 0.0, def: 1.0 };
    default:   return { att: 0.5, def: 0.5 };
  }
}

export function squadAdjustment(teamSlug) {
  const team = data.teams[teamSlug];
  if (!team) return { adjustment: 0, ratio: 1, attack_ratio: 1, defense_ratio: 1, available: [], missing: [], hasData: false };

  const players = team.players;
  const totalImpact   = players.reduce((s, p) => s + p.elo_impact, 0);
  const missingImpact = players.filter(p => !p.available).reduce((s, p) => s + p.elo_impact, 0);

  let attPool = 0, defPool = 0, missingAtt = 0, missingDef = 0;
  for (const p of players) {
    const w = posWeights(p.pos);
    attPool += p.elo_impact * w.att;
    defPool += p.elo_impact * w.def;
    if (!p.available) {
      missingAtt += p.elo_impact * w.att;
      missingDef += p.elo_impact * w.def;
    }
  }

  const ratio         = totalImpact > 0 ? 1 - missingImpact / totalImpact : 1;
  const attack_ratio  = attPool  > 0 ? 1 - missingAtt  / attPool  : 1;
  const defense_ratio = defPool  > 0 ? 1 - missingDef  / defPool  : 1;

  return {
    adjustment: Math.round(-missingImpact),
    ratio:          parseFloat(ratio.toFixed(3)),
    attack_ratio:   parseFloat(attack_ratio.toFixed(3)),
    defense_ratio:  parseFloat(defense_ratio.toFixed(3)),
    available: players.filter(p => p.available).map(p => p.name),
    missing:   players.filter(p => !p.available).map(p => ({ name: p.name, impact: p.elo_impact })),
    totalImpact,
    missingImpact,
    hasData: true,
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
    console.log(`  Ratio total           : ${(s.ratio * 100).toFixed(1)}%`);
    console.log(`  Ratio ataque          : ${(s.attack_ratio * 100).toFixed(1)}%`);
    console.log(`  Ratio defensa         : ${(s.defense_ratio * 100).toFixed(1)}%`);
    if (s.missing.length) {
      console.log(`  Bajas:`);
      s.missing.forEach(p => console.log(`    - ${p.name} (impacto: -${p.impact})`));
    } else {
      console.log(`  Sin bajas registradas.`);
    }
  }
}
