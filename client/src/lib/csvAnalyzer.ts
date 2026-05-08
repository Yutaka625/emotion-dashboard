/*
 * DESIGN: Neuro-Signal Interface
 * Browser-side CSV parser and analysis engine
 * Replicates Python analysis logic entirely in TypeScript
 */

import type { DashboardData, EmotionStats, AffectDynamics, BaselineOffsets, TimeseriesPoint, HeadMotionEvent, ChangePoint } from './types';

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

export function parseCSV(text: string): Record<string, string>[] {
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

// CSV テキストから DashboardData を生成するエントリーポイント（既存の呼び出し元と互換）
export function analyzeCSV(csvText: string, filename: string): DashboardData {
  const rows = parseCSV(csvText);
  if (rows.length === 0) throw new Error('CSVデータが空です');
  return computeDashboardData(rows, filename);
}

// パース済みの行配列から DashboardData を計算する（マルチ FaceID 対応用に分離）
export function computeDashboardData(rows: Record<string, string>[], filename: string): DashboardData {
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
    // FACIAL_COLS = [...EMOTION_COLS, 'attention'] — attention を含めて抽出する
    for (const col of [...FACIAL_COLS, ...SPECIAL_COLS, ...ACTION_UNIT_COLS, ...HEAD_POSE_COLS]) {
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
  // Face detection rate: frames where any face data column is present (not empty string in raw CSV)
  // We use the raw rows to detect whether the row has any face data (emotion or AU columns not empty)
  const faceDetectedCount = rows.filter(r => {
    // A frame has face data if at least one emotion column is non-empty (even if 0)
    return EMOTION_COLS.some(col => r[col] !== undefined && r[col].trim() !== '');
  }).length;
  const totalRawRows = rows.length;

  // Emotion detection rate: frames where at least one non-neutral emotion > 0
  const emotionDetectedCount = df.filter(r => {
    return NON_NEUTRAL.some(col => (r[col] as number) > 0);
  }).length;

  const face_detection_rate = round((faceDetectedCount / totalRawRows) * 100, 2);
  const emotion_detection_rate = round((emotionDetectedCount / n) * 100, 2);

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
    face_detection_rate,
    emotion_detection_rate,
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
  for (const col of ['engagement', 'valence', 'attention'] as const) {
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

  // ---- 22. Head motion events (うなづき・首振り・首傾げ検知) ----
  const head_motion_events = detectHeadMotions(df.map(r => ({
    time: r.time,
    pitch: r.pitch as number,
    yaw: r.yaw as number,
    roll: r.roll as number,
  })));

  // ---- 23. Change point detection (感情スコアの急変点検出) ----
  const change_points = detectChangePoints(timeseries_full);

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
    head_motion_events,
    change_points,
  };
}

// ============================================================
// 変化点検出（Change Point Detection）
// ============================================================

/**
 * 感情スコアの急変点を検出する。
 * 3秒窓の移動平均を計算し、連続する窓間の差分がグローバルstdの2.5倍を超えた
 * タイミングを変化点として返す。同一感情の2秒以内の重複は除外。
 * @param points - timeseries_full (ダウンサンプル済み)
 * @returns 変化量の大きい順に上位20件の ChangePoint[]
 */
export function detectChangePoints(points: TimeseriesPoint[]): ChangePoint[] {
  if (points.length < 10) return [];

  const emotions = [
    'anger', 'contempt', 'disgust', 'fear', 'joy',
    'sadness', 'surprise', 'sentimentality', 'confusion',
  ] as const;

  const results: ChangePoint[] = [];

  for (const emotion of emotions) {
    const values = points.map(p => p[emotion]);
    const times = points.map(p => p.time);

    // フレームレートからウィンドウサイズを推定（約3秒分）
    const totalTime = times[times.length - 1] - times[0];
    const framesPerSec = points.length / (totalTime || 1);
    const windowSize = Math.max(3, Math.round(framesPerSec * 3));

    // グローバルstdで閾値を決定
    const globalStd = std(values.filter(v => !isNaN(v)));
    const threshold = globalStd * 2.5;
    if (threshold === 0) continue;

    // ウィンドウ移動平均の差分を計算
    const lastEmotionEvent: number[] = []; // 直近イベントの時刻（重複除外用）

    for (let i = windowSize; i < points.length - windowSize; i++) {
      const prevWindow = values.slice(i - windowSize, i).filter(v => !isNaN(v));
      const nextWindow = values.slice(i, i + windowSize).filter(v => !isNaN(v));
      if (prevWindow.length === 0 || nextWindow.length === 0) continue;

      const delta = mean(nextWindow) - mean(prevWindow);
      if (Math.abs(delta) < threshold) continue;

      const t = times[i];

      // 同一感情で2秒以内の重複を除外
      const isDuplicate = lastEmotionEvent.some(lt => Math.abs(t - lt) < 2.0);
      if (isDuplicate) continue;

      lastEmotionEvent.push(t);
      results.push({
        time: round(t, 2),
        emotion,
        delta: round(delta, 4),
        direction: delta > 0 ? 'rise' : 'fall',
      });
    }
  }

  // 変化量の絶対値が大きい順に上位20件を返す
  return results
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 20)
    .sort((a, b) => a.time - b.time); // 時刻順に並び直す
}

// ============================================================
// マルチ FaceID ユーティリティ
// ============================================================

/**
 * CSV ヘッダーから FaceID 列を検出する（大文字小文字・スペース・アンダースコア不問）
 * 例: "FaceId", "face_id", "Face ID", "faceid" のいずれにもマッチ
 */
export function detectFaceIdColumn(headers: string[]): string | null {
  return headers.find(h => /^face\s*_?\s*id$/i.test(h.trim())) ?? null;
}

/**
 * パース済みの CSV 行を FaceID 別にグルーピングする
 * @param rows - parseCSV() で取得した生行配列
 * @param faceIdCol - FaceID 列のヘッダー名
 * @returns FaceID をキーとした Map（出現順を保持）
 */
export function groupRowsByFaceId(
  rows: Record<string, string>[],
  faceIdCol: string
): Map<string, Record<string, string>[]> {
  const groups = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const id = row[faceIdCol]?.trim() || 'unknown';
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(row);
  }
  return groups;
}

