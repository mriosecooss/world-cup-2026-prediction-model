# WC2026 Prediction Model — Claude Context

## Entorno
- **Node:** `C:\Program Files\nodejs\node.exe` (no está en PATH, usar ruta completa)
- **Directorio:** `C:\Users\matum\Downloads\world-cup-2026-prediction-model`
- **Correr script:** `& "C:\Program Files\nodejs\node.exe" predict.mjs brasil marruecos`
- **Idioma de respuesta:** siempre español

## Arquitectura del modelo

### Fórmula λ blended
```
Elo:  λ = 1.35 + (EloA − EloB) / 400   [clamped 0.3–3.5]
SPI:  λ = 1.35 × attack_A × defense_B   [clamped 0.3–4.0]
EV  = (prob_modelo × cuota) − 1
1H  = 44% de λ total  |  2H = 56%
```
- Blend 2-way: 35% Elo + 65% SPI (cuando Pi-rating no disponible)
- Blend 3-way: 25% Elo + 45% SPI + 30% Pi-rating (cuando `data/pi-ratings.json` existe)
- Dixon-Coles ρ = −0.075 (calibrado por MLE via `calibrate-rho.mjs`)
- K_FACTOR_WC = 60 (clasificatorias 42, amistosos 16)
- HOME_ADV base = 75 Elo pts. Offsets por equipo en `context.mjs → HOME_ADV_OFFSET`:
  México +20 (95), USA +10 (85), Canadá +5 (80), Argentina/Brazil/France/Germany +5 (80),
  England +8 (83), Japan/South-Korea +12 (87), Iran +10 (85), Senegal +8 (83)
- Squad adj: `attack_ratio` (FW+0.5×MF) sobre alpha SPI; `defense_ratio` (DF+GK+0.5×MF)
  sobre beta SPI como `beta × (2 − defense_ratio)` — más vulnerables cuando faltan defensores
- Half-life por competición: WC 30m | Cups 24m | Nations League 18m | Clasif. 12m | Amistosos 6m

### Archivos clave
| Archivo | Propósito |
|---|---|
| `elo.mjs` | Fórmulas base: `matchProb`, `matchProbSPI`, `matchProbBlended`, `matchProbBlended3`, `poissonPmf`, `dcTau`, `DC_RHO` (exportados) |
| `match-core.mjs` | **Fuente única del blend:** `matchBlendedXg(eloA, eloB, teamA, teamB, opts)` — Elo+SPI+Pi con squad adj (ataque y defensa) y MV boost. Importado por bet-ev y stake |
| `constants.mjs` | Fuente única: `SLUG_TO_NAME`, `RATE_BLOCKS`, `rateIntegral`, `HOST`, `HOME_ADV`, `baseK`, `gMult`, `writeStableJSON` |
| `context.mjs` | `homeBonus(slug, true)`, `HOME_ADV_OFFSET`, `phaseMult`, `venueInfo`, `venueGoalMult`, `heatPenalty` |
| `squad-strength.mjs` | `squadAdjustment(slug)` → `{ adjustment, ratio, attack_ratio, defense_ratio, missing, hasData }` |
| `squad-market-value.mjs` | `marketValueBoost(slug)` → `{ boost, value_meur, hasData }` |
| `fixture.mjs` | Calendario + predicción próximos partidos: `node fixture.mjs --next=8 / --group=C / --all / --live` |
| `test.mjs` | Suite de **73 invariantes** — `npm test` |
| `bet-ev.mjs` | EV de apuestas en bets.json. Flag `--overround=1.06` para edge vs fair market. Usa match-core.mjs |
| `stake.mjs` | Kelly fraccionario + detector correlación. `--overround=N`, `--all`, `--match=X`, `--bankroll=N`. Usa match-core.mjs |
| `bankroll.mjs` | Reconcilia abonos (deposits.json) + apuestas → saldo, P&L y ROI sobre capital propio |
| `predict.mjs` | CLI principal: `node predict.mjs <a> <b> [home] [--venue=X] [--phase=X] [--rest-a=N] [--rest-b=N] [--no-squad] [--no-mv] [--no-pi] [--no-heat] [--no-pressure] [--elo-only] [--live] [--odds=o1,oD,o2]` |
| `halftime.mjs` | Live recalc: `node halftime.mjs <t1> <t2> <g1> <g2> <min> [--home=X]` — Dixon-Coles, squad adj ataque+defensa, MV, Pi-rating, homeBonus, game state, soporte hasta min 120 (prórroga) |
| `calibrate.mjs` | Genera `elo-calibrated.json` desde `results-full.json` |
| `calibrate-spi.mjs` | Genera `spi-ratings.json` |
| `backtest.mjs` | Walk-forward backtest — modelo blended real (spiWeight=0.65) |
| `track-record.mjs` | Mide aciertos en partidos WC2026 ya jugados |
| `update-elo-live.mjs` | Elo incremental con resultados WC2026 (K=20). Usar desde octavos |
| `add-result.mjs` | Registra resultado en wc2026-results.json y actualiza elo-live.json |
| `context.mjs` | Multiplicadores de fase y venue (altitud, calor, presión) |
| `build-dataset.mjs` | CSV martj42 → `results-full.json` |

