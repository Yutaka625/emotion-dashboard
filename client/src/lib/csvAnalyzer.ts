/*
 * DESIGN: Neuro-Signal Interface
 * Browser-side CSV parser and analysis engine
 * Replicates Python analysis logic entirely in TypeScript
 */

import type { DashboardData, EmotionStats, AffectDynamics } from './types';

const EMOTION_COLS = ['anger', 'contempt', 'disgust', 'fear', 'joy', 'sadness', 'surprise', 'sentimentality', 'confusion', 'neutral'];
const NON_NEUTRAL = ['anger', 'contempt', 'disgust', 'fear', 'joy', 'sadness', 'surprise', 'sentimentality', 'confusion'];
const SPECIAL_COLS = ['engagement', 'valence'];
const FACIAL_COLS = [...EMOTION_COLS, 'attention']; // attention treated as facial expression metric
const ACTION_UNIT_COLS = [
  'inner brow raise', 'brow raise', 'brow furrow', 'eye widen', 'cheek raise',
  'lid tighten', 'nose wrinkle', 'upper lip raise', 'dimpler', 'lip corner depressor',
  'chin raise', 'lip pucker', 'lip stretch', 'lip press', 'mouth open', 'jaw drop',
  'lip suck', 'eye closure', 'smile', 'smirk', 'blink', 'blink rate'
];
const HEAD_POSE_COLS = ['pitch', 'yaw', 'roll'];

// ---- Utility math functions ----

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (upper - pos) + sorted[upper] * (pos - lower);
}

function computeStats(values: number[]): EmotionStats {
  const valid = values.filter(v => !isNaN(v));
  if (valid.length === 0) return { mean: 0, std: 0, min: 0, max: 0, median: 0, q25: 0, q75: 0 };
  const sorted = [...valid].sort((a, b) => a - b);
  return {
    mean: round(mean(valid), 4),
    std: round(std(valid), 4),
    min: round(sorted[0], 4),
    max: round(sorted[sorted.length - 1], 4),
    median: round(quantile(sorted, 0.5), 4),
    q25: round(quantile(sorted, 0.25), 4),
    q75: round(quantile(sorted, 0.75), 4),
  };
}

function round(v: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

// AR(1) inertia
function ar1(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const centered = arr.map(v => v - m);
  let num = 0, den = 0;
  for (let i = 1; i < centered.length; i++) {
    num += centered[i - 1] * centered[i];
    den += centered[i - 1] ** 2;
  }
  return den === 0 ? 0 : round(num / den, 4);
}

// Mean Squared Successive Difference
function mssd(arr: number[]): number {
  if (arr.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < arr.length; i++) {
    sum += (arr[i] - arr[i - 1]) ** 2;
  }
  return round(sum / (arr.length - 1), 4);
}

function computeAffectDynamics(values: number[]): AffectDynamics {
  const valid = values.filter(v => !isNaN(v));
  if (valid.length < 2) return { variability_sd: 0, instability_mssd: 0, inertia_ar1: 0, range: 0, mean_absolute_change: 0 };
  const sorted = [...valid].sort((a, b) => a - b);
  const changes = [];
  for (let i = 1; i < valid.length; i++) changes.push(Math.abs(valid[i] - valid[i - 1]));
  return {
    variability_sd: round(std(valid), 4),
    instability_mssd: mssd(valid),
    inertia_ar1: ar1(valid),
    range: round(sorted[sorted.length - 1] - sorted[0], 4),
    mean_absolute_change: round(mean(changes), 4),
  };
}

// Pearson correlation
function pearson(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const mx = mean(x), my = mean(y);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : round(num / denom, 4);
}

// ---- CSV Parser ----

function parseCSV(text: string): Record<string, string>[] {
  // Handle BOM
  const cleaned = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    if (vals.length < headers.length) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx]?.trim() ?? '';
    });
    rows.push(row);
  }
  return rows;
}

// ---- Main Analysis Function ----