// ============================================================
// ベースライン補正ユーティリティ（純粋関数・非破壊）
// ============================================================

// 補正対象の感情フィールド一覧
const BASELINE_EMOTION_COLS = [
  'anger', 'contempt', 'disgust', 'fear', 'joy',
  'sadness', 'surprise', 'sentimentality', 'confusion', 'neutral'
] as const;

/**
 * ベースライン区間内の各感情スコアの平均値（オフセット）を計算する
 * @param points - timeseries_full 全体のデータ
 * @param rangeStart - ベースライン区間の開始秒
 * @param rangeEnd   - ベースライン区間の終了秒
 * @returns 各感情のオフセット平均値（区間にデータがない場合は全て 0）
 */
export function computeBaselineOffsets(
  points: TimeseriesPoint[],
  rangeStart: number,
  rangeEnd: number
): BaselineOffsets {
  // ベースライン区間内のデータだけを取り出す
  const baselinePoints = points.filter(p => p.time >= rangeStart && p.time <= rangeEnd);

  // 区間内にデータがなければオフセット 0（補正なし）として返す
  if (baselinePoints.length === 0) {
    return { anger: 0, contempt: 0, disgust: 0, fear: 0, joy: 0, sadness: 0, surprise: 0, sentimentality: 0, confusion: 0, neutral: 0 };
  }

  // 各感情フィールドの平均値を計算してオフセットとする
  const offsets = {} as BaselineOffsets;
  for (const col of BASELINE_EMOTION_COLS) {
    const values = baselinePoints.map(p => p[col]).filter(v => !isNaN(v));
    offsets[col] = values.length > 0 ? mean(values) : 0;
  }
  return offsets;
}

/**
 * 全タイムスタンプにオフセット補正を適用した新しい配列を返す（元データは変更しない）
 * 補正後にマイナスになった値は 0 に丸める（「発現なし」として扱う）
 * @param points - 補正対象の TimeseriesPoint[]
 * @param offsets - computeBaselineOffsets で計算したオフセット
 * @returns 補正後の新しい TimeseriesPoint[]
 */
