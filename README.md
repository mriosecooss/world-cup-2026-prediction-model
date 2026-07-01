# 🏆 World Cup 2026 Prediction Model

An open-source statistical model that forecasts **2026 FIFA World Cup** matches and title odds —
**blended Elo + SPI ratings → Dixon-Coles bivariate Poisson → Monte Carlo simulation**. No
machine-learning black box, no scraped bookmaker odds: just transparent, reproducible football maths.

**▶ Live predictions (full 48-team, 50,000-simulation model):** **https://cup26matches.com**
· [How it works / methodology](https://cup26matches.com/en/methodology/)
· [Live insight feed](https://cup26matches.com/en/live/)
· [Interactive bracket simulator](https://cup26matches.com/en/simulator/)

> 🔴 **The tournament is LIVE (Jun 11 – Jul 19).** The production model now **conditions on real
> results**: finished matches are locked, eliminated teams collapse to 0%, the actual bracket
> (incl. the new best-third qualification, solved with bipartite matching) is used, and only the
> remaining matches are simulated — re-run automatically within minutes of every full-time whistle.
>
> This repo open-sources the **core match model + our honest backtest** so you can run, inspect
> and reproduce the numbers.

---

## Why it's worth a look

It's tested the honest way — **walk-forward, out-of-sample** on **913 real internationals**
(Oct 2023 – Jun 2026). Every match is predicted using only data available *before* kickoff, then
scored against the actual result — with **proper scoring rules** (RPS, log-loss, Brier), not just
accuracy, because accuracy alone rewards lucky guessing. Reproduce it yourself in one command:

```bash
node backtest.mjs
```

| Metric (763 evaluated, 150 burn-in) | Model | Baseline |
|---|---|---|
| **Ranked Probability Score** (the football standard, ↓) | **0.164** | coin-flip 0.241 |
| Log-loss (↓) | **0.85** | coin-flip 1.10 |
| Brier score (↓) | **0.50** | coin-flip 0.67 |
| **Expected Calibration Error** (↓) | **1.9%** | < 5% = well-calibrated |
| Correct result (win/draw/loss) | **64%** | always-home 49% · coin-flip 33% |
| When a clear favourite (p ≥ 50%) | **71%** | — |

### Is it calibrated? (the chart that matters)

A forecaster is honest when the things it calls "70%" happen about 70% of the time. Pooling every
probability the model issued across the out-of-sample matches:

| Model said | Actually happened | n |
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

> _**Changelog** — Jun 13, 2026: **v5 core model** — Elo+SPI blend weight optimised to 0.65 via
> RPS grid search; competition-aware time-decay (World Cup half-life 30mo vs 6mo for friendlies);
> Dixon-Coles ρ calibrated on this dataset (−0.13→−0.075); backtest now evaluates the real blended
> model. · Jun 11: Monte Carlo raised to **50,000 trials** (5× lower tail noise); in-tournament
> conditioning is live; backtest extended with RPS + a reliability curve + ECE; data refreshed
> through Jun 2026. · Jun 7: goal-model variance denominator 350→400._

No model is a crystal ball — football is high-variance and draws are genuinely hard. These are
well-calibrated estimates, and we make **no claim to beat the betting market**.

## 📊 Live track record (2026)

The model's call on **every finished match** of the tournament, updated as it happens:

<!-- TRACK-RECORD:START -->
**50/78 correct picks (64%) · avg RPS 0.144** (coin-flip ≈ 0.245) · updated 2026-07-01

| Date | Result | Model's pick | |
|---|---|---|---|
| 2026-06-30 | France 3–0 Sweden | France 75% | ✅ |
| 2026-06-30 | Norway 2–1 Ivory Coast | Norway 42% | ✅ |
| 2026-06-29 | Netherlands 1–1 (2–3 p) Morocco | Morocco 41% | ❌ |
| 2026-06-29 | Germany 1–1 (3–4 p) Paraguay | Germany 56% | ❌ |
| 2026-06-29 | Brazil 2–1 Japan | Brazil 51% | ✅ |
| 2026-06-28 | Canada 1–0 South Africa | Canada 54% | ✅ |
| 2026-06-27 | Croatia 2–1 Ghana | Croatia 64% | ✅ |
| 2026-06-27 | Panama 0–2 England | England 80% | ✅ |
| 2026-06-23 | Panama 0–1 Croatia | Croatia 66% | ✅ |
| 2026-06-23 | England 0–0 Ghana | England 78% | ❌ |
| 2026-06-17 | Ghana 1–0 Panama | Ghana 38% | ✅ |
| 2026-06-17 | England 4–2 Croatia | England 49% | ✅ |
| 2026-06-27 | DR Congo 3–1 Uzbekistan | Draw 37% | ❌ |
| 2026-06-27 | Colombia 0–0 Portugal | Portugal 47% | ❌ |
| 2026-06-23 | Colombia 1–0 DR Congo | Colombia 60% | ✅ |
| 2026-06-23 | Portugal 5–0 Uzbekistan | Portugal 70% | ✅ |
| 2026-06-17 | Uzbekistan 1–3 Colombia | Colombia 64% | ✅ |
| 2026-06-17 | Portugal 1–1 DR Congo | Portugal 65% | ❌ |
| 2026-06-27 | Jordan 1–3 Argentina | Argentina 82% | ✅ |
| 2026-06-27 | Algeria 3–3 Austria | Algeria 41% | ❌ |
| 2026-06-22 | Jordan 1–2 Algeria | Algeria 68% | ✅ |
| 2026-06-22 | Argentina 2–0 Austria | Argentina 61% | ✅ |
| 2026-06-16 | Austria 3–1 Jordan | Austria 64% | ✅ |
| 2026-06-16 | Argentina 3–0 Algeria | Argentina 54% | ✅ |
| 2026-06-26 | Senegal 5–0 Iraq | Senegal 55% | ✅ |
| 2026-06-26 | Norway 1–4 France | France 52% | ✅ |
| 2026-06-22 | Norway 3–2 Senegal | Norway 50% | ✅ |
| 2026-06-22 | France 3–0 Iraq | France 76% | ✅ |
| 2026-06-16 | Iraq 1–4 Norway | Norway 65% | ✅ |
| 2026-06-16 | France 3–1 Senegal | France 64% | ✅ |
| 2026-06-26 | Uruguay 0–1 Spain | Spain 54% | ✅ |
| 2026-06-26 | Cape Verde 0–0 Saudi Arabia | Cape Verde 44% | ❌ |
| 2026-06-21 | Uruguay 2–2 Cape Verde | Uruguay 58% | ❌ |
| 2026-06-21 | Spain 4–0 Saudi Arabia | Spain 83% | ✅ |
| 2026-06-15 | Saudi Arabia 1–1 Uruguay | Uruguay 59% | ❌ |
| 2026-06-15 | Spain 0–0 Cape Verde | Spain 82% | ❌ |
| 2026-06-26 | New Zealand 0–5 Belgium | Belgium 81% | ✅ |
| 2026-06-26 | Egypt 1–1 Iran | Egypt 39% | ❌ |
| 2026-06-21 | New Zealand 1–3 Egypt | Egypt 53% | ✅ |
| 2026-06-21 | Belgium 0–0 Iran | Belgium 67% | ❌ |
| 2026-06-15 | Iran 2–2 New Zealand | Iran 47% | ❌ |
| 2026-06-15 | Belgium 1–1 Egypt | Belgium 62% | ❌ |
| 2026-06-25 | Tunisia 1–3 Netherlands | Netherlands 63% | ✅ |
| 2026-06-25 | Japan 1–1 Sweden | Japan 57% | ❌ |
| 2026-06-20 | Tunisia 0–4 Japan | Japan 56% | ✅ |
| 2026-06-20 | Netherlands 5–1 Sweden | Netherlands 64% | ✅ |
| 2026-06-14 | Sweden 5–1 Tunisia | Sweden 42% | ✅ |
| 2026-06-14 | Netherlands 2–2 Japan | Netherlands 39% | ❌ |
| 2026-06-25 | Ecuador 2–1 Germany | Germany 38% | ❌ |
| 2026-06-25 | Curacao 0–2 Ivory Coast | Ivory Coast 75% | ✅ |
| 2026-06-20 | Ecuador 0–0 Curacao | Ecuador 74% | ❌ |
| 2026-06-20 | Germany 2–1 Ivory Coast | Germany 51% | ✅ |
| 2026-06-14 | Ivory Coast 1–0 Ecuador | Ecuador 39% | ❌ |
| 2026-06-14 | Germany 7–1 Curacao | Germany 87% | ✅ |
| 2026-06-25 | Paraguay 0–0 Australia | Australia 38% | ❌ |
| 2026-06-25 | Turkey 3–2 USA | USA 43% | ❌ |
| 2026-06-19 | Turkey 1–0 Paraguay | Paraguay 36% | ❌ |
| 2026-06-19 | USA 2–0 Australia | USA 38% | ✅ |
| 2026-06-13 | Australia 2–0 Turkey | Australia 40% | ✅ |
| 2026-06-12 | USA 4–1 Paraguay | USA 41% | ✅ |
| 2026-06-24 | Morocco 4–2 Haiti | Morocco 87% | ✅ |
| 2026-06-24 | Scotland 0–3 Brazil | Brazil 67% | ✅ |
| 2026-06-19 | Brazil 3–0 Haiti | Brazil 89% | ✅ |
| 2026-06-19 | Scotland 0–1 Morocco | Morocco 56% | ✅ |
| 2026-06-13 | Haiti 0–1 Scotland | Scotland 73% | ✅ |
| 2026-06-13 | Brazil 1–1 Morocco | Brazil 42% | ❌ |
| 2026-06-24 | Bosnia & Herzegovina 3–1 Qatar | Bosnia & Herzegovina 44% | ✅ |
| 2026-06-24 | Switzerland 2–1 Canada | Switzerland 37% | ✅ |
| 2026-06-18 | Canada 6–0 Qatar | Canada 70% | ✅ |
| 2026-06-18 | Switzerland 4–1 Bosnia & Herzegovina | Switzerland 72% | ✅ |
| 2026-06-13 | Qatar 1–1 Switzerland | Switzerland 79% | ❌ |
| 2026-06-12 | Canada 1–1 Bosnia & Herzegovina | Canada 62% | ❌ |
| 2026-06-24 | South Africa 1–0 South Korea | South Korea 49% | ❌ |
| 2026-06-24 | Czech Republic 0–3 Mexico | Mexico 69% | ✅ |
| 2026-06-18 | Mexico 1–0 South Korea | Mexico 56% | ✅ |
| 2026-06-18 | Czech Republic 1–1 South Africa | Czech Republic 42% | ❌ |
| 2026-06-11 | South Korea 2–1 Czech Republic | South Korea 48% | ✅ |
| 2026-06-11 | Mexico 2–0 South Africa | Mexico 66% | ✅ |

_Every call is listed — hits and misses. Probabilities are the model's frozen pre-match numbers (ratings don't re-fit mid-tournament), so nothing here is retro-fitted. Reproduce with `node track-record.mjs`._
<!-- TRACK-RECORD:END -->

## 🧩 Embeddable widgets & open data

Run a blog, forum or fan site? The live model is embeddable — free, auto-updating all tournament:

```html
<!-- Live title-race board (top-10 championship odds, 50k sims) -->
<iframe src="https://cup26matches.com/embed/title-race/" width="100%" height="430"
  style="border:0;border-radius:12px" loading="lazy" title="World Cup 2026 title odds"></iframe>

<!-- Real-time next-match strip (live W/D/L, rotates at kickoff) -->
<iframe src="https://cup26matches.com/embed/next-match/" width="100%" height="92"
  style="border:0;border-radius:10px" loading="lazy" title="Next World Cup 2026 match"></iframe>
```

More widgets + copy-paste snippets: **[cup26matches.com/en/widgets](https://cup26matches.com/en/widgets/)**

**Open data** (CC BY 4.0 — free to use/quote/chart with a link back): the full per-team tournament
probabilities, regenerated after every match —
[probabilities.json](https://cup26matches.com/data/probabilities.json) ·
[probabilities.csv](https://cup26matches.com/data/probabilities.csv)

## Quick start

No dependencies. Node 18+.

```bash
git clone https://github.com/Hicruben/world-cup-2026-prediction-model.git
cd world-cup-2026-prediction-model

node predict.mjs brazil argentina               # head-to-head probabilities
node predict.mjs usa mexico usa                 # 3rd arg = home team (host bonus)
node predict.mjs brazil morocco --odds=2.2,3.4,3.9   # add expected value vs your odds
node halftime.mjs brazil morocco 1 0 67         # live recalculation from any minute
node backtest.mjs                               # reproduce the accuracy numbers
node calibrate.mjs                              # rebuild ratings from data
```

Example:

```
$ node predict.mjs spain germany

  SPAIN vs GERMANY  [neutral]

  spain            win   50.6%  ███████████████
  draw                   22.7%  ███████
  germany          win   26.7%  ████████

  xG esperados     :  2.05 – 1.47
```

## How it works

1. **Team strength (Elo + SPI).** Each nation starts from a long-run prior, then is calibrated on
   recent real internationals — wins over strong sides in important games move a rating more than
   friendlies, and recent form outweighs old form (competition-aware half-life: 30 months for World
   Cups down to 6 for friendlies). A second pass derives separate **attack/defense** parameters
   (SPI-style, Dixon-Coles EM). See [`calibrate.mjs`](./calibrate.mjs) + [`calibrate-spi.mjs`](./calibrate-spi.mjs).
2. **Each match (Dixon-Coles Poisson).** Ratings → expected goals → a Dixon-Coles bivariate
   Poisson gives win/draw/loss probabilities. The two views (Elo and SPI) are **blended 35/65**
   (weight optimised by RPS grid search). The Dixon-Coles correction (ρ = −0.075, MLE-calibrated on
   this dataset) fixes plain Poisson's under-count of low-scoring draws (0-0, 1-1). See [`elo.mjs`](./elo.mjs).
3. **The tournament (Monte Carlo).** The live site plays all 104 matches **50,000 times** through
   the real bracket to get championship & advancement odds — and, now the tournament is underway,
   **locks every finished result** (real standings, real qualifiers, real bracket slots) and
   simulates only what's left. Full write-up:
   [cup26matches.com/methodology](https://cup26matches.com/en/methodology/).

## Files

| File | What |
|---|---|
| `elo.mjs` | The match model — Elo, SPI blend, Dixon-Coles τ, Poisson, `matchProb`, `sampleMatch` |
| `calibrate.mjs` | Build calibrated Elo ratings (competition-aware time-decay) |
| `calibrate-spi.mjs` | Derive attack/defense (SPI) parameters via Dixon-Coles EM |
| `calibrate-blend.mjs` | Grid search for the optimal Elo/SPI blend weight (by RPS) |
| `calibrate-rho.mjs` | MLE calibration of the Dixon-Coles ρ on this dataset |
| `backtest.mjs` | Walk-forward out-of-sample evaluation (RPS, log-loss, Brier, ECE + reliability curve) |
| `predict.mjs` | CLI head-to-head predictor (`--odds` for EV, `--live` for in-tournament ratings) |
| `halftime.mjs` | Live in-match recalculation from any minute & scoreline |
| `add-result.mjs` | Append a finished 2026 result and refresh the track record |
| `update-elo-live.mjs` | Incremental Elo update from 2026 results (K=20) → `elo-live.json` |
| `track-record.mjs` | Regenerates the live 2026 track-record table in this README |
| `data/results.json` | 913 real international results (Oct 2023 – Jun 2026) |
| `data/elo-calibrated.json` | Calibrated Elo for the 48 finalists |
| `data/spi-ratings.json` | Attack/defense (SPI) parameters per team |
| `data/wc2026-results.json` | Finished 2026 World Cup matches (feeds the track record) |
| `data/model-backtest.json` | Saved backtest metrics |

## License

MIT — see [LICENSE](./LICENSE). Built by [Cup26 AI](https://cup26matches.com). If you use it,
a link back is appreciated. ⭐ the repo if you find it useful!
