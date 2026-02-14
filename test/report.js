#!/usr/bin/env node
// ============================================================
// REPORT.JS — Primal Chase Simulation Report Generator
// Takes simulation output and produces formatted tables + charts
// Usage: node test/report.js [path-to-results.json]
// ============================================================

const fs = require('fs');
const path = require('path');

// ============================================================
// TABLE FORMATTING
// ============================================================

function padRight(str, len) { return String(str).padEnd(len); }
function padLeft(str, len) { return String(str).padStart(len); }

function drawTable(headers, rows, title) {
  const widths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, String(row[i]).length), 0);
    return Math.max(h.length, maxRow) + 2;
  });

  const sep = '+' + widths.map(w => '-'.repeat(w)).join('+') + '+';
  const headerLine = '|' + headers.map((h, i) => padRight(' ' + h, widths[i])).join('|') + '|';

  const lines = [];
  if (title) {
    lines.push('');
    lines.push(`  ${title}`);
    lines.push(`  ${'='.repeat(title.length)}`);
  }
  lines.push(sep);
  lines.push(headerLine);
  lines.push(sep);
  for (const row of rows) {
    lines.push('|' + row.map((cell, i) => padRight(' ' + cell, widths[i])).join('|') + '|');
  }
  lines.push(sep);
  return lines.join('\n');
}

// ============================================================
// ASCII BAR CHART
// ============================================================

function barChart(data, title, maxWidth = 40) {
  const lines = [];
  lines.push('');
  lines.push(`  ${title}`);
  lines.push(`  ${'='.repeat(title.length)}`);

  const maxVal = Math.max(...Object.values(data));
  const labelWidth = Math.max(...Object.keys(data).map(k => k.length));

  for (const [label, value] of Object.entries(data)) {
    const barLen = maxVal > 0 ? Math.round((value / maxVal) * maxWidth) : 0;
    const bar = '#'.repeat(barLen);
    const pct = ((value / Object.values(data).reduce((a, b) => a + b, 0)) * 100).toFixed(1);
    lines.push(`  ${padRight(label, labelWidth)} |${bar} ${value} (${pct}%)`);
  }
  return lines.join('\n');
}

// ============================================================
// SPARKLINE (hunter distance over time)
// ============================================================

function sparkline(values, maxWidth = 60) {
  const blocks = ' _.-=+*#@';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  let line = '';
  // Sample down if too many points
  const step = Math.max(1, Math.floor(values.length / maxWidth));
  for (let i = 0; i < values.length; i += step) {
    const normalized = (values[i] - min) / range;
    const idx = Math.min(blocks.length - 1, Math.round(normalized * (blocks.length - 1)));
    line += blocks[idx];
  }
  return line;
}

// ============================================================
// REPORT GENERATION
// ============================================================

const STRATEGY_LABELS = {
  'push-heavy': 'Push Heavy', 'trot-heavy': 'Trot Heavy', 'balanced': 'Balanced',
  'rest-heavy': 'Rest Heavy', 'smart': 'Smart', 'gto': 'GTO'
};
function stratLabel(s) { return STRATEGY_LABELS[s] || s; }

