# WC2026 Prediction Model — Claude Context

## Entorno
- **Node:** `C:\Program Files\nodejs\node.exe` (no está en PATH, usar ruta completa)
- **Directorio:** `C:\Users\matum\Downloads\world-cup-2026-prediction-model`
- **Correr script:** `& "C:\Program Files\nodejs\node.exe" predict.mjs brasil marruecos`
- **Idioma de respuesta:** siempre español

## Arquitectura del modelo

### Fórmula λ blended (35% Elo + 65% SPI)
```
Elo:  λ = 1.35 + (EloA − EloB) / 400   [clamped 0.3–3.5]
SPI:  λ = 1.35 × attack_A × defense_B   [clamped 0.3–4.0]
EV  = (prob_modelo × cuota) − 1
1H  = 44% de λ total  |  2H = 56%
```
- Dixon-Coles ρ = −0.075 (calibrado por MLE via `calibrate-rho.mjs` — paper usaba −0.13 en fútbol inglés)
- K_FACTOR_WC = 60 (clasificatorias 42, amistosos 16)
- HOME_ADV = 75 Elo puntos (hosts: mexico +20, usa +10, canada +5)
- Blend en `matchProbBlended(eloResult, spiResult, 0.65)` → optimizado via grid search RPS
- Half-life por competición: WC 30m | Cups 24m | Nations League 18m | Clasif. 12m | Amistosos 6m

### Archivos clave
| Archivo | Propósito |
|---|---|
| `elo.mjs` | Fórmulas base: `matchProb`, `matchProbSPI`, `matchProbBlended`, `poissonPmf`, `dcTau` (exportado) |
| `constants.mjs` | Fuente única: `SLUG_TO_NAME`, `RATE_BLOCKS`, `rateIntegral`, `HOST`, `HOME_ADV` |
| `predict.mjs` | CLI principal: `node predict.mjs <a> <b> [--venue=X] [--phase=X] [--live]` |
| `calibrate.mjs` | Genera `elo-calibrated.json` desde `results-full.json` |
| `calibrate-spi.mjs` | Genera `spi-ratings.json` |
| `backtest.mjs` | Walk-forward backtest — modelo blended real (spiWeight=0.65) |
| `track-record.mjs` | Mide aciertos en partidos WC2026 ya jugados |
| `halftime.mjs` | Recálculo con score actual (hardcoded a USA-PAR, pendiente refactorizar) |
| `squad-strength.mjs` | Ajuste Elo por bajas de jugadores |
| `context.mjs` | Multiplicadores de fase y venue (altitud, etc.) |
| `build-dataset.mjs` | CSV martj42 → `results-full.json` |
| `update-elo-live.mjs` | [PENDIENTE] Elo incremental con resultados WC2026, K=20 |

### Archivos de datos
| Archivo | Contenido |
|---|---|
| `data/seed-ratings.json` | Priors Elo (63 equipos) — fuente única usada por calibrate/backtest/blend/rho |
| `data/elo-calibrated.json` | Ratings Elo PRE-TORNEO (CONGELADOS — no modificar) |
| `data/elo-live.json` | [PENDIENTE] Ratings actualizados con partidos WC2026 |
| `data/spi-ratings.json` | attack/defense/xg por equipo (calibrado sobre 676 partidos) |
| `data/results-full.json` | 25,345 partidos históricos post-2000 (fuente: martj42) |
| `data/results.json` | Dataset reducido original (913 partidos) |
| `data/wc2026-results.json` | Resultados WC2026 ya jugados — actualizar con `add-result.mjs` |
| `data/players.json` | Plantel con impacto Elo por jugador |
| `data/venues-wc2026.json` | Venues con altitud y goalMult |
| `data/model-backtest.json` | Últimas métricas del backtest |

## Estado actual del torneo (actualizar)
- Inicio: 11 junio 2026
- Partidos jugados: México 2-0 Sudáfrica | Corea 2-1 Rep. Checa | Canadá 1-1 Bosnia | USA 4-1 Paraguay
- wc2026-results.json actualizado al: 2026-06-12

## Métricas del modelo (backtest sobre 763 partidos)
| Métrica | Elo puro (0.45) | Blended (0.65) + SEED unificado | Baseline uniforme |
|---|---|---|---|
| Accuracy | 61.9% | **64.0%** (+2.1pp) | — |
| Favourite acc | 69.0% | **70.8%** | — |
| Brier | 0.520 | **0.495** | 0.667 |
| Log-loss | 0.886 | **0.847** | 1.099 |
| RPS | 0.1746 | **0.1637** (−109bp) | 0.2406 |
| ECE | 2.3% | **1.9%** | — |

