---
name: balance
description: Run simulation, update baseline percentiles, and sync dashboard
disable-model-invocation: true
---

# Balance: Simulation and Baseline Update Workflow

This skill automates the full simulation, percentile update, and dashboard sync workflow for Primal Chase. Execute every step in order. Do not skip steps. Report results at each stage.

## Step 1: Run Simulation

Run the simulation engine with 1000 games per strategy across all difficulties:

```bash
node test/simulate.js --games=1000 --strategy=all --difficulty=all
```

This takes ~30-60 seconds. The engine runs 6 strategies (push-heavy, trot-heavy, balanced, rest-heavy, smart, gto) across 3 difficulties (easy, normal, hard) for 18,000 total games. Output is saved to `test/results/latest.json` and a timestamped copy.

Wait for this to complete before proceeding. Confirm it finished successfully by checking for the "Results saved to" and "Baseline stats saved to" output lines.

## Step 2: Generate Report

Run the report generator to produce a human-readable summary:

```bash
node test/report.js
```

This reads `test/results/latest.json` and prints an ASCII report with survival summaries, death cause distributions, hunter distance trends, and encounter frequency tables. A text copy is saved alongside the JSON.

Share key findings with the user: best strategy, average days survived, most common death cause, and whether balance looks reasonable.

## Step 3: Compute and Update Percentile Breakpoints

Read the file `test/baseline-stats.json` which was generated in Step 1. This file contains sorted arrays of all days and distances from normal-difficulty runs across all strategies combined.

The file structure is:
```json
{
  "generatedAt": "...",
  "totalGames": 6000,
  "days": [3, 3, 3, ...sorted array of all day values...],
  "distances": [2, 5, 8, ...sorted array of all distance values...],
  "deathCauses": { "caught": N, "dehydration": N, ... }
}
```

### Computing Breakpoints

From the sorted `days` array, compute breakpoints as `[value, percentile]` pairs. For each unique day value in the sorted array, calculate what percentage of all runs scored LOWER than that value (not equal to or lower -- strictly lower). Use these day values for breakpoints: 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17 (and higher if data supports it, but stop when the percentile would be 99 or above).

For each breakpoint value V:
- Count how many entries in the sorted array are strictly less than V
- Percentile = round(count / totalGames * 100)

Example: if totalGames = 6000 and 300 games had days < 5, then day 5 breakpoint = [5, 5] (i.e., 5%).

From the sorted `distances` array, compute breakpoints at intervals of 5: 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90 (and higher if data supports it, but stop when the percentile reaches 99).

For each breakpoint value V:
- Count how many entries in the sorted array are strictly less than V
- Percentile = round(count / totalGames * 100)

### Updating score.js

Read `js/score.js` and replace the `BASELINE_PERCENTILES` constant at the top of the file. The format must be exactly:

```javascript
// Pre-computed from Nsim simulation runs (6 strategies x Ngames games, normal difficulty)
// Each entry: [value, percent_of_runs_that_scored_lower]
const BASELINE_PERCENTILES = {
  days: [
    [3, 0], [4, X], [5, X], ...
  ],
  distances: [
    [0, 0], [5, X], [10, X], ...
  ]
};
```

Where:
- The comment on line 1 reflects the actual total game count (e.g., "6000 simulation runs (6 strategies x 1000 games, normal difficulty)")
- X values are the computed percentiles (integers, 0-99)
- The minimum day value in the sorted array always starts at percentile 0
- Distance 0 always starts at percentile 0
- Omit breakpoints where the percentile would exceed 99

Replace only the `BASELINE_PERCENTILES` block (from the comment line through the closing `};`). Do not modify any other code in score.js.

## Step 4: Sync Dashboard Data

Copy the simulation output to the deployed dashboard location:

```bash
cp test/results/latest.json stats/results/latest.json
```

Then copy the dashboard HTML:

```bash
cp test/charts.html stats/index.html
```

## Step 5: Verify

Confirm all updates by checking:

1. `js/score.js` -- the BASELINE_PERCENTILES object has been updated with new breakpoint values and the comment reflects the correct game count
2. `stats/results/latest.json` -- exists and matches `test/results/latest.json`
3. `stats/index.html` -- exists and matches `test/charts.html`

Report to the user:
- Total games simulated (per strategy and overall)
- Normal-difficulty GTO avg/median days (this is the primary balance indicator)
- Normal-difficulty overall avg days across all strategies
- Most common death cause
- Whether any balance warnings were raised
- The new percentile breakpoints for days and distances (as a formatted table)
- Reminder: changes are local only, not committed. Ask if they want to commit.