### Archivos de datos
| Archivo | Contenido |
|---|---|
| `data/seed-ratings.json` | Priors Elo (63 equipos) — fuente única usada por calibrate/backtest/blend/rho |
| `data/fixture-wc2026.json` | 104 partidos: 12 grupos + eliminatorias con placeholders. Sede por partido |
| `data/venues-wc2026.json` | 16 sedes (incl. Atlanta) con altitud y goalMult |
| `data/elo-calibrated.json` | Ratings Elo PRE-TORNEO (CONGELADOS — no modificar) |
| `data/elo-live.json` | Ratings actualizados con partidos WC2026 (K=20). Usar con `--live` |
| `data/spi-ratings.json` | attack/defense/xg por equipo (calibrado sobre 676 partidos) |
| `data/results-full.json` | 25,345 partidos históricos post-2000 (fuente: martj42) |
| `data/results.json` | Dataset reducido original (913 partidos) |
| `data/wc2026-results.json` | Resultados WC2026 ya jugados — actualizar con `add-result.mjs` |
| `data/bets.json` | Apuestas reales (open/won/lost) con payout neto — tracker V1 |
| `data/deposits.json` | Abonos de capital propio + snapshot de saldo de la casa |
| `data/players.json` | Planteles de los **48 equipos** WC2026 con `elo_impact` y `pos` (FW/MF/DF/GK) por jugador |
| `data/model-backtest.json` | Últimas métricas del backtest |

## Estado actual del torneo
- Inicio: 11 junio 2026. Fixture completo en data/fixture-wc2026.json (104 partidos)
- **12 partidos registrados** en `wc2026-results.json` al 2026-06-15:
  - Jun 11: México 2-0 Sudáfrica (GA) | Corea del Sur 2-1 Rep. Checa (GA)
  - Jun 12: Canadá 1-1 Bosnia (GB) | USA 4-1 Paraguay (GD)
  - Jun 13: Qatar 1-1 Suiza (GE) | Brasil 1-1 Marruecos (GF) | Haití 0-1 Escocia (GH) | Australia 2-0 Turquía (GC)
  - Jun 14: Alemania 7-1 Curazao (GA) | Países Bajos 2-2 Japón (GF) | Costa de Marfil 1-0 Ecuador | Suecia 5-1 Túnez (GF)
- Ver próximos: `node fixture.mjs --next=8`. Registrar resultado: `node add-result.mjs` o pedírmelo
- **`elo-live.json`** actualizado con los 12 partidos. Usar `--live` en predict desde octavos; en fase de grupos elo-calibrated es la referencia principal

## Bankroll y apuestas
- **5 apuestas ABIERTAS en Bélgica-Egipto (2026-06-15) — $5.000 staked**
- Saldo casa pre-BEL-EGY: **~$16.640** | Capital propio: $52.939 | P&L realizado: **~−$36.299** (España-CV 0-0)
- Historial por partido: Canadá-Bosnia −$9.450 · USA-Paraguay +$3.310 · Qatar-Suiza −$8.000 · Brasil-Marruecos −$21.500 · Haití-Escocia −$500 · Australia-Turquía +$33.220 · Alemania-Curazao −$18.351 · Países Bajos-Japón +$18.099 · Costa de Marfil-Ecuador −$6.713 · Suecia-Túnez +$10.840 · **España-Cabo Verde −$36.299** (0-0, solo ganaron CV=0/NoGol/CV≤1/CV≤0 → $4.900 cobrado) · **Bélgica-Egipto PENDIENTE**
- BEL-EGY: 5 boletos — exacto 2:1 @7.00, exacto 2:0 @6.25, <2.5 @1.55, BTTS @1.70, total=3 @3.40. Gana todo con 2-1 BEL (+$7.099 neto). Pendiente confirmar tiros/portero de ESP-CV.
- Ver bankroll: `node bankroll.mjs` | EV apuestas: `node bet-ev.mjs [partido]` | Kelly: `node stake.mjs`

## Métricas del modelo (backtest sobre 763 partidos)
| Métrica | Elo puro (0.45) | Blended (0.65) + SEED unificado | Baseline uniforme |
|---|---|---|---|
| Accuracy | 61.9% | **64.0%** (+2.1pp) | — |
| Favourite acc | 69.0% | **70.8%** | — |
| Brier | 0.520 | **0.495** | 0.667 |
| Log-loss | 0.886 | **0.847** | 1.099 |
| RPS | 0.1746 | **0.1637** (−109bp) | 0.2406 |
| ECE | 2.3% | **1.9%** | — |

