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
- Dixon-Coles ρ = −0.13 (hardcoded, no calibrado en este dataset)
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
| `backtest.mjs` | Walk-forward backtest (OJO: solo testea Elo puro, no el blended) |
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
| `data/wc2026-results.json` | Resultados WC2026 ya jugados (actualizar manualmente cada día) |
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
| ECE | 2.3% | 2.8% | — |

Backtest ahora usa el modelo blended real (igual que predict.mjs). Half-life diferenciado aplicado.

## Problemas conocidos (bugs/limitaciones priorizados)

### P1 — Críticos ✅ RESUELTOS
1. ~~**backtest.mjs testa Elo puro**~~ ✅ Resuelto — ahora usa `matchProbBlended` con SPI.
2. ~~**Half-life uniforme destruye señal de torneos**~~ ✅ Resuelto — half-life por competición implementado.

### P2 — Importantes
3. ~~**Blend weight 0.45 no optimizado**~~ ✅ Resuelto — grid search ejecutado, nuevo peso 0.65 (RPS −59bp).
4. **spi-ratings.json infla equipos CAF/AFC** — calibrado sobre 676 partidos que incluyen clasificatorias vs rivales débiles. EVs de goles exactos para estos equipos son artefactos. Solo confiar en mercados 1X2/HT-FT para CAF/AFC.
5. **Squad adjustment no afecta SPI** — las bajas solo modifican Elo, pero el 45% del blend viene de SPI intacto.

### P3 — Mejoras
6. **halftime.mjs hardcodeado** — USA-PAR 3-0. Convertir a CLI: `node halftime.mjs usa paraguay 3 0 45`.
7. **predict.mjs no calcula EV** — agregar `--odds "3.90 3.40 1.85"` para imprimir EV por outcome.
8. **DC_RHO = -0.13 no calibrado** — valor del paper original de 1997. Debería calibrarse por MLE sobre results-full.json.
9. **Calibración rota en bin 40-50%** — modelo dice 45% → ocurre 54%. Platt scaling post-hoc.
10. **elo-live.json pendiente** — sistema de Elo incremental con K=20 para resultados WC2026, sin tocar el congelado.

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