Backtest usa el modelo blended real (igual que predict.mjs). Half-life diferenciado, DC_RHO=−0.075,
SEED unificado (63 equipos desde data/seed-ratings.json). Calibración bin 40-50% mejoró a 45%→47%
(antes 45%→54%), reduciendo la urgencia de la tarea 5 (Platt scaling).

## Tareas

| # | Tarea | Estado | Descripción breve |
|---|---|---|---|
| 1 | Half-life diferenciado | ✅ | WC 30m / Cups 24m / NL 18m / Clasif 12m / Amistosos 6m. WC2022: peso 0.09 → 0.38 |
| 2 | Backtest corregido | ✅ | Reescrito para usar `matchProbBlended` igual que `predict.mjs` |
| 3 | Blend weight optimizado | ✅ | Grid search RPS: 0.45 → 0.65 |
| 4 | Squad adjustment sobre SPI | ✅ | Ya implementado en predict.mjs (`sA.attack * sqA.ratio`). Solo aplica a equipos en players.json |
| 6 | `elo-live.json` incremental | ✅ | `update-elo-live.mjs` (K=20) + flag `--live` en predict. Usar desde octavos |
| 7 | `halftime.mjs` genérico | ✅ | CLI: `node halftime.mjs brasil marruecos 1 0 38` |
| 8 | Flag `--odds` en predict.mjs | ✅ | `--odds=2.20,3.40,3.90` imprime EV por outcome |
| 9 | Actualización diaria resultados | ✅ | `add-result.mjs` — registrar partidos en lenguaje natural vía Claude o CLI |
| 10 | Calibrar DC_RHO | ✅ | MLE: −0.13 → −0.075 (con SEED unificado). ECE 2.8% → 1.9% |
| 11 | Filtrar clasificatorias débiles SPI | ✅ | calibrate-spi con HL por competición; CECAFA/COSAFA fuera por cutoff 3 años |
| 12 | `track-record.mjs` usa blended | ✅ | `matchProbBlended` SPI_WEIGHT=0.65, consistente con predict.mjs |
| M1 | README actualizado a v5 | ✅ | Blend Elo+SPI, métricas, calibración, archivos nuevos |
| D1-D4 | Eliminar duplicación | ✅ | SEED→seed-ratings.json, RATE_BLOCKS/SLUG_TO_NAME/HOST→constants.mjs, dcTau exportado |
| B1-B3 | Consistencia blend + CLI genérico | ✅ | analyze.mjs y nextgoal.mjs reescritos genéricos con blend 0.65 |
| B4 | Squad data faltante | ✅ (parcial) | `hasData` flag; predict muestra "sin datos". players.json solo tiene usa/paraguay |
| 5 | Calibración bin 40-50% (Platt) | 📅 3 julio | Ya mejoró a 45%→47% con SEED unificado. Reevaluar tras fase de grupos |

### Limitación conocida: players.json
Solo `usa` y `paraguay` tienen plantel cargado. Para los otros 46 equipos `squadAdjustment`
devuelve neutral (`hasData: false`) y predict muestra "sin datos" — el ajuste por bajas NO se aplica.
Poblar players.json requiere datos confiables de elo_impact por jugador (pendiente, baja prioridad).

## Reglas de apuestas derivadas del modelo
- ✅ Confiar en EV de mercados **1X2, HT/FT, resultado por tiempo** para todos los equipos
- ❌ No confiar en EV de **goles exactos** para equipos CAF/AFC vs élite UEFA/CONMEBOL
- ✅ Switzerland vs Qatar: EVs de goles son válidos (ambos datos más limpios)
- EV mínimo recomendado para apostar: +5% en mercados 1X2, +10% en mercados de goles

## Dataset: composición efectiva
Con half-life 12 meses, los 5,298 partidos (últimos 5 años) equivalen a **1,425 partidos de peso pleno**:
- Amistosos: 437 peso efectivo (K=16 — menor impacto por K bajo)
- Clasificatorias WC: 401 (problema: muchos rivales débiles CAF/AFC)
- Nations League: 132
- AFCON Clasif.: 60 | Copa América: 9 | **FIFA World Cup: 7.5** ← crítico

## Convenciones de código
- Slugs de equipos: siempre lowercase con guiones (`south-korea`, `ivory-coast`, `bosnia-and-herzegovina`)
- Timestamps: Unix seconds (`ts`)
- Ratings Elo: enteros redondeados en elo-calibrated.json
- SPI: `{ attack, defense, xg }` — attack >1 = mejor que promedio, defense >1 = peor defensa