Backtest usa el modelo blended real. Half-life diferenciado, DC_RHO=−0.075, SEED unificado (63 equipos).

## Tareas completadas
Todas las tareas están implementadas. Ver `MEJORAS-PENDIENTES.md` para historial detallado.

| Grupo | Items clave resueltos |
|---|---|
| Modelo core | Half-life diferenciado, Blend 0.65 optimizado, DC_RHO=−0.075, Pi-rating 3-way blend |
| Squad adj | attack_ratio + defense_ratio por posición (FW/MF/DF/GK). players.json: 48 equipos |
| Home advantage | homeBonus() por equipo activo en predict/halftime/calibrate. HOME_ADV_OFFSET en context.mjs |
| halftime.mjs | v6: Dixon-Coles, squad ataque+defensa, MV, Pi-rating, homeBonus, game state, prórroga |
| match-core.mjs | Módulo compartido. bet-ev.mjs y stake.mjs usan blend idéntico incl. Pi-rating |
| Apuestas | bet-ev.mjs + stake.mjs (Kelly + correlación). Flag `--overround` para de-vig |
| Backtest/tests | backtest corregido, 73 invariantes en test.mjs, K-factor unificado |
| Fixture/datos | fixture-wc2026.json (104 partidos), elo-live.json incremental, add-result.mjs |

### Pendiente (dependen de datos externos — baja prioridad)
- **Bug #6**: squadAdjustment solo resta — calidad base positiva requiere nueva arquitectura
- **Mejora F**: calibrar escala elo_impact con datos de rendimiento/mercado
- **Tarea 5**: Platt scaling bin 40-50% — reevaluar tras fase de grupos (3 julio)
- **V3/V4**: Backtest sin campo `neutral`; sin squad/venue/phase en histórico — limitación inherente de datos

## Reglas de apuestas derivadas del modelo
- ✅ Confiar en EV de mercados **1X2, HT/FT, resultado por tiempo** para todos los equipos
- ❌ No confiar en EV de **goles exactos** para equipos CAF/AFC vs élite UEFA/CONMEBOL
- EV mínimo recomendado: **+5% en mercados 1X2, +10% en mercados de goles**
- Kelly recomendado: Half-Kelly (f*/2), cap 5% por apuesta. Ver `node stake.mjs`
- De-vig: `--overround=1.06` muestra edge real vs mercado (overround típico 1.04–1.08)

## Lecciones aprendidas (apuestas WC2026)
- **Alemania-Curazao**: modelo marcó EV+ en goles. Partido 7-1 destruyó todas las apuestas de goles. Varianza extrema > EV en partidos muy asimétricos.
- **Live odds mejoran EV**: "Menos 5.5" pasó de EV −0.5% a +6.3% en vivo en ese mismo partido.
- **Correlación**: NED-JAP 10 boletos ($22.649 staked). Brasil-Marruecos 19 boletos ($21.500 perdidos). Usar `stake.mjs` para detectar exposición acumulada.
- **NED-JAP**: ningún mercado tenía EV positivo pre-partido. Se apostó igual por criterio propio del usuario.
- **España-Cabo Verde (0-0)**: 30 boletos, $41.199 staked, −$36.299 neto. Solo ganaron CV=0/NoGol/CV≤1/CV≤0 (+$900 sobre esas 4). España no marcó ningún gol — el peor escenario posible para la cartera. Prob del modelo: 1.4%. Suma al patrón: partidos muy asimétricos tienen varianza extrema independiente del EV.

## Dataset: composición efectiva
Con half-life 12 meses, los 5,298 partidos (últimos 5 años) equivalen a **1,425 partidos de peso pleno**:
- Amistosos: 437 peso efectivo (K=16 — menor impacto)
- Clasificatorias WC: 401 (problema: muchos rivales débiles CAF/AFC)
- Nations League: 132
- AFCON Clasif.: 60 | Copa América: 9 | **FIFA World Cup: 7.5** ← crítico

## Convenciones de código
- Slugs de equipos: siempre lowercase con guiones (`south-korea`, `ivory-coast`, `bosnia-and-herzegovina`)
- Timestamps: Unix seconds (`ts`)
- Ratings Elo: enteros redondeados en elo-calibrated.json
- SPI: `{ attack, defense, xg }` — attack >1 = mejor que promedio, defense >1 = peor defensa
- Squad adj: `defense × (2 − defense_ratio)` — multiplica > 1 cuando faltan defensores (beta empeora)
