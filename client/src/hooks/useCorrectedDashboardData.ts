/**
 * useCorrectedDashboardData
 * ベースライン補正が有効なとき、感情統計を補正後の値で再計算して返すフック。
 * 補正が無効な場合は元の DashboardData をそのまま返す。
 *
 * 再計算される統計:
 *   - emotion_stats（各感情の mean / std / min / max / median / q25 / q75）
 *   - special_stats（engagement / valence / attention — Phase 4 で補正対象に追加）
 *   - dominant_emotion_counts / dominant_emotion_pct（補正後の支配感情が変わりうる）
 *   - emotion_transitions（支配感情の遷移行列）
 *   - emotion_duration_stats（支配感情の継続時間統計）
 *   - timeseries_full の dominant_emotion（各フレームの支配感情を再判定）
 *
 * 再計算されない統計（絶対値スケール前提のため＝補正対象外。各タブで明示する）:
 *   - circumplex_summary（象限分類は絶対スケール前提）
 *   - ux_scores（指標は絶対0-1前提）
 *   - affect_dynamics / correlation_matrix（高次統計。偏差化で意味が変わる/NaN混入のリスク）
 *   - head pose / action units
 */

import { useMemo } from 'react';
import { applyBaselineCorrection } from '@/lib/csvAnalyzer';
import { useBaseline } from '@/contexts/BaselineContext';
import type { DashboardData, EmotionStats, TimeseriesPoint } from '@/lib/types';

// ---- 内部ユーティリティ（csvAnalyzer.ts と同じロジック） ----

const NON_NEUTRAL = ['anger', 'sadness', 'surprise', 'fear', 'joy', 'disgust', 'contempt', 'sentimentality', 'confusion'] as const;
const EMOTION_COLS = [...NON_NEUTRAL, 'neutral'] as const;

function round(v: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

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

// 補正後の timeseries から各フレームの支配感情を再判定する
// （lift モードでは NaN が混じり得るため、NaN は比較から除外する）
function recomputeDominantEmotion(p: TimeseriesPoint): string {
  let maxVal = -Infinity, maxEmo = 'confusion';
  for (const e of NON_NEUTRAL) {
    const v = p[e];
    if (!isNaN(v) && v > maxVal) { maxVal = v; maxEmo = e; }
  }
  return maxEmo;
}

// ---- メインフック ----

export function useCorrectedDashboardData(data: DashboardData | null): DashboardData | null {
  const { isBaselineActive, baselineOffsets, displayMode } = useBaseline();

  return useMemo(() => {
    // 補正無効 or データなし → そのまま返す
    if (!data || !isBaselineActive || !baselineOffsets) return data;

    // timeseries_full に補正を適用し、支配感情を再判定
    const correctedTimeseries: TimeseriesPoint[] = applyBaselineCorrection(
      data.timeseries_full,
      baselineOffsets,
      displayMode  // ← absolute/deviation/lift/zscore
    ).map(p => ({
      ...p,
      dominant_emotion: recomputeDominantEmotion(p),
    }));

    // --- emotion_stats を補正後の値で再計算 ---
    const emotion_stats: DashboardData['emotion_stats'] = { ...data.emotion_stats };
    for (const col of EMOTION_COLS) {
      emotion_stats[col] = computeStats(correctedTimeseries.map(p => p[col]));
    }

    // --- special_stats（engagement / valence / attention）も補正後の値で再計算 ---
    // これらは Phase 4 で補正対象に追加された。Engagement/Valence タブの統計を補正後に整合させる。
    // ※ lift モードで valence は NaN（「—」）になるため computeStats が 0 を返すが、表示も「—」のため問題ない。
    const special_stats: DashboardData['special_stats'] = { ...data.special_stats };
    for (const col of ['engagement', 'valence', 'attention'] as const) {
      special_stats[col] = computeStats(correctedTimeseries.map(p => (p as any)[col] as number));
    }

    // --- 支配感情カウント / パーセンテージを再計算 ---
    const dominant_emotion_counts: Record<string, number> = {};
    for (const e of NON_NEUTRAL) dominant_emotion_counts[e] = 0;
    for (const p of correctedTimeseries) {
      const e = p.dominant_emotion;
      dominant_emotion_counts[e] = (dominant_emotion_counts[e] || 0) + 1;
    }

    const total = correctedTimeseries.length || 1;
    const dominant_emotion_pct: Record<string, number> = {};
    for (const [e, cnt] of Object.entries(dominant_emotion_counts)) {
      dominant_emotion_pct[e] = round((cnt / total) * 100, 2);
    }

    // --- 感情遷移行列を再計算 ---
    const emotion_transitions: DashboardData['emotion_transitions'] = {};
    for (const e of NON_NEUTRAL) emotion_transitions[e] = {};
    for (let i = 1; i < correctedTimeseries.length; i++) {
      const from = correctedTimeseries[i - 1].dominant_emotion;
      const to = correctedTimeseries[i].dominant_emotion;
      if (!emotion_transitions[from]) emotion_transitions[from] = {};
      emotion_transitions[from][to] = (emotion_transitions[from][to] || 0) + 1;
    }

    // --- 支配感情の継続時間統計を再計算 ---
    const fps = data.meta.fps_avg || 30;
    const emotion_duration_stats: DashboardData['emotion_duration_stats'] = {};
    for (const e of NON_NEUTRAL) {
      const durations: number[] = [];
      let runLen = 0;
      for (const p of correctedTimeseries) {
        if (p.dominant_emotion === e) {
          runLen++;
        } else if (runLen > 0) {
          durations.push(runLen / fps);
          runLen = 0;
        }
      }
      if (runLen > 0) durations.push(runLen / fps);
      emotion_duration_stats[e] = {
        count: durations.length,
        mean_duration: durations.length > 0 ? round(mean(durations), 3) : 0,
        max_duration: durations.length > 0 ? round(Math.max(...durations), 3) : 0,
        total_duration: round(durations.reduce((a, b) => a + b, 0), 3),
      };
    }

    return {
      ...data,
      timeseries_full: correctedTimeseries,
      emotion_stats,
      special_stats,
      dominant_emotion_counts,
      dominant_emotion_pct,
      emotion_transitions,
      emotion_duration_stats,
    };
    // ※ circumplex_summary / ux_scores / affect_dynamics / correlation_matrix は
    //   絶対値スケールが前提（偏差化で意味が壊れる）ため、ここでは再計算せず元の値を保持する。
    //   各タブ側で「補正対象外（絶対値）」を明示する。
  }, [data, isBaselineActive, baselineOffsets, displayMode]);
}
