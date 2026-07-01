// Constantes compartidas — fuente única para evitar duplicación entre scripts.
import { readFileSync, writeFileSync } from 'node:fs';

// Escribe JSON solo si el contenido SUSTANTIVO cambió (ignorando campos de timestamp).
// Evita que correr un script sin cambios reales ensucie git con un timestamp nuevo.
// Devuelve true si escribió, false si lo dejó intacto.
export function writeStableJSON(url, obj, { indent = 2, timestampKeys = ['generatedAt', 'calibratedAt', 'updated', 'wcResultsUpdated'] } = {}) {
  const strip = (o) => { const c = { ...o }; for (const k of timestampKeys) delete c[k]; return JSON.stringify(c); };
  try {
    const prev = JSON.parse(readFileSync(url, 'utf8'));
    if (strip(prev) === strip(obj)) return false; // sin cambios sustantivos → no reescribir
  } catch { /* archivo nuevo */ }
  writeFileSync(url, JSON.stringify(obj, null, indent) + '\n');
  return true;
}

// Anfitriones WC2026 y bonus de localía (Elo).
export const HOST = new Set(['mexico', 'usa', 'canada']);
export const HOME_ADV = 75;

// K-factor por importancia de competición (valores de producción).
// Fuente única para calibrate, backtest, calibrate-blend, calibrate-rho.
export function baseK(leagueName = '') {
  const n = (leagueName || '').toLowerCase();
  if (/world cup(?!.*qual)/.test(n) || /fifa world cup/.test(n)) return 60;
  if (/world cup.*qual|qualification/.test(n)) return 42;
  if (/copa america|euro championship\b|african cup|asian cup|gold cup|afcon/.test(n)) return 52;
  if (/nations league|nations cup/.test(n)) return 34;
  if (/friendl/.test(n)) return 16;
  return 28;
}

// Multiplicador por margen de goles (goleadas mueven más el Elo).
export const gMult = (gd) => { const d = Math.abs(gd); return d <= 1 ? 1 : d === 2 ? 1.5 : (11 + d) / 8; };

// Distribución empírica de goles por bloque de 15 minutos (normalizada: suma rates = 6.0).
// Fuente: análisis de ~200k goles mostrando el repunte tardío. Usado por halftime.mjs y nextgoal.mjs.
// Bloques CONTINUOS [from, to): rateIntegral(0,90) = 15 × 6.0 = 90 exacto.
export const RATE_BLOCKS = [
  { from:  0, to: 15, rate: 0.714 },  // arranque lento
  { from: 15, to: 30, rate: 0.876 },
  { from: 30, to: 45, rate: 1.048 },  // empuje primer tiempo
  { from: 45, to: 60, rate: 0.790 },  // segundo tiempo cauto
  { from: 60, to: 75, rate: 1.067 },
  { from: 75, to: 90, rate: 1.505 },  // empuje final (+50% vs promedio)
];

// Integral de la tasa goleadora entre dos minutos.
export function rateIntegral(fromMin, toMin = 90) {
  let w = 0;
  for (const b of RATE_BLOCKS) {
    const s = Math.max(fromMin, b.from);
    const e = Math.min(toMin, b.to);
    if (e > s) w += (e - s) * b.rate;
  }
  return w;
}

// Mapa slug → nombre display. Usado por add-result.mjs y halftime.mjs.
export const SLUG_TO_NAME = {
  argentina: 'Argentina', france: 'France', spain: 'Spain', brazil: 'Brazil',
  england: 'England', portugal: 'Portugal', netherlands: 'Netherlands', germany: 'Germany',
  belgium: 'Belgium', italy: 'Italy', colombia: 'Colombia', uruguay: 'Uruguay',
  croatia: 'Croatia', morocco: 'Morocco', switzerland: 'Switzerland', usa: 'USA',
  mexico: 'Mexico', japan: 'Japan', senegal: 'Senegal', denmark: 'Denmark',
  ecuador: 'Ecuador', australia: 'Australia', 'south-korea': 'South Korea',
  iran: 'Iran', poland: 'Poland', canada: 'Canada', serbia: 'Serbia',
  wales: 'Wales', ghana: 'Ghana', tunisia: 'Tunisia', 'ivory-coast': 'Ivory Coast',
  nigeria: 'Nigeria', 'saudi-arabia': 'Saudi Arabia', qatar: 'Qatar', egypt: 'Egypt',
  algeria: 'Algeria', scotland: 'Scotland', cameroon: 'Cameroon', paraguay: 'Paraguay',
  venezuela: 'Venezuela', chile: 'Chile', peru: 'Peru', 'czech-republic': 'Czech Republic',
  'bosnia-and-herzegovina': 'Bosnia & Herzegovina', 'south-africa': 'South Africa',
  'new-zealand': 'New Zealand', panama: 'Panama', jamaica: 'Jamaica', honduras: 'Honduras',
  jordan: 'Jordan', haiti: 'Haiti', 'el-salvador': 'El Salvador',
  'trinidad-and-tobago': 'Trinidad & Tobago', guatemala: 'Guatemala',
  norway: 'Norway', sweden: 'Sweden', austria: 'Austria', turkey: 'Turkey',
  uzbekistan: 'Uzbekistan', iraq: 'Iraq', 'dr-congo': 'DR Congo',
  'cape-verde': 'Cape Verde', curacao: 'Curacao',
};

// Mapa slug → nombre en español. Usado por track-record.mjs para generar la tabla del README.
export const SLUG_TO_NAME_ES = {
  argentina: 'Argentina', france: 'Francia', spain: 'España', brazil: 'Brasil',
  england: 'Inglaterra', portugal: 'Portugal', netherlands: 'Países Bajos', germany: 'Alemania',
  belgium: 'Bélgica', italy: 'Italia', colombia: 'Colombia', uruguay: 'Uruguay',
  croatia: 'Croacia', morocco: 'Marruecos', switzerland: 'Suiza', usa: 'Estados Unidos',
  mexico: 'México', japan: 'Japón', senegal: 'Senegal', denmark: 'Dinamarca',
  ecuador: 'Ecuador', australia: 'Australia', 'south-korea': 'Corea del Sur',
  iran: 'Irán', poland: 'Polonia', canada: 'Canadá', serbia: 'Serbia',
  wales: 'Gales', ghana: 'Ghana', tunisia: 'Túnez', 'ivory-coast': 'Costa de Marfil',
  nigeria: 'Nigeria', 'saudi-arabia': 'Arabia Saudita', qatar: 'Catar', egypt: 'Egipto',
  algeria: 'Argelia', scotland: 'Escocia', cameroon: 'Camerún', paraguay: 'Paraguay',
  venezuela: 'Venezuela', chile: 'Chile', peru: 'Perú', 'czech-republic': 'República Checa',
  'bosnia-and-herzegovina': 'Bosnia y Herzegovina', 'south-africa': 'Sudáfrica',
  'new-zealand': 'Nueva Zelanda', panama: 'Panamá', jamaica: 'Jamaica', honduras: 'Honduras',
  jordan: 'Jordania', haiti: 'Haití', 'el-salvador': 'El Salvador',
  'trinidad-and-tobago': 'Trinidad y Tobago', guatemala: 'Guatemala',
  norway: 'Noruega', sweden: 'Suecia', austria: 'Austria', turkey: 'Turquía',
  uzbekistan: 'Uzbekistán', iraq: 'Irak', 'dr-congo': 'RD Congo',
  'cape-verde': 'Cabo Verde', curacao: 'Curazao',
};
