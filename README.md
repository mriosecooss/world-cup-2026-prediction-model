# 🏆 Modelo de Predicción del Mundial 2026

Un modelo estadístico de código abierto que pronostica los partidos y las probabilidades de
campeón del **Mundial FIFA 2026** — **blend de ratings Elo + SPI → Poisson bivariado de
Dixon-Coles → simulación Monte Carlo**. Sin caja negra de machine learning, sin cuotas de casas
de apuestas scrapeadas: solo matemática futbolística transparente y reproducible.

**▶ Predicciones en vivo (modelo completo de 48 equipos, 50.000 simulaciones):** **https://cup26matches.com**
· [Cómo funciona / metodología](https://cup26matches.com/en/methodology/)
· [Feed de insights en vivo](https://cup26matches.com/en/live/)
· [Simulador interactivo del cuadro](https://cup26matches.com/en/simulator/)

> 🔴 **El torneo está EN VIVO (11 jun – 19 jul).** El modelo de producción ahora **condiciona
> sobre resultados reales**: los partidos terminados quedan fijos, los equipos eliminados caen
> a 0%, se usa el cuadro real (incl. la nueva clasificación de mejores terceros, resuelta con
> matching bipartito), y solo se simulan los partidos restantes — se vuelve a correr
> automáticamente a los pocos minutos de cada pitazo final.
>
> Este repo libera el **modelo de partido central + nuestro backtest honesto** para que puedas
> correrlo, inspeccionarlo y reproducir los números.

---

## Por qué vale la pena mirarlo

Está probado de forma honesta — **walk-forward, fuera de muestra** sobre **913 partidos
internacionales reales** (oct 2023 – jun 2026). Cada partido se predice usando solo datos
disponibles *antes* del pitazo inicial, y luego se evalúa contra el resultado real — con
**reglas de puntaje propias** (RPS, log-loss, Brier), no solo accuracy, porque el accuracy solo
premia la suerte. Repruébalo tú mismo con un comando:

```bash
node backtest.mjs
```

| Métrica (763 evaluados, 150 de calentamiento) | Modelo | Referencia |
|---|---|---|
| **Ranked Probability Score** (el estándar del fútbol, ↓) | **0.164** | cara o sello 0.241 |
| Log-loss (↓) | **0.85** | cara o sello 1.10 |
| Brier score (↓) | **0.50** | cara o sello 0.67 |
| **Error de Calibración Esperado** (↓) | **1.9%** | < 5% = bien calibrado |
| Resultado correcto (gana/empata/pierde) | **64%** | siempre-local 49% · cara o sello 33% |
| Cuando hay un favorito claro (p ≥ 50%) | **71%** | — |

### ¿Está calibrado? (el gráfico que importa)

Un pronosticador es honesto cuando las cosas que llama "70%" pasan realmente el 70% de las
veces. Agrupando cada probabilidad que emitió el modelo en los partidos fuera de muestra:

| El modelo dijo | Realmente pasó | n |
|---|---|---|
| 6% | 3% | 238 |
| 15% | 13% | 447 |
| 25% | 24% | 703 |
| 35% | 35% | 202 |
| 45% | 47% | 161 |
| 54% | 54% | 153 |
| 64% | 70% | 160 |
| 74% | 77% | 123 |
| 85% | 89% | 101 |

> _**Changelog** — 13 jun 2026: **modelo núcleo v5** — peso del blend Elo+SPI optimizado a 0.65
> vía grid search sobre RPS; decaimiento temporal según competencia (media vida de 30 meses en
> Mundial vs 6 en amistosos); ρ de Dixon-Coles calibrado sobre este dataset (−0.13→−0.075); el
> backtest ahora evalúa el modelo blended real. · 11 jun: Monte Carlo subido a **50.000
> simulaciones** (5× menos ruido en las colas); el condicionamiento en vivo durante el torneo ya
> está activo; el backtest se extendió con RPS + curva de confiabilidad + ECE; datos
> actualizados a jun 2026. · 7 jun: denominador de varianza del modelo de goles 350→400._

Ningún modelo es una bola de cristal — el fútbol tiene mucha varianza y los empates son
genuinamente difíciles. Estas son estimaciones bien calibradas, y no afirmamos **poder ganarle
al mercado de apuestas**.

## 📊 Track record en vivo (2026)

El pronóstico del modelo para **cada partido terminado** del torneo, actualizado a medida que ocurre:

<!-- TRACK-RECORD:START -->
**50/78 pronósticos correctos (64%) · RPS promedio 0.144** (cara o sello ≈ 0.245) · actualizado 2026-07-01

| Fecha | Resultado | Pronóstico del modelo | |
|---|---|---|---|
| 2026-06-30 | Francia 3–0 Suecia | Francia 75% | ✅ |
| 2026-06-30 | Noruega 2–1 Costa de Marfil | Noruega 42% | ✅ |
| 2026-06-29 | Países Bajos 1–1 (2–3 p) Marruecos | Marruecos 41% | ❌ |
| 2026-06-29 | Alemania 1–1 (3–4 p) Paraguay | Alemania 56% | ❌ |
| 2026-06-29 | Brasil 2–1 Japón | Brasil 51% | ✅ |
| 2026-06-28 | Canadá 1–0 Sudáfrica | Canadá 54% | ✅ |
| 2026-06-27 | Croacia 2–1 Ghana | Croacia 64% | ✅ |
| 2026-06-27 | Panamá 0–2 Inglaterra | Inglaterra 80% | ✅ |
| 2026-06-23 | Panamá 0–1 Croacia | Croacia 66% | ✅ |
| 2026-06-23 | Inglaterra 0–0 Ghana | Inglaterra 78% | ❌ |
| 2026-06-17 | Ghana 1–0 Panamá | Ghana 38% | ✅ |
| 2026-06-17 | Inglaterra 4–2 Croacia | Inglaterra 49% | ✅ |
| 2026-06-27 | RD Congo 3–1 Uzbekistán | Empate 37% | ❌ |
| 2026-06-27 | Colombia 0–0 Portugal | Portugal 47% | ❌ |
| 2026-06-23 | Colombia 1–0 RD Congo | Colombia 60% | ✅ |
| 2026-06-23 | Portugal 5–0 Uzbekistán | Portugal 70% | ✅ |
| 2026-06-17 | Uzbekistán 1–3 Colombia | Colombia 64% | ✅ |
| 2026-06-17 | Portugal 1–1 RD Congo | Portugal 65% | ❌ |
| 2026-06-27 | Jordania 1–3 Argentina | Argentina 82% | ✅ |
| 2026-06-27 | Argelia 3–3 Austria | Argelia 41% | ❌ |
| 2026-06-22 | Jordania 1–2 Argelia | Argelia 68% | ✅ |
| 2026-06-22 | Argentina 2–0 Austria | Argentina 61% | ✅ |
| 2026-06-16 | Austria 3–1 Jordania | Austria 64% | ✅ |
| 2026-06-16 | Argentina 3–0 Argelia | Argentina 54% | ✅ |
| 2026-06-26 | Senegal 5–0 Irak | Senegal 55% | ✅ |
| 2026-06-26 | Noruega 1–4 Francia | Francia 52% | ✅ |
| 2026-06-22 | Noruega 3–2 Senegal | Noruega 50% | ✅ |
| 2026-06-22 | Francia 3–0 Irak | Francia 76% | ✅ |
| 2026-06-16 | Irak 1–4 Noruega | Noruega 65% | ✅ |
| 2026-06-16 | Francia 3–1 Senegal | Francia 64% | ✅ |
| 2026-06-26 | Uruguay 0–1 España | España 54% | ✅ |
| 2026-06-26 | Cabo Verde 0–0 Arabia Saudita | Cabo Verde 44% | ❌ |
| 2026-06-21 | Uruguay 2–2 Cabo Verde | Uruguay 58% | ❌ |
| 2026-06-21 | España 4–0 Arabia Saudita | España 83% | ✅ |
| 2026-06-15 | Arabia Saudita 1–1 Uruguay | Uruguay 59% | ❌ |
| 2026-06-15 | España 0–0 Cabo Verde | España 82% | ❌ |
| 2026-06-26 | Nueva Zelanda 0–5 Bélgica | Bélgica 81% | ✅ |
| 2026-06-26 | Egipto 1–1 Irán | Egipto 39% | ❌ |
| 2026-06-21 | Nueva Zelanda 1–3 Egipto | Egipto 53% | ✅ |
| 2026-06-21 | Bélgica 0–0 Irán | Bélgica 67% | ❌ |
| 2026-06-15 | Irán 2–2 Nueva Zelanda | Irán 47% | ❌ |
| 2026-06-15 | Bélgica 1–1 Egipto | Bélgica 62% | ❌ |
| 2026-06-25 | Túnez 1–3 Países Bajos | Países Bajos 63% | ✅ |
| 2026-06-25 | Japón 1–1 Suecia | Japón 57% | ❌ |
| 2026-06-20 | Túnez 0–4 Japón | Japón 56% | ✅ |
| 2026-06-20 | Países Bajos 5–1 Suecia | Países Bajos 64% | ✅ |
| 2026-06-14 | Suecia 5–1 Túnez | Suecia 42% | ✅ |
| 2026-06-14 | Países Bajos 2–2 Japón | Países Bajos 39% | ❌ |
| 2026-06-25 | Ecuador 2–1 Alemania | Alemania 38% | ❌ |
| 2026-06-25 | Curazao 0–2 Costa de Marfil | Costa de Marfil 75% | ✅ |
| 2026-06-20 | Ecuador 0–0 Curazao | Ecuador 74% | ❌ |
| 2026-06-20 | Alemania 2–1 Costa de Marfil | Alemania 51% | ✅ |
| 2026-06-14 | Costa de Marfil 1–0 Ecuador | Ecuador 39% | ❌ |
| 2026-06-14 | Alemania 7–1 Curazao | Alemania 87% | ✅ |
| 2026-06-25 | Paraguay 0–0 Australia | Australia 38% | ❌ |
| 2026-06-25 | Turquía 3–2 Estados Unidos | Estados Unidos 43% | ❌ |
| 2026-06-19 | Turquía 1–0 Paraguay | Paraguay 36% | ❌ |
| 2026-06-19 | Estados Unidos 2–0 Australia | Estados Unidos 38% | ✅ |
| 2026-06-13 | Australia 2–0 Turquía | Australia 40% | ✅ |
| 2026-06-12 | Estados Unidos 4–1 Paraguay | Estados Unidos 41% | ✅ |
| 2026-06-24 | Marruecos 4–2 Haití | Marruecos 87% | ✅ |
| 2026-06-24 | Escocia 0–3 Brasil | Brasil 67% | ✅ |
| 2026-06-19 | Brasil 3–0 Haití | Brasil 89% | ✅ |
| 2026-06-19 | Escocia 0–1 Marruecos | Marruecos 56% | ✅ |
| 2026-06-13 | Haití 0–1 Escocia | Escocia 73% | ✅ |
| 2026-06-13 | Brasil 1–1 Marruecos | Brasil 42% | ❌ |
| 2026-06-24 | Bosnia y Herzegovina 3–1 Catar | Bosnia y Herzegovina 44% | ✅ |
| 2026-06-24 | Suiza 2–1 Canadá | Suiza 37% | ✅ |
| 2026-06-18 | Canadá 6–0 Catar | Canadá 70% | ✅ |
| 2026-06-18 | Suiza 4–1 Bosnia y Herzegovina | Suiza 72% | ✅ |
| 2026-06-13 | Catar 1–1 Suiza | Suiza 79% | ❌ |
| 2026-06-12 | Canadá 1–1 Bosnia y Herzegovina | Canadá 62% | ❌ |
| 2026-06-24 | Sudáfrica 1–0 Corea del Sur | Corea del Sur 49% | ❌ |
| 2026-06-24 | República Checa 0–3 México | México 69% | ✅ |
| 2026-06-18 | México 1–0 Corea del Sur | México 56% | ✅ |
| 2026-06-18 | República Checa 1–1 Sudáfrica | República Checa 42% | ❌ |
| 2026-06-11 | Corea del Sur 2–1 República Checa | Corea del Sur 48% | ✅ |
| 2026-06-11 | México 2–0 Sudáfrica | México 66% | ✅ |

_Se muestran todos los pronósticos — aciertos y errores. Las probabilidades son los números congelados del modelo antes de cada partido (los ratings no se recalibran a mitad de torneo), así que nada acá está ajustado en retrospectiva. Reprodúcelo con `node track-record.mjs`._
<!-- TRACK-RECORD:END -->

## 🧩 Widgets embebibles y datos abiertos

¿Tienes un blog, foro o sitio de fans? El modelo en vivo es embebible — gratis, se actualiza
solo durante todo el torneo:

```html
<!-- Tablero en vivo de la carrera por el título (top-10 probabilidades de campeón, 50k sims) -->
<iframe src="https://cup26matches.com/embed/title-race/" width="100%" height="430"
  style="border:0;border-radius:12px" loading="lazy" title="World Cup 2026 title odds"></iframe>

<!-- Franja en vivo del próximo partido (G/E/P en vivo, rota al pitazo inicial) -->
<iframe src="https://cup26matches.com/embed/next-match/" width="100%" height="92"
  style="border:0;border-radius:10px" loading="lazy" title="Next World Cup 2026 match"></iframe>
```

Más widgets + snippets para copiar y pegar: **[cup26matches.com/en/widgets](https://cup26matches.com/en/widgets/)**

**Datos abiertos** (CC BY 4.0 — libres de usar/citar/graficar con un link de vuelta): las
probabilidades completas por equipo para todo el torneo, regeneradas después de cada partido —
[probabilities.json](https://cup26matches.com/data/probabilities.json) ·
[probabilities.csv](https://cup26matches.com/data/probabilities.csv)

## Inicio rápido

Sin dependencias. Node 18+.

```bash
git clone https://github.com/Hicruben/world-cup-2026-prediction-model.git
cd world-cup-2026-prediction-model

node predict.mjs brazil argentina               # probabilidades cara a cara
node predict.mjs usa mexico usa                 # 3er argumento = equipo local (bonus de sede)
node predict.mjs brazil morocco --odds=2.2,3.4,3.9   # agrega valor esperado vs. tus cuotas
node halftime.mjs brazil morocco 1 0 67         # recálculo en vivo desde cualquier minuto
node backtest.mjs                               # reproduce los números de accuracy
node calibrate.mjs                              # reconstruye los ratings desde los datos
```

Ejemplo:

```
$ node predict.mjs spain germany

  SPAIN vs GERMANY  [neutral]

  spain            win   50.6%  ███████████████
  draw                   22.7%  ███████
  germany          win   26.7%  ████████

  xG esperados     :  2.05 – 1.47
```

## Cómo funciona

1. **Fuerza de cada selección (Elo + SPI).** Cada selección parte de un prior de largo plazo, y
   luego se calibra con partidos internacionales reales recientes — ganarle a rivales fuertes en
   partidos importantes mueve más el rating que un amistoso, y la forma reciente pesa más que la
   forma antigua (media vida según competencia: 30 meses en Mundiales, hasta 6 en amistosos).
   Una segunda pasada deriva parámetros separados de **ataque/defensa** (estilo SPI, EM de
   Dixon-Coles). Ver [`calibrate.mjs`](./calibrate.mjs) + [`calibrate-spi.mjs`](./calibrate-spi.mjs).
2. **Cada partido (Poisson de Dixon-Coles).** Ratings → goles esperados → un Poisson bivariado
   de Dixon-Coles da las probabilidades de ganar/empatar/perder. Las dos miradas (Elo y SPI) se
   **combinan 35/65** (peso optimizado por grid search sobre RPS). La corrección de Dixon-Coles
   (ρ = −0.075, calibrado por máxima verosimilitud sobre este dataset) corrige el sub-conteo del
   Poisson puro en empates de pocos goles (0-0, 1-1). Ver [`elo.mjs`](./elo.mjs).
3. **El torneo (Monte Carlo).** El sitio en vivo juega los 104 partidos **50.000 veces** a
   través del cuadro real para obtener las probabilidades de campeón y avance — y, ahora que el
   torneo está en curso, **fija cada resultado terminado** (posiciones reales, clasificados
   reales, lugares reales del cuadro) y solo simula lo que queda. Explicación completa:
   [cup26matches.com/methodology](https://cup26matches.com/en/methodology/).

## Qué es distinto respecto al original

Esto empezó como un fork de
[Hicruben/world-cup-2026-prediction-model](https://github.com/Hicruben/world-cup-2026-prediction-model)
(solo Elo, 7 archivos) y desde entonces creció bastante. Qué cambió, uno por uno:

**Modelo central**
1. Se agregó un **blend de ataque/defensa estilo SPI** sobre el Elo (65% SPI / 35% Elo, peso
   elegido por grid search sobre RPS) — el original era solo Elo.
2. El **ρ de Dixon-Coles** ahora se calibra por máxima verosimilitud sobre este dataset
   (`calibrate-rho.mjs`) en vez de un valor genérico fijo.
3. **Decaimiento temporal según competencia**: la media vida ahora varía por competencia (30
   meses Mundial → 6 meses amistosos) en vez de una única media vida global.
4. **Ventaja de localía por equipo** (`context.mjs`): México +95, USA +85, Canadá +80, el resto
   +75 Elo — esto existía en el esquema pero era código muerto en el original; ahora está
   conectado en todos los predictores.
5. El **ajuste por plantel** por jugadores ausentes/lesionados ahora afecta tanto **ataque como
   defensa** (`squad-strength.mjs`) — el original solo tenía hooks (muertos) del lado del ataque.
6. **Boost por valor de mercado** por plantel (`squad-market-value.mjs`) — nuevo.
7. **Ajustes de contexto** — sede/altitud, fase del torneo, días de descanso, presión
   (`context.mjs`, `pressure-context.mjs`) — nuevo.
8. El backtest mejoró de **RPS 0.175 → 0.164**, accuracy **62% → 64%**, accuracy con favorito
   **69% → 71%**, ECE **2.3% → 1.9%** sobre el mismo set de 913 partidos fuera de muestra.

**Herramientas nuevas (no existían en el repo original de 7 archivos)**
9. `halftime.mjs` — recálculo en vivo desde cualquier minuto, incluyendo prórroga (hasta el
   120'), con ajuste de game-state (el equipo que va perdiendo/ganando sube/baja su xG).
10. `bet-ev.mjs` — valor esperado de apuestas reales, con de-vig (`--overround`) para descontar
    el margen de la casa.
11. `stake.mjs` — tamaño de apuesta con Kelly fraccionario + detector de exposición
    correlacionada entre boletos.
12. `bankroll.mjs` — concilia depósitos contra apuestas cerradas para P&L/ROI real.
13. `fixture.mjs` — calendario completo del torneo (104 partidos) con predicción de próximos partidos.
14. `add-result.mjs` + `update-elo-live.mjs` — registra resultados reales de 2026 y los aplica a
    un Elo incremental en vivo (`elo-live.json`, K=20) sin tocar los ratings congelados
    pre-torneo.
15. `nextgoal.mjs` — probabilidad del próximo gol en partidos en vivo.
16. `build-dataset.mjs` — construye el dataset histórico de 25.345 partidos desde los datos crudos.
17. `match-core.mjs` — una única implementación compartida del blend (`matchBlendedXg`) para que
    `predict`, `halftime`, `bet-ev` y `stake` ya no puedan desalinearse entre sí.
18. `test.mjs` — suite de 73 invariantes de consistencia; el original no tenía ninguno.
19. `data/players.json` — planteles completos de las 48 selecciones clasificadas (alimenta el
    ajuste por plantel).

En números: `predict.mjs` pasó de 30 a 168 líneas, `backtest.mjs` de 104 a 171, `elo.mjs` de 70
a 125, y se agregaron 19 módulos nuevos sobre los 7 archivos del original.

## Archivos

| Archivo | Qué hace |
|---|---|
| `elo.mjs` | El modelo de partido — Elo, blend SPI, τ de Dixon-Coles, Poisson, `matchProb`, `sampleMatch` |
| `match-core.mjs` | Blend único compartido (`matchBlendedXg`) usado por predict/halftime/bet-ev/stake |
| `constants.mjs` | Constantes compartidas — slugs de equipos, ventaja de local/sede, K-factor por competencia |
| `context.mjs` | Ventaja de localía por equipo, sede/altitud, fase del torneo, efectos por descanso |
| `pressure-context.mjs` | Ajuste por presión en fase eliminatoria |
| `squad-strength.mjs` | Ajuste de plantel (ataque + defensa) por jugadores ausentes/lesionados |
| `squad-market-value.mjs` | Boost por valor de mercado del plantel |
| `calibrate.mjs` | Construye los ratings Elo calibrados (decaimiento temporal según competencia) |
| `calibrate-spi.mjs` | Deriva los parámetros de ataque/defensa (SPI) vía EM de Dixon-Coles |
| `calibrate-pi.mjs` | Calibración de Pi-rating (input del blend a 3 vías) |
| `calibrate-blend.mjs` | Grid search del peso óptimo del blend Elo/SPI (por RPS) |
| `calibrate-rho.mjs` | Calibración por máxima verosimilitud del ρ de Dixon-Coles sobre este dataset |
| `backtest.mjs` | Evaluación walk-forward fuera de muestra (RPS, log-loss, Brier, ECE + curva de confiabilidad) |
| `test.mjs` | Suite de 73 invariantes de consistencia (`npm test`) |
| `predict.mjs` | Predictor CLI cara a cara (`--odds` para EV, `--live` para ratings en torneo) |
| `halftime.mjs` | Recálculo en vivo desde cualquier minuto y marcador, incl. prórroga |
| `nextgoal.mjs` | Probabilidad del próximo gol en partidos en vivo |
| `fixture.mjs` | Calendario completo de 104 partidos + predicción de próximos partidos |
| `bet-ev.mjs` | Valor esperado de apuestas reales, con de-vig (`--overround`) |
| `stake.mjs` | Tamaño de apuesta con Kelly fraccionario + detector de exposición correlacionada |
| `bankroll.mjs` | Concilia depósitos vs. apuestas cerradas en P&L/ROI |
| `add-result.mjs` | Agrega un resultado terminado de 2026 y refresca el track record |
| `update-elo-live.mjs` | Actualización incremental de Elo con resultados de 2026 (K=20) → `elo-live.json` |
| `track-record.mjs` | Regenera la tabla de track record en vivo de 2026 en este README |
| `build-dataset.mjs` | Construye `results-full.json` a partir de la fuente histórica cruda |
| `data/results.json` | 913 resultados internacionales reales (oct 2023 – jun 2026) |
| `data/results-full.json` | 25.345 partidos históricos post-2000 (fuente: martj42) |
| `data/elo-calibrated.json` | Elo calibrado para los 48 finalistas (congelado pre-torneo) |
| `data/elo-live.json` | Elo actualizado incrementalmente con resultados de 2026 ya terminados |
| `data/spi-ratings.json` | Parámetros de ataque/defensa (SPI) por equipo |
| `data/players.json` | Planteles de las 48 selecciones clasificadas (alimenta el ajuste de plantel) |
| `data/fixture-wc2026.json` | Fixture oficial de 104 partidos — grupos + cuadro eliminatorio |
| `data/wc2026-results.json` | Partidos del Mundial 2026 ya terminados (alimenta el track record) |
| `data/model-backtest.json` | Métricas guardadas del backtest |

## Licencia

MIT — ver [LICENSE](./LICENSE). Construido por [Cup26 AI](https://cup26matches.com). Si lo usas,
se agradece un link de vuelta. ⭐ dale una estrella al repo si te resulta útil.
