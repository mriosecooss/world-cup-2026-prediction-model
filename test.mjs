#!/usr/bin/env node
// Suite de tests del modelo — invariantes matemáticos y consistencia de datos.
//   node test.mjs   (o: npm test)
// Exit 0 = todo pasa, exit 1 = algún fallo.
import { readFileSync } from 'node:fs';
import {
  matchProb, matchProbSPI, matchProbBlended,
  poissonPmf, dcTau, expectedGoals, expectedScore, DC_RHO,
} from './elo.mjs';
import { baseK, gMult, rateIntegral, SLUG_TO_NAME, HOST, HOME_ADV } from './constants.mjs';

const D = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), 'utf8'));

let pass = 0, fail = 0;
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
function check(name, cond, detail = '') {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ''}`); }
}

// ---- Invariantes de probabilidad ----
{
  const r = matchProb(1900, 1700, 75);
  check('matchProb suma 1', approx(r.winA + r.draw + r.winB, 1, 1e-9), `suma=${r.winA + r.draw + r.winB}`);
  check('matchProb probs en [0,1]', [r.winA, r.draw, r.winB].every(p => p >= 0 && p <= 1));
  check('matchProb favorito gana más', r.winA > r.winB, `winA=${r.winA.toFixed(3)} winB=${r.winB.toFixed(3)}`);
}
{
  const r = matchProbSPI(1.8, 0.9, 1.1, 0.8, 0, 1.0);
  check('matchProbSPI suma 1', approx(r.winA + r.draw + r.winB, 1, 1e-9));
}
{
  const elo = matchProb(1900, 1700, 0);
  const spi = matchProbSPI(1.5, 1.0, 1.0, 1.0, 0, 1.0);
  const b = matchProbBlended(elo, spi, 0.65);
  check('matchProbBlended suma 1', approx(b.winA + b.draw + b.winB, 1, 1e-9));
  check('blend es interpolación', b.winA >= Math.min(elo.winA, spi.winA) - 1e-9 && b.winA <= Math.max(elo.winA, spi.winA) + 1e-9);
}

// ---- Poisson / Dixon-Coles ----
{
  let s = 0; for (let k = 0; k <= 30; k++) s += poissonPmf(k, 1.5);
  check('poissonPmf suma ~1', approx(s, 1, 1e-6), `suma=${s}`);
  check('poissonPmf(0,λ)=e^-λ', approx(poissonPmf(0, 2.0), Math.exp(-2.0)));
  check('poissonPmf no negativo', poissonPmf(5, 0) === 0);
}
{
  // τ debe ser positivo para λ,μ típicos con el ρ calibrado
  const lambdas = [0.5, 1.0, 1.5, 2.5], rho = DC_RHO;
  let allPos = true;
  for (const l of lambdas) for (const m of lambdas)
    for (const [a, b] of [[0,0],[0,1],[1,0],[1,1]])
      if (dcTau(a, b, l, m, rho) <= 0) allPos = false;
  check('dcTau positivo en rango típico', allPos);
  check('dcTau=1 fuera de marcadores bajos', dcTau(2, 3, 1.5, 1.5, rho) === 1);
}

// ---- expectedGoals clamp ----
{
  check('expectedGoals clamp inferior', expectedGoals(1000, 2500, 0) >= 0.3);
  check('expectedGoals clamp superior', expectedGoals(2500, 1000, 0) <= 3.5);
  check('expectedScore simétrico', approx(expectedScore(1800, 1800, 0), 0.5));
}

// ---- baseK / gMult / rateIntegral ----
{
  check('baseK World Cup = 60', baseK('FIFA World Cup') === 60);
  check('baseK qualification = 42', baseK('World Cup Qualification') === 42);
  check('baseK friendly = 16', baseK('Friendlies') === 16);
  check('baseK default = 28', baseK('Some Random Cup') === 28);
  check('gMult empate/1gol = 1', gMult(0) === 1 && gMult(1) === 1 && gMult(-1) === 1);
  check('gMult 2 goles = 1.5', gMult(2) === 1.5);
  check('gMult crece con margen', gMult(5) > gMult(3));
  check('rateIntegral(0,90) = 90', approx(rateIntegral(0, 90), 90, 1e-9), `=${rateIntegral(0, 90)}`);
  check('rateIntegral parcial < total', rateIntegral(46, 90) < rateIntegral(0, 90));
  check('rateIntegral 2H pesa más que 1H', rateIntegral(45, 90) > rateIntegral(0, 45));
}

// ---- EV (la fórmula del sistema de apuestas) ----
{
  const prob = 0.30, cuota = 3.90;
  const ev = prob * cuota - 1;
  check('EV cálculo correcto', approx(ev, 0.17), `ev=${ev}`);
  check('EV negativo si prob baja', 0.20 * 3.90 - 1 < 0);
}

// ---- Consistencia de datos ----
{
  const seed = D('seed-ratings.json').seed;
  const elo = D('elo-calibrated.json').ratings;
  const spi = D('spi-ratings.json').ratings;

  const seedSlugs = Object.keys(seed);
  check('seed: todos los slugs en SLUG_TO_NAME',
    seedSlugs.every(s => SLUG_TO_NAME[s]),
    seedSlugs.filter(s => !SLUG_TO_NAME[s]).join(','));
  check('elo: todos los equipos tienen seed',
    Object.keys(elo).every(s => seed[s] != null),
    Object.keys(elo).filter(s => seed[s] == null).join(','));
  check('spi: todos los equipos tienen Elo',
    Object.keys(spi).every(s => elo[s] != null),
    Object.keys(spi).filter(s => elo[s] == null).join(','));
  check('spi: attack/defense > 0',
    Object.values(spi).every(r => r.attack > 0 && r.defense > 0));
  check('HOST ⊂ slugs conocidos', [...HOST].every(s => SLUG_TO_NAME[s]));
  check('HOME_ADV razonable', HOME_ADV > 0 && HOME_ADV < 200);
}

// ---- Resultados WC2026 bien formados ----
{
  const wc = D('wc2026-results.json');
  const elo = D('elo-calibrated.json').ratings;
  check('wc2026: slugs t1/t2 conocidos',
    wc.matches.every(m => elo[m.t1] != null && elo[m.t2] != null),
    wc.matches.filter(m => !elo[m.t1] || !elo[m.t2]).map(m => `${m.t1}/${m.t2}`).join(','));
  check('wc2026: goles no negativos',
    wc.matches.every(m => m.g1 >= 0 && m.g2 >= 0));
}

console.log(`\n${fail === 0 ? '✓ TODOS LOS TESTS PASAN' : '✗ HAY FALLOS'} — ${pass} ok, ${fail} fallidos`);
process.exit(fail === 0 ? 0 : 1);
