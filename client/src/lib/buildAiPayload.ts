/**
 * buildAiPayload.ts
 * AIインサイト機能で「サーバ（→Anthropic API）へ送る集計ペイロード」を組み立てる。
 *
 * ★プライバシー方針（最重要）★
 *   送るのは KSDV が計算した「集計済み指標」のみ。
 *   生フレーム・顔の座標（topleft_x など）・ランドマーク・瞳孔間距離(interocular)・
 *   明るさ(brightness) といった生体/環境の生データは一切含めない。
 *   DashboardData はそもそもこれらを保持していないため、ここを母体にすれば自然に除外できる。
 *   ※ セッションメタデータ（被験者属性・自由記述）も利用者入力で個人情報を含み得るため、AI-0では送らない。
 *
 * トークン量を抑えるため、各数値は丸めて最小限の指標だけを詰める。
 */

import type { DashboardData } from './types';
import { EMOTION_LABELS_JA, ALL_EMOTIONS } from './types';

/** 解析の読み手（ペルソナ）。フレーミングのトーンに使う。 */
export type AiPersona = 'researcher' | 'ux' | 'marketer';

/** 出力言語 */
export type AiLang = 'ja' | 'en';

export interface BuildAiPayloadOptions {
  persona: AiPersona;
  lang: AiLang;
}

/** 数値を指定桁で丸める（NaN/Infは null に落として送らない） */
function round(v: number, digits = 2): number | null {
  if (v == null || !isFinite(v)) return null;
  const p = Math.pow(10, digits);
  return Math.round(v * p) / p;
}

/**
 * 実効サンプルサイズ n_eff = n × (1 − r) / (1 + r)（r = AR(1) 自己相関）。
 * フレームは強く自己相関するため、検定の「実質的な独立標本数」はフレーム数より小さい。
 * 擬似反復（pseudoreplication）への注意喚起としてペイロードに同梱する。
 */
function effectiveN(n: number, ar1: number): number | null {
  if (!isFinite(n) || n <= 0) return null;
  const r = isFinite(ar1) ? Math.max(-0.999, Math.min(0.999, ar1)) : 0;
  return Math.round((n * (1 - r)) / (1 + r));
}

/** 相関行列から「強い相関ペア」を上位 k 件だけ抽出する（対角・重複は除く）。 */
function topCorrelations(
  matrix: { labels: string[]; data: number[][] },
  k = 8,
): Array<{ a: string; b: string; r: number }> {
  const out: Array<{ a: string; b: string; r: number }> = [];
  const { labels, data } = matrix;
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const r = data?.[i]?.[j];
      if (r == null || !isFinite(r)) continue;
      out.push({ a: labels[i], b: labels[j], r: round(r, 2)! });
    }
  }
  out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  return out.slice(0, k);
}

/**
 * DashboardData から AI 送信用の集計ペイロードを構築する。
 * 返り値はそのまま JSON.stringify してサーバへ送れる素のオブジェクト。
 */
export function buildAiPayload(data: DashboardData, opts: BuildAiPayloadOptions) {
  const m = data.meta;

  // 感情ごとの基本統計（平均・SD・最大・有効n）＋動態（AR1/MSSD/変動）＋ n_eff
  const emotions: Record<string, unknown> = {};
  for (const e of ALL_EMOTIONS) {
    const s = data.emotion_stats[e];
    if (!s) continue;
    const dyn = data.affect_dynamics[e];
    emotions[e] = {
      label_ja: EMOTION_LABELS_JA[e] ?? e,
      mean: round(s.mean, 2),
      std: round(s.std, 2),
      max: round(s.max, 2),
      n: s.n,
      dominant_pct: round(data.dominant_emotion_pct[e] ?? 0, 1),
      prevalence_pct: round(data.emotion_prevalence[e]?.prevalence_pct ?? 0, 1),
      ar1: dyn ? round(dyn.inertia_ar1, 3) : null,
      mssd: dyn ? round(dyn.instability_mssd, 2) : null,
      n_eff: dyn ? effectiveN(s.n, dyn.inertia_ar1) : null,
    };
  }

  // 特殊指標（engagement / valence / attention）
  const special: Record<string, unknown> = {};
  for (const k of ['engagement', 'valence', 'attention']) {
    const s = data.special_stats[k];
    if (!s) continue;
    const dyn = data.affect_dynamics[k];
    special[k] = {
      mean: round(s.mean, 2),
      std: round(s.std, 2),
      min: round(s.min, 2),
      max: round(s.max, 2),
      ar1: dyn ? round(dyn.inertia_ar1, 3) : null,
      n_eff: dyn ? effectiveN(s.n, dyn.inertia_ar1) : null,
    };
  }

  // 10秒区間の推移（時系列の形を粗く渡す。座標などは含まない）
  const trajectory = data.time_summary_10s.map((t) => ({
    t0: round(t.time_start, 0),
    eng: round(t.engagement_mean, 1),
    val: round(t.valence_mean, 1),
    att: round(t.attention_mean, 1),
    dom: t.dominant_emotion,
  }));

  // 頭部動作イベントは件数サマリーのみ（時刻の羅列は不要）
  const headMotionCounts = { nod: 0, shake: 0, tilt: 0 } as Record<string, number>;
  for (const ev of data.head_motion_events) headMotionCounts[ev.type]++;

  return {
    schema: 'ksdv.ai-insight.payload.v1',
    persona: opts.persona,
    lang: opts.lang,
    meta: {
      filename: m.filename,
      total_frames: m.total_frames,
      duration_seconds: round(m.duration_seconds, 1),
      fps_avg: round(m.fps_avg, 2),
      face_detection_rate: round(m.face_detection_rate, 1),
      emotion_detection_rate: round(m.emotion_detection_rate, 1),
    },
    emotions,
    special,
    dominant_emotion_pct: Object.fromEntries(
      Object.entries(data.dominant_emotion_pct).map(([k, v]) => [k, round(v, 1)]),
    ),
    circumplex: data.circumplex_summary,
    ux_scores: {
      frustration_index: round(data.ux_scores.frustration_index, 3),
      delight_index: round(data.ux_scores.delight_index, 3),
      engagement_quality: round(data.ux_scores.engagement_quality, 3),
      cognitive_load: round(data.ux_scores.cognitive_load, 3),
      ux_score: round(data.ux_scores.ux_score, 1),
    },
    change_points: data.change_points.map((c) => ({
      time: round(c.time, 1),
      emotion: c.emotion,
      delta: round(c.delta, 2),
      direction: c.direction,
    })),
    head_motion_counts: headMotionCounts,
    top_correlations: topCorrelations(data.correlation_matrix, 8),
    trajectory,
  };
}

export type AiPayload = ReturnType<typeof buildAiPayload>;