export function applyBaselineCorrection(
  points: TimeseriesPoint[],
  offsets: BaselineOffsets
): TimeseriesPoint[] {
  return points.map(p => {
    // time / engagement / valence / attention / dominant_emotion は変更しない
    const corrected = { ...p };
    for (const col of BASELINE_EMOTION_COLS) {
      // 元スコア − オフセット、マイナスは 0 に丸める
      corrected[col] = Math.max(0, p[col] - offsets[col]);
    }
    return corrected;
  });
}

/**
 * スライディングウィンドウで感情の総活性量が最小の区間を検出してベースライン候補として返す。
 * @param points     - timeseries_full 全体のデータ
 * @param windowSec  - 検索するウィンドウ幅（秒）。デフォルト 30 秒
 * @returns 最小活性区間の [開始秒, 終了秒]。データ不足時は先頭 windowSec 秒を返す
 */
export function detectBaselineWindow(
  points: TimeseriesPoint[],
  windowSec: number = 30
): [number, number] {
  if (points.length === 0) return [0, windowSec];

  const startTime = points[0].time;
  const endTime = points[points.length - 1].time;
  const duration = endTime - startTime;

  // データ長がウィンドウ未満の場合は全区間を返す
  if (duration <= windowSec) return [round(startTime, 3), round(endTime, 3)];

  // ウィンドウを 1 秒刻みでスライドさせ、各位置での感情合計平均を計算
  let bestStart = startTime;
  let bestScore = Infinity;

  const step = Math.max(1, Math.floor((duration - windowSec) / 60)); // 最大60ステップ
  for (let ws = startTime; ws <= endTime - windowSec; ws += step) {
    const we = ws + windowSec;
    const windowPoints = points.filter(p => p.time >= ws && p.time <= we);
    if (windowPoints.length === 0) continue;

    // 非ニュートラル感情の合計平均（小さいほど落ち着いている）
    const score = mean(
      windowPoints.map(p =>
        BASELINE_EMOTION_COLS
          .filter(e => e !== 'neutral')
          .reduce((sum, e) => sum + p[e], 0)
      )
    );

    if (score < bestScore) {
      bestScore = score;
      bestStart = ws;
    }
  }

  return [round(bestStart, 1), round(Math.min(bestStart + windowSec, endTime), 1)];
}

// ============================================================
// 頭部動作検知（うなづき・首振り・首傾げ）
// ============================================================

/**
 * per-frame の pitch/yaw/roll から「明確な頭部動作」を検知してイベント一覧を返す。
 *
 * 検知ロジック:
 *   - 移動平均で信号を平滑化（追跡ノイズを除去）
 *   - 各軸の局所的な極値（ピーク・トラフ）を検出
 *   - 連続する極値間の振幅が閾値を超え、かつ持続時間が妥当な範囲なら動作として登録
 *
 * 閾値 (度):
 *   - うなづき (pitch): 8°
 *   - 首振り   (yaw):  12°
 *   - 首傾げ   (roll): 15°
 */