function generateReport(data) {
  const output = [];

  output.push('\n' + '='.repeat(60));
  output.push('  PRIMAL CHASE — SIMULATION REPORT');
  output.push('='.repeat(60));

  // ---- Summary table per strategy ----
  const summaryHeaders = ['Strategy', 'Games', 'Avg Days', 'Median', 'Min', 'Max', 'Avg Dist', 'Lost Hunters'];
  const summaryRows = [];
  for (const [strategy, d] of Object.entries(data)) {
    summaryRows.push([
      stratLabel(strategy), d.n, d.days.avg, d.days.median, d.days.min, d.days.max,
      d.distance.avg + ' mi', d.lostHunters.avg
    ]);
  }
  output.push(drawTable(summaryHeaders, summaryRows, 'SURVIVAL SUMMARY'));

  // ---- Death cause distribution per strategy ----
  for (const [strategy, d] of Object.entries(data)) {
    output.push(barChart(d.deathCauses, `DEATH CAUSES — ${stratLabel(strategy).toUpperCase()}`));
  }

  // ---- Combined death causes ----
  const combinedDeaths = {};
  for (const d of Object.values(data)) {
    for (const [cause, count] of Object.entries(d.deathCauses)) {
      combinedDeaths[cause] = (combinedDeaths[cause] || 0) + count;
    }
  }
  output.push(barChart(combinedDeaths, 'DEATH CAUSES — ALL STRATEGIES COMBINED'));

  // ---- Hunter distance over time (first strategy with data) ----
  for (const [strategy, d] of Object.entries(data)) {
    if (d.avgHunterDistByDay && Object.keys(d.avgHunterDistByDay).length > 0) {
      const days = Object.keys(d.avgHunterDistByDay).map(Number).sort((a, b) => a - b);
      const values = days.map(day => d.avgHunterDistByDay[day]);

      output.push('');
      output.push(`  HUNTER DISTANCE OVER TIME — ${stratLabel(strategy).toUpperCase()}`);
      output.push(`  ${'='.repeat(40)}`);

      const hdHeaders = ['Day', 'Avg Distance', 'Trend'];
      const hdRows = [];
      for (let i = 0; i < days.length && i < 20; i++) {
        const day = days[i];
        const dist = d.avgHunterDistByDay[day];
        const barLen = Math.max(0, Math.round(dist));
        const bar = '#'.repeat(Math.min(barLen, 30));
        hdRows.push([day, dist + ' mi', bar]);
      }
      output.push(drawTable(hdHeaders, hdRows));
    }
  }

  // ---- Stat trajectories (for first strategy) ----
  const firstStrategy = Object.keys(data)[0];
  if (firstStrategy && data[firstStrategy].avgStatsByDay) {
    const d = data[firstStrategy];
    const days = Object.keys(d.avgStatsByDay).map(Number).sort((a, b) => a - b);

    output.push('');
    output.push(`  STAT TRAJECTORIES — ${stratLabel(firstStrategy).toUpperCase()} (avg values per day)`);
    output.push(`  ${'='.repeat(50)}`);

    const statHeaders = ['Day', 'Heat', 'Stamina', 'Thirst', 'Hunger'];
    const statRows = [];
    for (let i = 0; i < days.length && i < 15; i++) {
      const day = days[i];
      const s = d.avgStatsByDay[day];
      statRows.push([day, s.heat, s.stamina, s.thirst, s.hunger]);
    }
    output.push(drawTable(statHeaders, statRows));
  }

  // ---- Encounter variety stats ----
  const varietyHeaders = ['Strategy', 'Unique Encounters', 'Terrain Repeat Gap'];
  const varietyRows = [];
  for (const [strategy, d] of Object.entries(data)) {
    varietyRows.push([stratLabel(strategy), d.uniqueEncountersAvg, d.avgTerrainRepeatGap]);
  }
  output.push(drawTable(varietyHeaders, varietyRows, 'ENCOUNTER VARIETY'));

  // ---- Encounter frequency (combined across all strategies) ----
  const combinedTerrains = {};
  const combinedOpportunities = {};
  const combinedPressures = {};
  let combinedTotal = 0;

  for (const d of Object.values(data)) {
    if (!d.encounterFrequency) continue;
    combinedTotal += d.encounterFrequency.totalEncounters;
    for (const [id, count] of Object.entries(d.encounterFrequency.terrains || {})) {
      combinedTerrains[id] = (combinedTerrains[id] || 0) + count;
    }
    for (const [id, count] of Object.entries(d.encounterFrequency.opportunities || {})) {
      combinedOpportunities[id] = (combinedOpportunities[id] || 0) + count;
    }
    for (const [id, count] of Object.entries(d.encounterFrequency.pressures || {})) {
      combinedPressures[id] = (combinedPressures[id] || 0) + count;
    }
  }

  if (combinedTotal > 0) {
    const pct = (count) => ((count / combinedTotal) * 100).toFixed(1);
    const sortDesc = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

    const terrainHeaders = ['Terrain', 'Count', '%'];
    const terrainRows = sortDesc(combinedTerrains).map(([id, count]) => [id, count, pct(count) + '%']);
    output.push(drawTable(terrainHeaders, terrainRows, `TERRAIN FREQUENCY (${combinedTotal} total encounters)`));

    const oppHeaders = ['Opportunity', 'Count', '%'];
    const oppRows = sortDesc(combinedOpportunities).map(([id, count]) => [id, count, pct(count) + '%']);
    output.push(drawTable(oppHeaders, oppRows, 'OPPORTUNITY FREQUENCY'));

    const pressHeaders = ['Pressure', 'Count', '%'];
    const pressRows = sortDesc(combinedPressures).map(([id, count]) => [id, count, pct(count) + '%']);
    output.push(drawTable(pressHeaders, pressRows, 'PRESSURE FREQUENCY'));
  }

  // ---- Key findings ----
  output.push('');
  output.push('  KEY FINDINGS');
  output.push('  ============');

  // Find which strategy survives longest
  let bestStrategy = null;
  let bestDays = 0;
  for (const [strategy, d] of Object.entries(data)) {
    if (d.days.avg > bestDays) {
      bestDays = d.days.avg;
      bestStrategy = strategy;
    }
  }
  if (bestStrategy) {
    output.push(`  Best strategy: ${stratLabel(bestStrategy)} (avg ${bestDays} days)`);
  }

  // Find most common death cause
  const totalDeaths = Object.entries(combinedDeaths).sort((a, b) => b[1] - a[1]);
  if (totalDeaths.length > 0) {
    const totalGames = totalDeaths.reduce((sum, [, c]) => sum + c, 0);
    output.push(`  Most common death: ${totalDeaths[0][0]} (${((totalDeaths[0][1] / totalGames) * 100).toFixed(1)}%)`);
  }

  // Check if game is too easy or too hard
  const allDays = [];
  for (const d of Object.values(data)) {
    allDays.push(d.days.avg);
  }
  const overallAvg = allDays.reduce((a, b) => a + b, 0) / allDays.length;
  if (overallAvg < 4) {
    output.push(`  WARNING: Game is very hard (avg ${overallAvg.toFixed(1)} days). Consider easing balance.`);
  } else if (overallAvg > 12) {
    output.push(`  WARNING: Game may be too easy (avg ${overallAvg.toFixed(1)} days). Consider tightening balance.`);
  } else {
    output.push(`  Balance looks reasonable (avg ${overallAvg.toFixed(1)} days across strategies).`);
  }

  output.push('');
  return output.join('\n');
}

// ============================================================
// MAIN
// ============================================================

function run() {
  const inputFile = process.argv[2] || path.join(__dirname, 'results', 'latest.json');

  if (!fs.existsSync(inputFile)) {
    console.error(`No results file found at: ${inputFile}`);
    console.error('Run simulate.js first: node test/simulate.js');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const report = generateReport(data);
  console.log(report);

  // Also save report as text file
  const reportPath = inputFile.replace('.json', '-report.txt');
  fs.writeFileSync(reportPath, report);
  console.log(`Report saved to: ${reportPath}`);
}

if (require.main === module) {
  run();
}

module.exports = { generateReport };
