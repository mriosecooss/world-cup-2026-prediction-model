# 🛠️ Mejoras y bugs pendientes — WC2026 model

_Generado: 14 jun 2026 (sesión Opus). Documento de traspaso para continuar en otro chat sin perder contexto._

> **Cómo usar este archivo:** es el backlog técnico. Atacar en orden de prioridad. Antes de refactorizar,
> guardar un baseline de salidas (`node predict.mjs` de 4-5 partidos) y comparar exacto después + `npm test` (42 invariantes).
> Sonnet 4.6 alcanza para todo esto con esa red de seguridad; reservar Opus para la parte estadística delicada (calibración, game-state).

---

## ⭐ TAREA 0 — COMPLETAR PLANTELES (HACER PRIMERO, ANTES QUE TODO LO DEMÁS)

Cargar en `data/players.json` las **31 selecciones que faltan** del Mundial 2026, para que todas las mejoras del modelo se prueben con datos reales.

**Metodología (la misma que se usó para las 17 ya cargadas):** por cada país, en orden →
1. Buscar en la web el plantel/alineación probable WC2026 (convocatoria de 26 + XI titular).
2. Cargar ~12-14 jugadores con `elo_impact` según escala: **crack 30-35, titular clave 18-26, titular sólido 12-17, rotación 6-11**. `base_elo` = el de `data/elo-calibrated.json`.
3. Marcar `available:false` a los lesionados/dudas reales (descuenta Elo). Omisiones de convocatoria (no lesionados) NO se marcan, simplemente no se incluyen.
4. Validar JSON + `node squad-strength.mjs <slug>`.
5. **Commit individual por país** + push.

