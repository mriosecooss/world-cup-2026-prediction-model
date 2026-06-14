// Nucleo compartido de prediccion: xG blended (Elo+SPI+Pi) con squad adj (ataque y defensa) y MV boost.
// Importar en bet-ev.mjs y stake.mjs para garantizar paridad con predict.mjs.
import { readFileSync, existsSync } from 'node:fs';
import { matchProb, matchProbSPI, matchProbBlended, matchProbBlended3 } from './elo.mjs';
import { squadAdjustment } from './squad-strength.mjs';
import { marketValueBoost } from './squad-market-value.mjs';

const D = (f) => new URL(`./data/${f}`, import.meta.url);
export const spiR = JSON.parse(readFileSync(D('spi-ratings.json'), 'utf8')).ratings;
const piFile = D('pi-ratings.json');
export const piR = existsSync(piFile) ? JSON.parse(readFileSync(piFile, 'utf8')).ratings : null;

const SPI_WEIGHT = 0.65;

/**
 * xG blended (Elo+SPI+Pi) con squad adj (ataque y defensa) y market value boost.
 * @param {number} eloBase_A  - Rating Elo base de equipo A (sin squad adj, lo aplica internamente).
 * @param {number} eloBase_B
 * @param {string} teamA      - Slug equipo A (usado para squad adj + MV lookup).
 * @param {string} teamB
 * @param {object} opts
 * @param {number}  opts.hb           - Home bonus en puntos Elo (positivo = teamA es local).
 * @param {number}  opts.contextMult  - Multiplicador venue x phase (default 1.0).
 * @param {boolean} opts.useSquad     - Aplicar squad adjustment (default true).
 * @param {boolean} opts.useMV        - Aplicar market value boost (default true).
 * @param {boolean} opts.usePi        - Incluir Pi-rating en blend si disponible (default true).
 * @returns {{ home, away, winA, draw, winB, sqA, sqB, mvA, mvB }}
 */
export function matchBlendedXg(eloBase_A, eloBase_B, teamA, teamB, {
  hb = 0,
  contextMult = 1.0,
  useSquad = true,
  useMV    = true,
  usePi    = true,
} = {}) {
  const sqA = squadAdjustment(teamA);
  const sqB = squadAdjustment(teamB);
  const mvA = marketValueBoost(teamA);
  const mvB = marketValueBoost(teamB);

  const eloA = eloBase_A + (useSquad ? sqA.adjustment : 0);
  const eloB = eloBase_B + (useSquad ? sqB.adjustment : 0);

  const eloResult = matchProb(eloA, eloB, hb);
  let blended = eloResult;

  if (spiR[teamA] && spiR[teamB]) {
    const sA = spiR[teamA], sB = spiR[teamB];
    const sqAttA    = useSquad ? sqA.attack_ratio   : 1;
    const sqAttB    = useSquad ? sqB.attack_ratio   : 1;
    const sqDefMultA = useSquad ? (2 - sqA.defense_ratio) : 1;
    const sqDefMultB = useSquad ? (2 - sqB.defense_ratio) : 1;
    const mvBoostA  = useMV ? mvA.boost : 1;
    const mvBoostB  = useMV ? mvB.boost : 1;

    const spiResult = matchProbSPI(
      sA.attack * sqAttA * mvBoostA, sB.defense * sqDefMultB,
      sB.attack * sqAttB * mvBoostB, sA.defense * sqDefMultA,
      hb, contextMult
    );

    if (usePi && piR && piR[teamA] != null && piR[teamB] != null) {
      blended = matchProbBlended3(eloResult, spiResult, matchProb(piR[teamA], piR[teamB], hb));
    } else {
      blended = matchProbBlended(eloResult, spiResult, SPI_WEIGHT);
    }
  }

  return {
    home: blended.expectedGoalsA,
    away: blended.expectedGoalsB,
    winA: blended.winA,
    draw: blended.draw,
    winB: blended.winB,
    sqA, sqB, mvA, mvB,
  };
}