function detectHeadMotions(
  df: Array<{ time: number; pitch: number; yaw: number; roll: number }>
): HeadMotionEvent[] {
  if (df.length < 10) return [];

  const times = df.map(r => r.time);
  const hasMeaningfulData = (vals: number[]) => vals.some(v => !isNaN(v) && Math.abs(v) > 0.5);

  // 移動平均による平滑化
  const smooth = (vals: number[], w: number): number[] =>
    vals.map((_, i) => {
      const s = Math.max(0, i - w);
      const e = Math.min(vals.length - 1, i + w);
      let sum = 0;
      for (let j = s; j <= e; j++) sum += (isNaN(vals[j]) ? 0 : vals[j]);
      return sum / (e - s + 1);
    });

  const pitchRaw = df.map(r => (isNaN(r.pitch) ? 0 : r.pitch));
  const yawRaw   = df.map(r => (isNaN(r.yaw)   ? 0 : r.yaw));
  const rollRaw  = df.map(r => (isNaN(r.roll)   ? 0 : r.roll));

  if (!hasMeaningfulData(pitchRaw) && !hasMeaningfulData(yawRaw) && !hasMeaningfulData(rollRaw)) {
    return []; // pitch/yaw/roll のデータがなければスキップ
  }

  const ps = smooth(pitchRaw, 3);
  const ys = smooth(yawRaw, 3);
  const rs = smooth(rollRaw, 3);

  const events: HeadMotionEvent[] = [];

  /**
   * 局所的な極値インデックスを返す（前後 2 点との比較）
   */
  const findExtrema = (vals: number[]): number[] => {
    const idx: number[] = [];
    for (let i = 2; i < vals.length - 2; i++) {
      const isPeak   = vals[i] >= vals[i-1] && vals[i] >= vals[i+1] && vals[i] > vals[i-2] && vals[i] > vals[i+2];
      const isTrough = vals[i] <= vals[i-1] && vals[i] <= vals[i+1] && vals[i] < vals[i-2] && vals[i] < vals[i+2];
      if (isPeak || isTrough) idx.push(i);
    }
    return idx;
  };

    /**
   * うなづき・首振り用: 連続する 3 極値 (a→b→c) で「往復（方向反転）」を検知する。
   * a→b と b→c の符号が逆（反対方向へ折り返している）場合のみイベントとして登録。
   * 一方向のみの動きは除外される。
   *
   * @param vals      - 平滑化済みの角度列
   * @param type      - 動作種別
   * @param threshold - 往路・復路それぞれの振幅閾値（度）
   * @param maxDur    - 往復全体の最大持続時間（秒）
   */
  const detectOscillation = (
    vals: number[],
    type: HeadMotionEvent['type'],
    threshold: number,
    maxDur: number
  ) => {
    const extremaIdx = findExtrema(vals);
    let lastEventEnd = -Infinity;

    // 3 点 (a, b, c) を sliding window で走査
    for (let i = 2; i < extremaIdx.length; i++) {
      const ai = extremaIdx[i - 2]; // 始点
      const bi = extremaIdx[i - 1]; // 折り返し点
      const ci = extremaIdx[i];     // 終点

      const amp1 = vals[bi] - vals[ai]; // 往路の変化量（符号付き）
      const amp2 = vals[ci] - vals[bi]; // 復路の変化量（符号付き）

      // 方向が逆（往復している）かつ両方の振幅が閾値以上
      const isReversal = amp1 * amp2 < 0;
      const strongEnough = Math.abs(amp1) >= threshold && Math.abs(amp2) >= threshold;

      const tStart   = times[ai];
      const tEnd     = times[ci];
      const duration = tEnd - tStart;

      if (
        isReversal &&
        strongEnough &&
        duration >= 0.3 &&
        duration <= maxDur &&
        tStart > lastEventEnd
      ) {
        // 変化量は往路・復路のうち大きい方を代表値とする
        const magnitude = round(Math.max(Math.abs(amp1), Math.abs(amp2)), 1);
        events.push({
          type,
          time_start: round(tStart, 2),
          time_end:   round(tEnd, 2),
          magnitude,
        });
        lastEventEnd = tEnd;
      }
    }
  };

  /**
   * 首傾げ用: 一方向への大きな変化でも検知する（往復不要）。
   * 傾いたまま維持するのが自然な動作のため、単一極値ペアで検出。
   */
  const detectTilt = (
    vals: number[],
    threshold: number,
    maxDur: number
  ) => {
    const extremaIdx = findExtrema(vals);
    let lastEventEnd = -Infinity;

    for (let i = 1; i < extremaIdx.length; i++) {
      const pi = extremaIdx[i - 1];
      const ci = extremaIdx[i];
      const amplitude = Math.abs(vals[ci] - vals[pi]);
      const tStart = times[pi];
      const tEnd   = times[ci];
      const duration = tEnd - tStart;

      if (
        amplitude >= threshold &&
        duration >= 0.2 &&
        duration <= maxDur &&
        tStart > lastEventEnd
      ) {
        events.push({
          type: 'tilt',
          time_start: round(tStart, 2),
          time_end:   round(tEnd, 2),
          magnitude:  round(amplitude, 1),
        });
        lastEventEnd = tEnd;
      }
    }
  };

  // うなづき・首振りは往復（反転）のみ検出
  detectOscillation(ps, 'nod',   8,  4.0); // うなづき: pitch 各方向 8° 以上の往復
  detectOscillation(ys, 'shake', 12, 5.0); // 首振り:   yaw  各方向 12° 以上の往復
  // 首傾げは一方向への変化でも検出（傾いて維持が自然）
  detectTilt(rs, 15, 5.0);

  return events.sort((a, b) => a.time_start - b.time_start);
}
