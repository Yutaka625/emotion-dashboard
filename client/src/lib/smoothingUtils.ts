/**
 * smoothingUtils.ts
 * 感情時系列データの平滑化（スムージング）ユーティリティ
 *
 * 対応手法:
 *   - SMA (Simple Moving Average): 単純移動平均
 *   - EMA (Exponential Moving Average): 指数移動平均
 *
 * どちらも TimeseriesPoint[] を受け取り、同じ型のスムージング済み配列を返す。
 * time・dominant_emotion フィールドはそのまま保持し、数値スコアのみ平滑化する。
 */

import type { TimeseriesPoint } from '@/lib/types';

/** 平滑化の対象フィールド（数値スコアのみ）*/
const SMOOTHABLE_KEYS: (keyof TimeseriesPoint)[] = [
  'anger', 'contempt', 'disgust', 'fear', 'joy',
  'sadness', 'surprise', 'sentimentality', 'confusion', 'neutral',
  'engagement', 'valence', 'attention',
];

// ─────────────────────────────────────────────
// SMA (単純移動平均)
// ─────────────────────────────────────────────

/**
 * 単純移動平均（SMA）
 *
 * 各点の前後 halfW フレームの算術平均を計算する「中央型」移動平均。
 * 端点はウィンドウが収まる範囲のみで計算するため、データ長は変わらない。
 *
 * @param data        元の時系列データ配列
 * @param windowSize  ウィンドウ幅（奇数推奨; 3〜61フレーム程度）
 */
export function smoothSMA(
  data: TimeseriesPoint[],
  windowSize: number,
): TimeseriesPoint[] {
  if (windowSize <= 1 || data.length === 0) return data;

  const half = Math.floor(windowSize / 2);
  const n = data.length;

  return data.map((point, i) => {
    // 有効なウィンドウ範囲を計算（端点でははみ出ないよう制限）
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    const count = hi - lo + 1;

    // 各感情スコアの平均を計算
    const smoothed: Partial<TimeseriesPoint> = {};
    for (const key of SMOOTHABLE_KEYS) {
      let sum = 0;
      for (let j = lo; j <= hi; j++) {
        sum += (data[j][key] as number) || 0;
      }
      (smoothed as any)[key] = sum / count;
    }

    return {
      ...point,   // time・dominant_emotion はそのまま保持
      ...smoothed,
    };
  });
}

// ─────────────────────────────────────────────
// EMA (指数移動平均)
// ─────────────────────────────────────────────

/**
 * 指数移動平均（EMA）
 *
 * 直近の値に大きな重みを与える。時系列の「今」を重視した平滑化。
 * alpha が小さいほど平滑度が高い（ゆっくり追従）。
 *   - alpha = 0.1: 強い平滑化（緩やかな曲線）
 *   - alpha = 0.5: 中程度
 *   - alpha = 0.9: 弱い平滑化（ほぼ原波形）
 *
 * @param data   元の時系列データ配列
 * @param alpha  スムージング係数 (0.0 < alpha < 1.0)
 */
export function smoothEMA(
  data: TimeseriesPoint[],
  alpha: number,
): TimeseriesPoint[] {
  if (alpha >= 1.0 || data.length === 0) return data;

  // EMA の初期値は最初のフレームの値
  const emaValues: Partial<Record<keyof TimeseriesPoint, number>> = {};
  for (const key of SMOOTHABLE_KEYS) {
    emaValues[key] = (data[0][key] as number) || 0;
  }

  return data.map((point, i) => {
    if (i === 0) {
      // 最初のフレームはそのまま
      return { ...point };
    }

    // EMA 更新: EMA_t = alpha * x_t + (1 - alpha) * EMA_{t-1}
    const smoothed: Partial<TimeseriesPoint> = {};
    for (const key of SMOOTHABLE_KEYS) {
      const current = (point[key] as number) || 0;
      const prev = emaValues[key] ?? current;
      const newEma = alpha * current + (1 - alpha) * prev;
      (emaValues as any)[key] = newEma;
      (smoothed as any)[key] = newEma;
    }

    return {
      ...point,   // time・dominant_emotion はそのまま保持
      ...smoothed,
    };
  });
}

// ─────────────────────────────────────────────
// 汎用ラッパー
// ─────────────────────────────────────────────

export type SmoothingMethod = 'none' | 'sma' | 'ema';

/**
 * スムージング手法を一括選択できるラッパー関数
 *
 * @param data    元データ
 * @param method  手法: 'none' | 'sma' | 'ema'
 * @param param   SMA の場合はウィンドウサイズ（整数）、EMA の場合は alpha（0〜1）
 */
export function applySmoothing(
  data: TimeseriesPoint[],
  method: SmoothingMethod,
  param: number,
): TimeseriesPoint[] {
  switch (method) {
    case 'sma':
      return smoothSMA(data, Math.round(param));
    case 'ema':
      return smoothEMA(data, param);
    case 'none':
    default:
      return data;
  }
}