**OJO:** la escala de `elo_impact` es heurística (ver Mejora F) y el ajuste de plantel hoy solo resta y solo toca el ataque (bugs #5, #6). Cargar los planteles es válido igual — el dato queda listo para cuando se arreglen esos bugs.

### Las 31 que faltan (slug + base_elo de elo-calibrated.json)

**Tier alto (Elo ≥1850) — 10:** spain 2075, argentina 2069, france 2046, england 1998, brazil 1997, portugal 1957, morocco 1909, belgium 1893, colombia 1888, croatia 1869.

**Tier medio (1700-1849) — 6:** switzerland 1831, austria 1778, iran 1757, uzbekistan 1725, canada 1714, algeria 1712.

**Tier bajo (<1700) — 15:** dr-congo 1702, egypt 1693, iraq 1682, scotland 1676, saudi-arabia 1650, ghana 1645, cape-verde 1636, czech-republic 1615, qatar 1606, panama 1596, south-africa 1576, bosnia-and-herzegovina 1568, jordan 1558, new-zealand 1552, haiti 1501.

_Total: 31 selecciones. Sugerencia: arrancar por el tier alto (más data pública y más relevantes para apuestas), pero el orden es libre._

_Ya cargadas (17): australia, curacao, ecuador, germany, ivory-coast, japan, mexico, netherlands, norway, paraguay, senegal, south-korea, sweden, tunisia, turkey, uruguay, usa._

> Verificar al cerrar: `node -e "console.log(Object.keys(require('./data/players.json').teams).length)"` debería dar 48.

---

## 🐞 BUGS CONFIRMADOS (con ubicación)

### Alto impacto

1. **`HOME_ADV_OFFSET` y `homeBonus()` son código muerto** — [context.mjs:18-22,40-43](context.mjs#L18)
   - Definen ventaja de localía por equipo (mexico +20, usa +10, canada +5, japan +12, etc.) y la función `homeBonus()`, pero **nadie los llama** en la ruta de predicción.
   - [predict.mjs:56](predict.mjs#L56) y [halftime.mjs:35](halftime.mjs#L35) hardcodean `±75`.
   - Efecto: con 3 anfitriones en WC2026, México/USA/Canadá de local reciben +75 en vez de +95/+85/+80. Subvalúa a los hosts.
   - **Fix:** que predict/halftime usen `homeBonus(home, true)` en lugar del 75 fijo.

2. **Desajuste train/serve del home bonus** — [calibrate.mjs:55](calibrate.mjs#L55) vs [predict.mjs:56](predict.mjs#L56)
   - Calibración aplica `HOME_ADV/2 = 37.5` y **solo a anfitriones**; predicción aplica `75` a cualquier local.
   - Los ratings Elo se calibraron con un supuesto de localía distinto al que usa la predicción.
   - **Fix:** definir UN valor de home advantage y usarlo idéntico en calibración y predicción.

3. **halftime.mjs implementa un modelo distinto al principal** — [halftime.mjs:39,59-63](halftime.mjs#L59)
   - Sin Dixon-Coles (usa `poissonPmf × poissonPmf` plano) → subestima empates y marcadores bajos (0-0, 1-1).
   - No importa `squadAdjustment` → ignora lesionados en vivo (ej. la baja de Yıldız NO se reflejó en los recálculos en vivo de Australia-Turquía).
   - No aplica venue/context.
   - **Fix:** unificar con el núcleo (ver Mejora A).

4. **bet-ev.mjs no aplica `squadAdjustment`** — [bet-ev.mjs:25-36](bet-ev.mjs#L25)
   - `matchXg()` usa Elo y SPI crudos sin `sqA.ratio` ni el ajuste de Elo.
   - Efecto: el EV del tracker mostró Australia 40.6% mientras predict.mjs con plantel daba 42.7%.
   - **Fix:** unificar con el núcleo (Mejora A).

### Impacto medio

5. **El ajuste de plantel solo toca el ATAQUE, no la defensa** — [predict.mjs:73-74](predict.mjs#L73), [analyze.mjs:45](analyze.mjs#L45)
   - Hacen `attack * ratio` pero dejan `defense` intacta. Perder un defensor clave (ej. Van Dijk) no empeora la defensa SPI, solo baja el ataque del equipo.
   - Parcialmente compensado por el ajuste de Elo (simétrico), pero la mitad SPI (65% del peso) ignora la pérdida defensiva.
   - **Fix:** escalar también `defense` (peor defensa = beta mayor) cuando faltan defensores, idealmente ponderando `elo_impact` por posición.

6. **`squadAdjustment` solo resta, nunca refleja la calidad base** — [squad-strength.mjs:18](squad-strength.mjs#L18)
   - `adjustment` siempre ≤ 0 (solo descuenta bajas). No puede codificar "este plantel es más talentoso de lo que dice su Elo".
   - Caso Australia-Turquía: el modelo acertó, pero por la razón equivocada (defensa SPI), ciego a que Güler/Çalhanoğlu inclinaban el talento hacia Turquía.

### Impacto bajo / robustez

7. **Umbral de EV inconsistente** — [predict.mjs:112](predict.mjs#L112) marca ✓ con `ev>0.03`, pero CLAUDE.md recomienda +5% mínimo en 1X2. Alinear.
8. **halftime.mjs rechaza minuto ≥90** — [halftime.mjs:30](halftime.mjs#L30) (`minute > 89`): no permite recalcular en tiempo de descuento.
9. **halftime.mjs no valida goles negativos** (solo NaN). Menor.

---

## 🚀 BACKLOG DE MEJORAS (prioridad sugerida)

### A. Unificar el modelo en un núcleo único `predictMatch()` ⭐ PRIMERO
Hoy **predict.mjs, halftime.mjs y bet-ev.mjs implementan el modelo de 3 formas distintas** (tabla abajo).
Extraer `predictMatch(a, b, {home, phase, venue, live, squad, scoreNow, minute})` a un módulo y que los tres lo llamen.
Resuelve bugs #3 y #4 de un golpe. Validar con baseline + `npm test`.

| Tool | Dixon-Coles | Squad adj | Venue/context |
|---|---|---|---|
| predict.mjs | ✅ | ✅ (solo ataque) | ✅ |
| halftime.mjs | ❌ | ❌ | ❌ |
| bet-ev.mjs | parcial | ❌ | ✅ |

### B. Cablear home advantage por equipo + unificar con calibración
Resuelve bugs #1 y #2. Decidir valor único, usar `homeBonus()` en todos lados, recalibrar si hace falta.

### C. Ajuste de plantel sobre defensa + aporte de calidad base
Resuelve bugs #5 y #6. Requiere calibrar la escala de `elo_impact` primero (Mejora F).

### D. Efecto "game state" en vivo
halftime.mjs y la evaluación en vivo tratan los minutos restantes como continuación neutral con el mismo xG.
Empíricamente el que pierde ataca más y el que gana se repliega. Añadir multiplicador de hazard por diferencia de gol y minuto.
Mejora directamente TODA apuesta en vivo (lección de Australia-Turquía: dudábamos a mano de Turquía-0 y Australia-gana-2T).

### E. Tamaño de apuesta (Kelly) + detector de correlación ⭐ MÁS VALOR PARA EL BANKROLL
El sistema calcula EV por apuesta pero ignora:
- **Correlación:** los 9 boletos de Australia-Turquía eran la MISMA tesis ("Australia rinde"); tratados como independientes. Salió bien y amplificó la ganancia, pero un 1-1 al 80' los tumbaba casi todos juntos. El CLAUDE.md registra el drawdown de −$36k por all-ins correlacionados.
- **Stake sizing:** no hay Kelly fraccionario; se apuesta monto fijo.
- **Fix:** `stake.mjs` con Kelly fraccionario + aviso "estas N apuestas dependen del mismo resultado, exposición efectiva = X".

### F. Calibrar la escala de `elo_impact`
Los valores (crack 30-35, titular clave 18-26, etc.) son a ojo. La suma por equipo varía (~150-190), así que el mismo `ratio` significa cosas distintas en valor absoluto. Anclar a algo medible (valor de mercado, minutos jugados).

### G. EV ajustado por margen de la casa (de-vig)
El EV (`prob × cuota − 1`) es correcto pero no compara contra la prob justa del mercado sin overround.
Un "edge vs consenso del mercado" separaría valor real de simple desacuerdo con un mercado afilado (útil con el caveat AFC/UEFA).

### H. Tests de consistencia
Agregar invariantes que verifiquen: predict == halftime == bet-ev para el mismo partido (misma prob 1X2 a t=0); que el home bonus se aplique; que el squad adj fluya a las tres tools.

---

## 📌 Estado del proyecto al cierre de sesión — 2026-06-14 (Sonnet)

### Bankroll
- **Saldo casa: ~$49.767**. P&L realizado **−$3.172 (−6.0%)** sobre capital propio $52.939.
- Historial: Canada-Bosnia −$9.450 · USA-Paraguay +$3.310 · Qatar-Suiza −$8.000 · Brasil-Marruecos −$21.500 · Haití-Escocia −$500 · Australia-Turquía +$33.220 · Alemania-Curazao −$18.351 · **Países Bajos-Japón +$18.099**.
- **Países Bajos 2-2 Japón — CERRADO. Ganancia neta: +$18.099**
  - Staked $22.649 (10 boletos, 3 duplicados por error). Cobrado $40.748.
  - Ganaron: Empate ×2 ($13.500) + HT/FT E/E ×2 ($21.250) + Par ($5.998)
  - Perdieron: Ninguno + 0:0 exacto + Menos 1.5 ×2 + Menos 0.5 live ($8.649)
  - Ningún mercado tenía EV positivo pre-partido. Se apostó por criterio propio del usuario viendo en vivo.

### Base de datos WC2026
- **9 partidos registrados** en `data/wc2026-results.json`:
  - Jun 11: México 2-0 Sudáfrica · Corea del Sur 2-1 Rep. Checa
  - Jun 12: Canadá 1-1 Bosnia · USA 4-1 Paraguay
  - Jun 13: Qatar 1-1 Suiza · Brasil 1-1 Marruecos · Haití 0-1 Escocia · Australia 2-0 Turquía
  - Jun 14: Alemania 7-1 Curazao
- **Pendientes del 14 junio** (registrar cuando terminen): Países Bajos vs Japón · Costa de Marfil vs Ecuador · Suecia vs Túnez
- `elo-live.json` actualizado con K=20 los 9 partidos. Usar `--live` en predict para partidos desde octavos; en fase de grupos `elo-calibrated.json` sigue siendo la referencia principal.
- **Track record modelo: 5/9 (56%)**, RPS promedio 0.136. (Backtest histórico: 64% / RPS 0.1637)

### players.json
- **48 equipos cargados** (todos los clasificados al WC2026). Tarea 0 completada en sesión anterior (Opus).
- Bajas activas marcadas: Yıldız (tur), Xavi Simons (ned), Mitoma/Endo/Minamino (jpn).
- Escala `elo_impact` heurística (ver Mejora F). Squad adj solo toca ataque, no defensa (Bug #5).

### Infraestructura
- `bet-ev.mjs`: market types `team_total_under` / `team_total_over` / `team_total_exact` disponibles.
- `bets.json`: market types disponibles incluyen `exact_score`, `half_total_under`, `odd_even`, `result`, `htft_combo`.
- 42 tests pasan. Node: `C:\Program Files\nodejs\node.exe`. Respuestas en español.

### Lecciones de esta sesión
- **Alemania-Curazao:** el modelo marcó EV positivo en "2-3 goles totales" (+16.6%) y "más de 0.5 Curazao" (+6.9%). El partido terminó 7-1 (goleada histórica). La varianza extrema destruyó todas las apuestas de goles salvo Curazao <1.5.
- **Live odds mejoran el EV:** "Menos 5.5" pasó de 2.90 (EV −0.5%) a 3.10 (EV +6.3%) en vivo. Vale la pena esperar a odds live en mercados de goles para partidos muy asimétricos.
- **Correlación sigue sin resolverse (Mejora E):** los 11 boletos de Alemania-Curazao y los 9 de NED-JAP son variaciones de la misma tesis. Cuando el resultado va en contra amplifica la pérdida.
- **NED-JAP:** ningún mercado tenía EV positivo (todos negativos). El modelo y la casa estaban alineados. Se apostó igual por criterio propio del usuario (partido en vivo). Se duplicaron 3 boletos por error (Empate, Menos 1.5, E/E).
