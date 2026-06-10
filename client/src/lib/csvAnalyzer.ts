/*
 * DESIGN: Neuro-Signal Interface
 * Browser-side CSV parser and analysis engine
 * Replicates Python analysis logic entirely in TypeScript
 */

import type { DashboardData, EmotionStats, AffectDynamics, BaselineOffsets, BaselineCenter, BaselineDisplayMode, TimeseriesPoint, HeadMotionEvent, ChangePoint, UXScores } from './types';

const NON_NEUTRAL = ['anger', 'sadness', 'surprise', 'fear', 'joy', 'disgust', 'contempt', 'sentimentality', 'confusion'];
const EMOTION_COLS = [...NON_NEUTRAL, 'neutral'];
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
  if (valid.length === 0) return { mean: 0, std: 0, min: 0, max: 0, median: 0, q25: 0, q75: 0, n: 0 };
  const sorted = [...valid].sort((a, b) => a - b);
  return {
    mean: round(mean(valid), 4),
    std: round(std(valid), 4),
    min: round(sorted[0], 4),
    max: round(sorted[sorted.length - 1], 4),
    median: round(quantile(sorted, 0.5), 4),
    q25: round(quantile(sorted, 0.25), 4),
    q75: round(quantile(sorted, 0.75), 4),
    n: valid.length,
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

  // 時刻を 0 基点に正規化する。
  // CSV の「time stamp」列が絶対時刻（Unix秒など）でも、時間軸を必ず 0 始まりにそろえる。
  // これをしないと timeseries_full の time が巨大なまま残り、
  // 時系列セクションの時間フィルタ（0〜duration秒前提）に一致せずグラフが空になる。
  const rawStartTime = df[0].time;
  if (rawStartTime !== 0) {
    for (const r of df) r.time -= rawStartTime;
  }

  const times = df.map(r => r.time);
  const durationSec = times[n - 1] - times[0];

  // 1秒あたりのフレーム数（FPS）の算出に使うフレーム数。
  // 複数人（マルチFaceID）データでは、同一の時刻に人数分の行が存在する。
  // そのため行数(n)で割ると FPS が人数倍に膨らんでしまう。
  // ユニークなタイムスタンプの数＝実際のフレーム数で割ることで、人数に依らず正しい FPS になる。
  const uniqueFrameCount = new Set(times).size;

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
    fps_avg: durationSec > 0 ? round(uniqueFrameCount / durationSec, 2) : 0,
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

  // ---- 4b. 外れ値フラグ（IQR法）: ダウンサンプル後の timeseries_full に付与 ----
  // フェンス計算は全フレームから算出済みの emotion_stats / special_stats の q25/q75 を使用
  const outlierTargetCols = [...EMOTION_COLS, 'attention', ...SPECIAL_COLS];
  const outlier_counts: Record<string, number> = {};

  // 全フレーム（df）を使って外れ値カウントを集計
  for (const col of outlierTargetCols) {
    const stats = col in emotion_stats ? emotion_stats[col] : special_stats[col];
    if (!stats) continue;
    const iqr = stats.q75 - stats.q25;
    const lowerFence = stats.q25 - 1.5 * iqr;
    const upperFence = stats.q75 + 1.5 * iqr;
    outlier_counts[col] = df.filter(r => {
      const v = r[col] as number;
      return typeof v === 'number' && (v < lowerFence || v > upperFence);
    }).length;
  }

  // ダウンサンプル後の timeseries_full にフラグを付与
  for (const point of timeseries_full) {
    for (const col of outlierTargetCols) {
      const stats = col in emotion_stats ? emotion_stats[col] : special_stats[col];
      if (!stats) continue;
      const iqr = stats.q75 - stats.q25;
      const lowerFence = stats.q25 - 1.5 * iqr;
      const upperFence = stats.q75 + 1.5 * iqr;
      const v = (point as Record<string, unknown>)[col] as number;
      if (typeof v === 'number' && (v < lowerFence || v > upperFence)) {
        if (!point.outlierFlags) point.outlierFlags = {};
        point.outlierFlags[col] = true;
      }
    }
  }

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
  // 特殊指標3種＋非ニュートラル9感情すべてで相関行列を作る（12×12）。
  // 以前は NON_NEUTRAL.slice(0, 6) で6感情のみ（軽蔑・感傷・混乱が欠落）だった。
  // pearson は1セルあたり O(n) で、12×12=144セルでも負荷は軽微。
  const corrCols = ['engagement', 'valence', 'attention', ...NON_NEUTRAL];
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
  // 特殊指標（engagement/valence/attention）＋ 非ニュートラル9感情すべてを計算する。
  // 以前は NON_NEUTRAL.slice(0, 5) で先頭5感情のみ計算しており、
  // 嫌悪・軽蔑・感傷・混乱が未計算（学術/感情分布タブで値が0=空）になっていた。
  // computeAffectDynamics は1列あたり O(n) と軽いため全9感情を計算して問題ない。
  const affect_dynamics: DashboardData['affect_dynamics'] = {};
  for (const col of [...SPECIAL_COLS, 'attention', ...NON_NEUTRAL]) {
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
  // Russell(1980) の円環モデルは「絶対的な2次元感情空間」のため、分割は固定の中立点で行う。
  //   - Valence は符号付き（−100〜100）で 0 が中立 → 0 で分割
  //   - Engagement は覚醒度の代理（0〜100）で 50 を中点として分割
  // 旧実装はセッション中央値で分割していたが、構造上どのデータも各象限ほぼ25%になり情報量が失われ、
  // かつ「絶対値スケール前提（補正対象外）」という本指標の扱いと矛盾していたため固定中立点へ変更。
  const AROUSAL_MID = 50; // Engagement の中点（覚醒度の高低境界）
  const VALENCE_MID = 0;  // Valence の中立点（快−不快の境界）
  const circumplex_summary: DashboardData['circumplex_summary'] = {
    high_arousal_positive: df.filter(r => (r.engagement as number) >= AROUSAL_MID && (r.valence as number) >= VALENCE_MID).length,
    high_arousal_negative: df.filter(r => (r.engagement as number) >= AROUSAL_MID && (r.valence as number) < VALENCE_MID).length,
    low_arousal_positive: df.filter(r => (r.engagement as number) < AROUSAL_MID && (r.valence as number) >= VALENCE_MID).length,
    low_arousal_negative: df.filter(r => (r.engagement as number) < AROUSAL_MID && (r.valence as number) < VALENCE_MID).length,
    note: 'Engagement>=50=High Arousal, Valence>=0=Positive (Russell 1980 Circumplex Model, fixed neutral split)',
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

  // ---- 24. UX Research scores ----
  const ux_scores = computeUXScores(emotion_stats, special_stats, action_unit_stats);

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
    ux_scores,
    outlier_counts,
  };
}

// ============================================================
// UX Research スコア計算
// ============================================================

/**
 * 感情統計・エンゲージメント統計・アクションユニット統計から
 * UXリサーチ向け複合指標を計算する。
 */
function computeUXScores(
  emotion_stats: DashboardData['emotion_stats'],
  special_stats: DashboardData['special_stats'],
  action_unit_stats: DashboardData['action_unit_stats'],
): UXScores {
  // 感情スコアは 0〜100 スケールのため、0〜1 に正規化してから計算する
  const em = (col: string) => (emotion_stats[col]?.mean ?? 0) / 100;
  const sp = (col: string) => (special_stats[col]?.mean ?? 0) / 100;

  // Frustration Index: confusion×0.4 + anger×0.3 + sadness×0.2 + disgust×0.1
  const frustration_index = round(
    em('confusion') * 0.4 + em('anger') * 0.3 + em('sadness') * 0.2 + em('disgust') * 0.1,
    4,
  );

  // Delight Index: joy×0.5 + surprise×0.3 + sentimentality×0.2
  const delight_index = round(
    em('joy') * 0.5 + em('surprise') * 0.3 + em('sentimentality') * 0.2,
    4,
  );

  // Engagement Quality: engagement × max(0, 1 - confusion×2)
  const engMean = sp('engagement');
  const confMean = em('confusion');
  const engagement_quality = round(
    engMean * Math.max(0, 1 - confMean * 2),
    4,
  );

  // Cognitive Load: confusion×0.6 + (brow_furrow_active_pct/100)×0.4
  const browFurrowActive = (action_unit_stats['brow furrow']?.active_pct ?? 0) / 100;
  const cognitive_load = round(
    confMean * 0.6 + browFurrowActive * 0.4,
    4,
  );

  // UX Score (0〜100): delight×0.35 + engagement_quality×0.35 + (1-frustration)×0.20 + (1-cognitive_load)×0.10
  const ux_score = round(
    (delight_index * 0.35
      + engagement_quality * 0.35
      + (1 - Math.min(1, frustration_index)) * 0.20
      + (1 - Math.min(1, cognitive_load)) * 0.10
    ) * 100,
    1,
  );

  return { frustration_index, delight_index, engagement_quality, cognitive_load, ux_score };
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
  'anger', 'sadness', 'surprise', 'fear', 'joy',
  'disgust', 'contempt', 'sentimentality', 'confusion', 'neutral'
] as const;

// ベースライン補正の対象に含める特殊指標（engagement / valence / attention）。
// valence は signed（−100..100）のため lift（変化率）は不安定 → lift では「—」にする。
const BASELINE_SPECIAL_COLS = ['engagement', 'valence', 'attention'] as const;

// オフセット（中心値・SD）を計算する全列：全感情（neutral含む）＋特殊指標。
const BASELINE_OFFSET_COLS = [...BASELINE_EMOTION_COLS, ...BASELINE_SPECIAL_COLS];

// 実際に補正を適用する列：neutral は「無表情の基準」自体なので偏差化せず除外する。
// → 感情（neutral を除く9種）＋特殊指標。
const BASELINE_TARGET_COLS = [
  ...BASELINE_EMOTION_COLS.filter(c => c !== 'neutral'),
  ...BASELINE_SPECIAL_COLS,
];

// zscore が発散しないための SD 下限。ベースライン区間の SD がこれ未満なら NaN（「—」）にする。
// （区間が短い・ほぼ無変化のときに (x−μ)/σ が桁外れになるのを防ぐ）
const MIN_SD_FOR_ZSCORE = 0.05;

/**
 * 変化率(lift%)を「意味のある値」として算出できる最小ベースライン中心値。
 * 感情スコア(0〜1)は多くの時間ほぼ0でスパースなため、μが小さいと (x−μ)/μ が桁外れに発散する。
 * μ がこの値未満の感情は変化率を信頼できないものとして NaN（＝「—」表示）にする。
 */
const LIFT_MIN_BASELINE = 0.1;

/**
 * ベースライン区間内の各感情スコアの統計（中心値 offset とばらつき sd）を計算する
 * @param points - timeseries_full 全体のデータ
 * @param rangeStart - ベースライン区間の開始秒
 * @param rangeEnd   - ベースライン区間の終了秒
 * @param center - 中心値の計算方式（'mean'=平均減算 / 'median'=中央値減算）。デフォルト 'mean'
 * @returns 各感情の { offset, sd }（区間にデータがない場合は全て 0）
 */
export function computeBaselineOffsets(
  points: TimeseriesPoint[],
  rangeStart: number,
  rangeEnd: number,
  center: BaselineCenter = 'mean'
): BaselineOffsets {
  // ベースライン区間内のデータだけを取り出す
  const baselinePoints = points.filter(p => p.time >= rangeStart && p.time <= rangeEnd);

  const offsets = {} as BaselineOffsets;

  // 区間内にデータがなければ全列 { offset: 0, sd: 0 }（補正なし）として返す
  if (baselinePoints.length === 0) {
    for (const col of BASELINE_OFFSET_COLS) offsets[col] = { offset: 0, sd: 0 };
    return offsets;
  }

  // 各列（感情＋特殊指標）の中心値（平均 or 中央値）と標準偏差を計算する
  for (const col of BASELINE_OFFSET_COLS) {
    const values = baselinePoints.map(p => (p as any)[col] as number).filter(v => !isNaN(v));
    if (values.length === 0) {
      offsets[col] = { offset: 0, sd: 0 };
      continue;
    }
    // 中央値は昇順ソート後に quantile(0.5) で求める
    const offset = center === 'median'
      ? quantile([...values].sort((a, b) => a - b), 0.5)
      : mean(values);
    offsets[col] = { offset, sd: std(values) };
  }
  return offsets;
}

/**
 * 全タイムスタンプに表示モードに応じた補正を適用した新しい配列を返す（元データは変更しない）
 * @param points - 補正対象の TimeseriesPoint[]
 * @param offsets - computeBaselineOffsets で計算した各感情の { offset, sd }
 * @param mode - 表示モード（'absolute' のときは補正なしで原データを返す）
 *   - deviation: x − μ（符号付き偏差）
 *   - lift:      (x − μ)/μ × 100（変化率%。|μ| が LIFT_MIN_BASELINE 未満なら NaN として無効化）
 *   - zscore:    (x − μ)/σ（標準化。σ=0 のときは 0）
 * @returns 補正後の新しい TimeseriesPoint[]。0 クランプは行わない（負値は意味のある情報）
 */
export function applyBaselineCorrection(
  points: TimeseriesPoint[],
  offsets: BaselineOffsets,
  mode: BaselineDisplayMode = 'deviation'
): TimeseriesPoint[] {
  // absolute は補正不要 — 原データをそのまま返す
  if (mode === 'absolute') return points;

  return points.map(p => {
    // time / dominant_emotion / neutral などは変更しない（BASELINE_TARGET_COLS のみ補正）
    const corrected = { ...p };
    for (const col of BASELINE_TARGET_COLS) {
      const { offset, sd } = offsets[col] ?? { offset: 0, sd: 0 };
      const dev = (p as any)[col] - offset; // ベースラインからの偏差
      if (mode === 'lift') {
        // valence は signed（−100..100）でμが0近傍/負だと変化率が発散・無意味になるため「—」にする
        if (col === 'valence') {
          (corrected as any)[col] = NaN;
        } else {
          // 平常時の値が小さい指標は変化率が発散し信頼できないため NaN（=「—」表示）にする
          (corrected as any)[col] = Math.abs(offset) >= LIFT_MIN_BASELINE ? (dev / offset) * 100 : NaN;
        }
      } else if (mode === 'zscore') {
        // SD が小さすぎる（不安定な）区間では z 値が発散するため「—」にする
        (corrected as any)[col] = sd >= MIN_SD_FOR_ZSCORE ? dev / sd : NaN;
      } else {
        // deviation
        (corrected as any)[col] = dev;
      }
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