export function analyzeCSV(csvText: string, filename: string): DashboardData {
  const rows = parseCSV(csvText);
  if (rows.length === 0) throw new Error('CSVデータが空です');

  // Extract time from index (first column = time stamp)
  // The first column header is "time stamp" but the index (row key 0) is the actual time
  const headers = Object.keys(rows[0]);
  const timeCol = headers[0]; // "time stamp" is the first column, its values are the actual timestamps

  // Build typed data frame
  type Row = {
    time: number;
    dominant_emotion: string;
    [key: string]: number | string;
  };

  const df: Row[] = rows.map(r => {
    const time = parseFloat(r[timeCol]);
    const row: Row = { time: isNaN(time) ? 0 : time, dominant_emotion: '' };
    for (const col of [...EMOTION_COLS, ...SPECIAL_COLS, ...ACTION_UNIT_COLS, ...HEAD_POSE_COLS]) {
      const v = parseFloat(r[col]);
      row[col] = isNaN(v) ? 0 : v;
    }
    // Dominant emotion = argmax of non-neutral emotions
    let maxVal = -Infinity, maxEmo = 'confusion';
    for (const e of NON_NEUTRAL) {
      const v = row[e] as number;
      if (v > maxVal) { maxVal = v; maxEmo = e; }
    }
    row.dominant_emotion = maxEmo;
    return row;
  }).filter(r => !isNaN(r.time));

  // Sort by time
  df.sort((a, b) => a.time - b.time);

  const n = df.length;
  if (n === 0) throw new Error('有効なデータが見つかりませんでした');

  const times = df.map(r => r.time);
  const durationSec = times[n - 1] - times[0];

  // Parse recording date/time from filename
  const fnMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
  const recordingDate = fnMatch ? `${fnMatch[1]}-${fnMatch[2]}-${fnMatch[3]}` : filename.slice(0, 10);
  const recordingTime = fnMatch ? `${fnMatch[4]}:${fnMatch[5]}:${fnMatch[6]}` : '';

  // ---- 1. Meta ----
  const meta: DashboardData['meta'] = {
    filename,
    total_frames: n,
    duration_seconds: round(durationSec, 3),
    duration_minutes: round(durationSec / 60, 3),
    fps_avg: round(n / durationSec, 2),
    start_time: round(times[0], 3),
    end_time: round(times[n - 1], 3),
    recording_date: recordingDate,
    recording_time: recordingTime,
  };

  // ---- 2. Emotion stats ----
  const emotion_stats: DashboardData['emotion_stats'] = {};
  for (const col of EMOTION_COLS) {
    emotion_stats[col] = computeStats(df.map(r => r[col] as number));
  }

  // ---- 3. Special stats ----
  const special_stats: DashboardData['special_stats'] = {};
  for (const col of SPECIAL_COLS) {
    special_stats[col] = computeStats(df.map(r => r[col] as number));
  }
  // attention is a facial expression metric — add to emotion_stats
  emotion_stats['attention'] = computeStats(df.map(r => r['attention'] as number));

  // ---- 4. Timeseries full (downsample to max 600 points for performance) ----
  const maxPoints = 600;
  const step = Math.max(1, Math.floor(n / maxPoints));
  const timeseries_full = df.filter((_, i) => i % step === 0).map(r => ({
    time: round(r.time, 3),
    engagement: round(r.engagement as number, 4),
    valence: round(r.valence as number, 4),
    attention: round(r.attention as number, 4),
    anger: round(r.anger as number, 4),
    contempt: round(r.contempt as number, 4),
    disgust: round(r.disgust as number, 4),
    fear: round(r.fear as number, 4),
    joy: round(r.joy as number, 4),
    sadness: round(r.sadness as number, 4),
    surprise: round(r.surprise as number, 4),
    sentimentality: round(r.sentimentality as number, 4),
    confusion: round(r.confusion as number, 4),
    neutral: round(r.neutral as number, 4),
    dominant_emotion: r.dominant_emotion,
  }));

  // ---- 5. Time summary (10s bins) ----
  const binSize = 10;
  const startTime = times[0];
  const numBins = Math.ceil(durationSec / binSize);
  const time_summary_10s: DashboardData['time_summary_10s'] = [];

  for (let b = 0; b < numBins; b++) {
    const tStart = startTime + b * binSize;
    const tEnd = tStart + binSize;
    const binRows = df.filter(r => r.time >= tStart && r.time < tEnd);
    if (binRows.length === 0) continue;

    const entry: DashboardData['time_summary_10s'][0] = {
      time_start: round(tStart - startTime, 1),
      time_end: round(tEnd - startTime, 1),
      frame_count: binRows.length,
      engagement_mean: round(mean(binRows.map(r => r.engagement as number)), 4),
      valence_mean: round(mean(binRows.map(r => r.valence as number)), 4),
      attention_mean: round(mean(binRows.map(r => r.attention as number)), 4),
      dominant_emotion: (() => {
        const counts: Record<string, number> = {};
        binRows.forEach(r => { counts[r.dominant_emotion] = (counts[r.dominant_emotion] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      })(),
    };
    for (const e of EMOTION_COLS) {
      entry[`${e}_mean`] = round(mean(binRows.map(r => r[e] as number)), 4);
    }
    time_summary_10s.push(entry);
  }

  // ---- 6. Emotion transitions ----
  const emotion_transitions: DashboardData['emotion_transitions'] = {};
  for (const e of NON_NEUTRAL) emotion_transitions[e] = {};
  for (let i = 1; i < df.length; i++) {
    const from = df[i - 1].dominant_emotion;
    const to = df[i].dominant_emotion;
    if (!emotion_transitions[from]) emotion_transitions[from] = {};
    emotion_transitions[from][to] = (emotion_transitions[from][to] || 0) + 1;
  }

  // ---- 7. Emotion duration stats ----
  const emotion_duration_stats: DashboardData['emotion_duration_stats'] = {};
  for (const e of NON_NEUTRAL) {
    const durations: number[] = [];
    let runLen = 0;
    for (let i = 0; i < df.length; i++) {
      if (df[i].dominant_emotion === e) {
        runLen++;
      } else if (runLen > 0) {
        durations.push(runLen / meta.fps_avg);
        runLen = 0;
      }
    }
    if (runLen > 0) durations.push(runLen / meta.fps_avg);
    emotion_duration_stats[e] = {
      count: durations.length,
      mean_duration: durations.length > 0 ? round(mean(durations), 3) : 0,
      max_duration: durations.length > 0 ? round(Math.max(...durations), 3) : 0,
      total_duration: round(durations.reduce((a, b) => a + b, 0), 3),
    };
  }

  // ---- 8. Engagement distribution ----
  const engValues = df.map(r => r.engagement as number);
  const engagement_distribution: Record<string, number> = {
    'Very Low (0-20)': engValues.filter(v => v < 20).length,
    'Low (20-40)': engValues.filter(v => v >= 20 && v < 40).length,
    'Medium (40-60)': engValues.filter(v => v >= 40 && v < 60).length,
    'High (60-80)': engValues.filter(v => v >= 60 && v < 80).length,
    'Very High (80-100)': engValues.filter(v => v >= 80).length,
  };

  // ---- 9. Valence distribution ----
  const valValues = df.map(r => r.valence as number);
  const valRange = (special_stats.valence.max - special_stats.valence.min) || 1;
  const valMin = special_stats.valence.min;
  const valBinSize = valRange / 5;
  const valence_distribution: Record<string, number> = {};
  for (let b = 0; b < 5; b++) {
    const lo = valMin + b * valBinSize;
    const hi = lo + valBinSize;
    const label = `${round(lo, 1)}~${round(hi, 1)}`;
    valence_distribution[label] = valValues.filter(v => v >= lo && (b === 4 ? v <= hi : v < hi)).length;
  }

  // ---- 10. Correlation matrix ----
  const corrCols = ['engagement', 'valence', 'attention', ...NON_NEUTRAL.slice(0, 6)];
  const corrData: number[][] = corrCols.map(c1 =>
    corrCols.map(c2 => pearson(df.map(r => r[c1] as number), df.map(r => r[c2] as number)))
  );
  const correlation_matrix: DashboardData['correlation_matrix'] = { labels: corrCols, data: corrData };

  // ---- 11. Engagement correlations ----
  const engArr = df.map(r => r.engagement as number);
  const engagement_correlations: Record<string, number> = {};
  for (const col of [...EMOTION_COLS, 'valence', 'attention']) {
    engagement_correlations[col] = pearson(engArr, df.map(r => r[col] as number));
  }

  // ---- 12. Valence correlations ----
  const valArr = df.map(r => r.valence as number);
  const valence_correlations: Record<string, number> = {};
  for (const col of [...EMOTION_COLS, 'engagement', 'attention']) {
    valence_correlations[col] = pearson(valArr, df.map(r => r[col] as number));
  }

  // ---- 13. Affect dynamics ----
  const affect_dynamics: DashboardData['affect_dynamics'] = {};
  for (const col of [...SPECIAL_COLS, 'attention', ...NON_NEUTRAL.slice(0, 5)]) {
    affect_dynamics[col] = computeAffectDynamics(df.map(r => r[col] as number));
  }

  // ---- 14. Emotion prevalence ----
  const emotion_prevalence: DashboardData['emotion_prevalence'] = {};
  const threshold = 0.3;
  for (const e of NON_NEUTRAL) {
    const vals = df.map(r => r[e] as number);
    const count = vals.filter(v => v > threshold).length;
    emotion_prevalence[e] = {
      threshold,
      prevalence_pct: round((count / n) * 100, 2),
      count,
    };
  }

  // ---- 15. Action unit stats ----
  const action_unit_stats: DashboardData['action_unit_stats'] = {};
  for (const au of ACTION_UNIT_COLS) {
    const vals = df.map(r => r[au] as number).filter(v => !isNaN(v));
    if (vals.length === 0) continue;
    action_unit_stats[au] = {
      mean: round(mean(vals), 4),
      max: round(Math.max(...vals), 4),
      active_pct: round((vals.filter(v => v > 0.5).length / vals.length) * 100, 2),
    };
  }

  // ---- 16. Head pose stats ----
  const head_pose_stats: DashboardData['head_pose_stats'] = {};
  for (const col of HEAD_POSE_COLS) {
    const vals = df.map(r => r[col] as number).filter(v => !isNaN(v));
    if (vals.length === 0) continue;
    const sorted = [...vals].sort((a, b) => a - b);
    head_pose_stats[col] = {
      mean: round(mean(vals), 4),
      std: round(std(vals), 4),
      min: round(sorted[0], 4),
      max: round(sorted[sorted.length - 1], 4),
    };
  }

  // ---- 17. Dominant emotion counts/pct ----
  const dominant_emotion_counts: Record<string, number> = {};
  for (const e of NON_NEUTRAL) dominant_emotion_counts[e] = 0;
  df.forEach(r => { dominant_emotion_counts[r.dominant_emotion] = (dominant_emotion_counts[r.dominant_emotion] || 0) + 1; });
  const dominant_emotion_pct: Record<string, number> = {};
  for (const e of NON_NEUTRAL) {
    dominant_emotion_pct[e] = round(((dominant_emotion_counts[e] || 0) / n) * 100, 2);
  }

  // ---- 18. Scatter engagement vs valence (downsample to 300) ----
  const scatterStep = Math.max(1, Math.floor(n / 300));
  const scatter_eng_val = df.filter((_, i) => i % scatterStep === 0).map(r => ({
    time: round(r.time, 2),
    engagement: round(r.engagement as number, 3),
    valence: round(r.valence as number, 3),
    dominant: r.dominant_emotion,
    attention: round(r.attention as number, 3),
  }));

  // ---- 19. Circumplex summary ----
  const engMed = special_stats.engagement.median;
  const valMed = special_stats.valence.median;
  const circumplex_summary: DashboardData['circumplex_summary'] = {
    high_arousal_positive: df.filter(r => (r.engagement as number) >= engMed && (r.valence as number) >= valMed).length,
    high_arousal_negative: df.filter(r => (r.engagement as number) >= engMed && (r.valence as number) < valMed).length,
    low_arousal_positive: df.filter(r => (r.engagement as number) < engMed && (r.valence as number) >= valMed).length,
    low_arousal_negative: df.filter(r => (r.engagement as number) < engMed && (r.valence as number) < valMed).length,
    note: 'Engagement=Arousal proxy, Valence=Valence (Russell 1980 Circumplex Model)',
  };

  // ---- 20. Engagement emotion profile ----
  const highEng = df.filter(r => (r.engagement as number) >= 50);
  const lowEng = df.filter(r => (r.engagement as number) < 50);
  const profileMean = (rows: Row[], col: string) => rows.length > 0 ? round(mean(rows.map(r => r[col] as number)), 4) : 0;
  const engagement_emotion_profile: DashboardData['engagement_emotion_profile'] = {
    high_engagement: Object.fromEntries(EMOTION_COLS.map(e => [e, profileMean(highEng, e)])),
    low_engagement: Object.fromEntries(EMOTION_COLS.map(e => [e, profileMean(lowEng, e)])),
    high_count: highEng.length,
    low_count: lowEng.length,
  };

  // ---- 21. Histograms ----
  const histograms: DashboardData['histograms'] = {};
  for (const col of ['engagement', 'valence', 'attention']) {
    const vals = df.map(r => r[col] as number).filter(v => !isNaN(v));
    const sorted = [...vals].sort((a, b) => a - b);
    const bins = 20;
    const minV = sorted[0], maxV = sorted[sorted.length - 1];
    const binW = (maxV - minV) / bins || 1;
    const counts = new Array(bins).fill(0);
    const bin_edges = Array.from({ length: bins + 1 }, (_, i) => round(minV + i * binW, 2));
    vals.forEach(v => {
      const idx = Math.min(Math.floor((v - minV) / binW), bins - 1);
      counts[idx]++;
    });
    histograms[col] = { counts, bin_edges };
  }

  return {
    meta,
    emotion_stats,
    special_stats,
    timeseries_full,
    time_summary_10s,
    emotion_transitions,
    emotion_duration_stats,
    engagement_distribution,
    valence_distribution,
    correlation_matrix,
    engagement_correlations,
    valence_correlations,
    affect_dynamics,
    emotion_prevalence,
    action_unit_stats,
    head_pose_stats,
    dominant_emotion_counts,
    dominant_emotion_pct,
    scatter_eng_val,
    circumplex_summary,
    engagement_emotion_profile,
    histograms,
  };
}
