// Market-value boost for SPI attack parameter.
// Fuente: Transfermarkt squad values (€M) para los 48 equipos WC2026.
// Lógica: equipos con planteles más valiosos tienen mayor potencial ofensivo
// que el que capturan sus parámetros SPI históricos (señal más actual y densa).
// Referencia: Goldman Sachs WC2026 model usa "top scorers en ligas europeas" como
// proxy de calidad ofensiva; aquí usamos valor de mercado total del plantel.
import { readFileSync } from 'node:fs';

const { median_mv, ratings } = JSON.parse(
  readFileSync(new URL('./data/squad-values.json', import.meta.url), 'utf8')
);

const EXPONENT  = 0.05;   // curva suave: France +10%, Qatar -11%, media neutral
const CLAMP_MIN = 0.85;
const CLAMP_MAX = 1.20;

export function marketValueBoost(teamSlug) {
  const mv = ratings[teamSlug];
  if (mv == null) return { boost: 1.0, value_meur: null, hasData: false };
  const raw   = Math.pow(mv / median_mv, EXPONENT);
  const boost = Math.max(CLAMP_MIN, Math.min(CLAMP_MAX, raw));
  return { boost, value_meur: mv, hasData: true };
}

// CLI: node squad-market-value.mjs france qatar
const isMain = process.argv[1]?.endsWith('squad-market-value.mjs');
if (isMain) {
  const teams = process.argv.slice(2).length ? process.argv.slice(2)
    : Object.keys(ratings).sort((a, b) => ratings[b] - ratings[a]);
  console.log(`\n  ${'Equipo'.padEnd(28)} ${'Valor €M'.padStart(10)}  ${'Boost'.padStart(8)}`);
  console.log(`  ${'-'.repeat(52)}`);
  for (const t of teams) {
    const { boost, value_meur } = marketValueBoost(t);
    const mv = value_meur != null ? value_meur.toFixed(1).padStart(10) : '       N/A';
    const bo = `×${boost.toFixed(3)}`.padStart(8);
    console.log(`  ${t.padEnd(28)} ${mv}  ${bo}`);
  }
}
