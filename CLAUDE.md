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
- Dixon-Coles ρ = −0.065 (calibrado por MLE via `calibrate-rho.mjs` — paper usaba −0.13 en fútbol inglés)
- K_FACTOR_WC = 60 (clasificatorias 42, amistosos 16)
- HOME_ADV = 75 Elo puntos (hosts: mexico +20, usa +10, canada +5)
- Blend en `matchProbBlended(eloResult, spiResult, 0.65)` → optimizado via grid search RPS
- Half-life por competición: WC 30m | Cups 24m | Nations League 18m | Clasif. 12m | Amistosos 6m

### Archivos clave
| Archivo | Propósito |
|---|---|
| `elo.mjs` | Fórmulas base: `matchProb`, `matchProbSPI`, `matchProbBlended`, `poissonPmf`, `dcTau` |
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
| Métrica | Antes (Elo puro 0.45) | Ahora (blended 0.65) | Baseline uniforme |
|---|---|---|---|
| Accuracy | 61.9% | **63.0%** (+1.1pp) | — |
| Favourite acc | 69.0% | **71.5%** (+2.5pp) | — |
| Brier | 0.520 | **0.506** | 0.667 |
| Log-loss | 0.886 | **0.862** | 1.099 |
| RPS | 0.1746 | **0.1687** (−59bp) | 0.2406 |
| ECE | 2.3% | **2.3%** | — |

Backtest usa el modelo blended real (igual que predict.mjs). Half-life diferenciado. DC_RHO calibrado.

## Tareas pendientes

| # | Tarea | Estado | Descripción breve |
|---|---|---|---|
| 1 | Half-life diferenciado | ✅ | WC 30m / Cups 24m / NL 18m / Clasif 12m / Amistosos 6m. WC2022: peso 0.09 → 0.38 |
| 2 | Backtest corregido | ✅ | Reescrito para usar `matchProbBlended` igual que `predict.mjs` |
| 3 | Blend weight optimizado | ✅ | Grid search RPS: 0.45 → 0.65, mejora 59 basis points |
| 9 | Actualización diaria resultados | ✅ | `add-result.mjs` — registrar partidos en lenguaje natural vía Claude o CLI |
| 4 | Squad adjustment sobre SPI | ✅ | Ya implementado en predict.mjs líneas 56-63: `sA.attack * sqA.ratio`. Estaba desde v3 |
| 7 | `halftime.mjs` genérico | Pendiente | Hardcodeado USA-PAR 3-0. Convertir a `node halftime.mjs brasil marruecos 1 0 38` |
| 8 | Flag `--odds` en predict.mjs | Pendiente | `--odds "2.20 3.40 3.90"` para imprimir EV por outcome directo en consola |
| 6 | `elo-live.json` incremental | Pendiente (octavos) | Elo actualizado K=20 con resultados WC2026. Sin tocar el congelado. Flag `--live` en predict |
| 5 | Calibración bin 40-50% | Pendiente | Modelo dice 45% → ocurre 54%. Platt scaling post-proceso |
| 12 | `track-record.mjs` usa Elo puro | ✅ | Ahora usa `matchProbBlended` con SPI_WEIGHT=0.65, consistente con predict.mjs |
| 11 | Filtrar clasificatorias débiles SPI | Pendiente | `spi-ratings.json` infla ataque CAF/AFC por partidos vs rivales ~1300 Elo |
| 10 | Calibrar DC_RHO | ✅ | MLE sobre 272 marcadores bajos: −0.13 → −0.065. ECE 2.8% → 2.3% |

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
