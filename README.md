# 🏆 World Cup 2026 Prediction Model

An open-source statistical model that forecasts **2026 FIFA World Cup** matches and title odds —
**Elo ratings → Dixon-Coles bivariate Poisson → Monte Carlo simulation**. No machine-learning
black box, no scraped bookmaker odds: just transparent, reproducible football maths.

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
| **Ranked Probability Score** (the football standard, ↓) | **0.175** | coin-flip 0.241 |
| Log-loss (↓) | **0.89** | coin-flip 1.10 |
| Brier score (↓) | **0.52** | coin-flip 0.67 |
| **Expected Calibration Error** (↓) | **2.3%** | < 5% = well-calibrated |
| Correct result (win/draw/loss) | **62%** | always-home 49% · coin-flip 33% |
| When a clear favourite (p ≥ 50%) | **69%** | — |

### Is it calibrated? (the chart that matters)

A forecaster is honest when the things it calls "70%" happen about 70% of the time. Pooling every
probability the model issued across the out-of-sample matches:

| Model said | Actually happened | n |
|---|---|---|
| 5% | 7% | 225 |
| 15% | 13% | 374 |
| 26% | 24% | 804 |
| 35% | 32% | 205 |
| 45% | 54% | 200 |
| 55% | 56% | 149 |
| 65% | 67% | 136 |
| 75% | 76% | 95 |
| 85% | 85% | 100 |

> _**Changelog** — Jun 11, 2026: Monte Carlo raised to **50,000 trials** (5× lower tail noise);
> in-tournament conditioning is live; backtest extended with RPS + a reliability curve + ECE;
> data refreshed through Jun 2026. · Jun 7: goal-model variance denominator 350→400; per-team
> strength priors applied on the live site on top of this core model._

No model is a crystal ball — football is high-variance and draws are genuinely hard. These are
well-calibrated estimates, and we make **no claim to beat the betting market**.

## 📊 Live track record (2026)

The model's call on **every finished match** of the tournament, updated as it happens:

<!-- TRACK-RECORD:START -->
**2/3 correct picks (67%) · avg RPS 0.131** (coin-flip ≈ 0.245) · updated 2026-06-12

| Date | Result | Model's pick | |
|---|---|---|---|
| 2026-06-12 | Canada 1–1 Bosnia & Herzegovina | Canada 59% | ❌ |
| 2026-06-11 | South Korea 2–1 Czech Republic | South Korea 49% | ✅ |
| 2026-06-11 | Mexico 2–0 South Africa | Mexico 71% | ✅ |

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

node predict.mjs brazil argentina      # head-to-head probabilities
node predict.mjs usa mexico usa        # 3rd arg = home team (host bonus)
node backtest.mjs                      # reproduce the accuracy numbers
node calibrate.mjs                     # rebuild ratings from data/results.json
```

Example:

```
$ node predict.mjs spain germany

  spain (Elo 2074)  vs  germany (Elo 1927)   [neutral]

  spain            win   53.2%  ████████████████
  draw                   26.8%  ████████
  germany          win   20.0%  ██████
```

## How it works

1. **Team strength (Elo).** Each nation starts from a long-run prior, then is calibrated on
   recent real internationals — wins over strong sides in important games move a rating more than
   friendlies, and recent form outweighs old form. See [`calibrate.mjs`](./calibrate.mjs).
2. **Each match (Dixon-Coles Poisson).** Ratings → expected goals → a Dixon-Coles bivariate
   Poisson gives win/draw/loss probabilities. The Dixon-Coles correction fixes plain Poisson's
   well-known under-count of low-scoring draws (0-0, 1-1). See [`elo.mjs`](./elo.mjs).
3. **The tournament (Monte Carlo).** The live site plays all 104 matches **50,000 times** through
   the real bracket to get championship & advancement odds — and, now the tournament is underway,
   **locks every finished result** (real standings, real qualifiers, real bracket slots) and
   simulates only what's left. Full write-up:
   [cup26matches.com/methodology](https://cup26matches.com/en/methodology/).

## Files

| File | What |
|---|---|
| `elo.mjs` | The match model — Elo, Dixon-Coles τ, Poisson, `matchProb`, `sampleMatch` |
| `calibrate.mjs` | Build calibrated ratings from `data/results.json` |
| `backtest.mjs` | Walk-forward out-of-sample evaluation (RPS, log-loss, Brier, ECE + reliability curve) |
| `predict.mjs` | CLI head-to-head predictor |
| `track-record.mjs` | Regenerates the live 2026 track-record table in this README |
| `data/results.json` | 913 real international results (Oct 2023 – Jun 2026) |
| `data/elo-calibrated.json` | Calibrated Elo for the 48 finalists |
| `data/wc2026-results.json` | Finished 2026 World Cup matches (feeds the track record) |
| `data/model-backtest.json` | Saved backtest metrics |

## License

MIT — see [LICENSE](./LICENSE). Built by [Cup26 AI](https://cup26matches.com). If you use it,
a link back is appreciated. ⭐ the repo if you find it useful!
