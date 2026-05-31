/**
 * insightEngine
 * KEY INSIGHTS（主要な発見）を「データから」生成するルールベースのエンジン。
 *
 * ★ AI・API は一切使わない純粋関数 ★
 *   - すべてブラウザ内の if/閾値判定だけで完結（外部通信ゼロ・料金ゼロ）
 *   - 同じデータなら必ず同じ結果になる（再現性・説明可能性あり）
 *
 * 仕組み:
 *   1. 各ルール（rule）が data を見て「該当すれば Insight、しなければ null」を返す
 *   2. 全ルールを評価し、null を除外
 *   3. score（重要度）の降順に並べ替え、上位 N 件（既定4件）を採用
 *   → データ内容に応じて「際立った発見」が上位に来る
 *
 * 新しい着眼点を増やしたいときは、RULES 配列にルール関数を1つ追加するだけ。
 */

import type { DashboardData, BaselineDisplayMode } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS } from '@/lib/types';

/** インサイトのトーン（重要度の種類）。表示側でアイコン・色分けに使う */
export type InsightTone = 'positive' | 'neutral' | 'caution' | 'alert';

/** 1件のインサイト */
export interface Insight {
  /** 一意キー（React の key／重複排除用） */
  id: string;
  /** 見出し */
  title: string;
  /** 本文 */
  body: string;
  /** アクセント色（感情色やトーン色） */
  color: string;
  /** トーン（positive=良好 / neutral=中立 / caution=注意 / alert=警告） */
  tone: InsightTone;
  /** 重要度スコア（高いほど上位に表示） */
  score: number;
}

/** ベースライン補正の状態（文言の出し分けに使う） */
export interface BaselineState {
  isBaselineActive: boolean;
  /** 補正後の表示モード（absolute/deviation/lift/zscore） */
  displayMode: BaselineDisplayMode;
}

/** トーンごとの代表色（ルールが色を指定しない場合のフォールバック） */
export const TONE_COLORS: Record<InsightTone, string> = {
  positive: 'oklch(0.70 0.16 150)', // グリーン
  neutral:  'oklch(0.64 0.10 250)', // ブルー
  caution:  'oklch(0.76 0.15 70)',  // アンバー
  alert:    'oklch(0.62 0.20 25)',  // レッド
};

// ── 安全アクセス用の小さなヘルパー ──────────────────────────

function num(v: number | undefined | null, fallback = 0): number {
  return typeof v === 'number' && !isNaN(v) ? v : fallback;
}

function emotionLabel(key: string): string {
  return EMOTION_LABELS_JA[key] || key;
}

/** 秒を読みやすく整形（例: 42.0s） */
function fmtTime(t: number): string {
  return `${t.toFixed(1)}s`;
}

// ============================================================
// ルール定義
//   各ルール: (data, baseline) => Insight | null
//   - 該当しなければ null を返す
//   - score は 0〜100 のおおよその目安
// ============================================================

type Rule = (data: DashboardData, baseline: BaselineState) => Insight | null;

/**
 * ① 検出品質の警告
 * 顔・感情の検出率が低いと全分析の信頼性に関わるため、最優先で知らせる。
 */
const ruleDetectionQuality: Rule = (data) => {
  const faceRate = num(data.meta.face_detection_rate, 100);
  const emoRate = num(data.meta.emotion_detection_rate, 100);

  if (faceRate < 70) {
    return {
      id: 'detection-face',
      title: '検出品質に注意',
      body: `顔の検出率が ${faceRate.toFixed(1)}% と低めです。カメラ位置や遮蔽の影響で、分析結果の信頼性が下がっている可能性があります。`,
      color: TONE_COLORS.alert,
      tone: 'alert',
      score: 95,
    };
  }
  if (emoRate < 50) {
    return {
      id: 'detection-emotion',
      title: '感情検出率が低め',
      body: `感情が検出されたフレームは全体の ${emoRate.toFixed(1)}% です。無表情の時間が長いか、表情が読み取りにくい状況だった可能性があります。`,
      color: TONE_COLORS.caution,
      tone: 'caution',
      score: 72,
    };
  }
  return null;
};

/**
 * ② 支配的感情の偏り／多様性（コア・常に何か返す）
 */
const ruleDominantConcentration: Rule = (data) => {
  const sorted = Object.entries(data.dominant_emotion_counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  const [top1Key] = sorted[0];
  const top2Key = sorted[1]?.[0];
  const top1Pct = num(data.dominant_emotion_pct[top1Key]);
  const top2Pct = top2Key ? num(data.dominant_emotion_pct[top2Key]) : 0;
  const top1Label = emotionLabel(top1Key);
  const top2Label = top2Key ? emotionLabel(top2Key) : '';

  // 偏りの強さで文言とスコアを変える
  let body: string;
  let score: number;
  if (top1Pct >= 60) {
    body = `全体の ${top1Pct.toFixed(1)}% で「${top1Label}」が支配的でした。特定の感情に強く偏った、まとまりのあるセッションです。`;
    score = 58;
  } else if (top1Pct < 30) {
    body = `最も多い「${top1Label}」でも ${top1Pct.toFixed(1)}% にとどまり、複数の感情が入れ替わる多様な反応が見られました。${top2Label ? `次点は「${top2Label}」（${top2Pct.toFixed(1)}%）です。` : ''}`;
    score = 54;
  } else {
    body = `「${top1Label}」が ${top1Pct.toFixed(1)}% で最多、次いで「${top2Label}」が ${top2Pct.toFixed(1)}% でした。`;
    score = 48;
  }

  return {
    id: 'dominant-concentration',
    title: '支配的な感情',
    body,
    color: EMOTION_COLORS[top1Key] || TONE_COLORS.neutral,
    tone: 'neutral',
    score,
  };
};

/**
 * ③ 急変点（change_points）
 * 感情スコアが急変したタイミングを拾う。件数が多いほど注目度が高い。
 */
const ruleChangePoints: Rule = (data) => {
  const cps = data.change_points || [];
  if (cps.length === 0) {
    // 急変がない＝安定していた、という発見（やや低スコア）
    return {
      id: 'change-stable',
      title: '安定した推移',
      body: '感情スコアに急激な変化は検出されませんでした。セッションを通じて比較的安定して推移しています。',
      color: TONE_COLORS.positive,
      tone: 'positive',
      score: 40,
    };
  }

  // 変化量の絶対値が最大の急変点を代表として紹介
  const biggest = [...cps].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  const dir = biggest.direction === 'rise' ? '急上昇' : '急低下';
  const emo = emotionLabel(biggest.emotion);

  // 件数が多いほどスコアを上げる（最大 80 程度）
  const score = Math.min(80, 50 + cps.length * 4);
  // 件数が多い＝起伏が激しいので caution、少なければ neutral
  const tone: InsightTone = cps.length >= 5 ? 'caution' : 'neutral';

  return {
    id: 'change-points',
    title: '感情の急変',
    body: `全体で ${cps.length} 件の急変を検出しました。最も大きかったのは ${fmtTime(biggest.time)} 付近の「${emo}」の${dir}です。`,
    color: EMOTION_COLORS[biggest.emotion] || TONE_COLORS.caution,
    tone,
    score,
  };
};

/**
 * ④ 感情の最長持続（emotion_duration_stats）
 * ある感情が途切れず続いた最長時間を拾う。
 */
const ruleLongestDuration: Rule = (data) => {
  const stats = data.emotion_duration_stats || {};
  let bestKey = '';
  let bestMax = 0;
  for (const [key, s] of Object.entries(stats)) {
    const m = num(s?.max_duration);
    if (m > bestMax) { bestMax = m; bestKey = key; }
  }
  // 最長持続が 3 秒未満なら「持続」と呼ぶには短いので出さない
  if (!bestKey || bestMax < 3) return null;

  return {
    id: 'longest-duration',
    title: '最も長く続いた感情',
    body: `「${emotionLabel(bestKey)}」が最長 ${bestMax.toFixed(1)} 秒にわたって連続して検出されました。`,
    color: EMOTION_COLORS[bestKey] || TONE_COLORS.neutral,
    tone: 'neutral',
    score: 44,
  };
};

/**
 * ⑤ Engagement（覚醒度・関与度）（コア）
 * ベースライン補正中は「平常時比」の相対値として表現する。
 */
const ruleEngagement: Rule = (data, baseline) => {
  const eng = data.special_stats.engagement;
  if (!eng) return null;
  const mean = num(eng.mean);
  const median = num(eng.median);

  // 高エンゲージメントのフレーム数
  const dist = data.engagement_distribution || {};
  const highFrames = num(dist['High (60-80)']) + num(dist['Very High (80-100)']);

  if (baseline.isBaselineActive) {
    // 補正中は絶対水準ではなく「平常時からの変化」で語る
    const sign = mean >= 0 ? '高い' : '低い';
    return {
      id: 'engagement',
      title: 'Engagement（平常時比）',
      body: `Engagement はベースライン（平常時）より平均 ${mean >= 0 ? '+' : ''}${mean.toFixed(1)} の水準でした。平常時より${sign}関与状態が中心です。`,
      color: 'oklch(0.72 0.18 80)',
      tone: mean >= 0 ? 'positive' : 'neutral',
      score: 50 + Math.min(20, Math.abs(mean) / 2),
    };
  }

  const level = mean >= 60 ? '高い' : mean >= 30 ? '中程度の' : '低い';
  const tone: InsightTone = mean >= 60 ? 'positive' : mean >= 30 ? 'neutral' : 'caution';
  const score = mean >= 60 ? 66 : mean < 30 ? 64 : 46;
  return {
    id: 'engagement',
    title: 'Engagement の水準',
    body: `Engagement の平均は ${mean.toFixed(1)}%・中央値 ${median.toFixed(1)}% で、${level}覚醒・関与状態を示します。高エンゲージメント（60%以上）の瞬間が ${highFrames.toLocaleString()} フレーム見られました。`,
    color: 'oklch(0.72 0.18 80)',
    tone,
    score,
  };
};

/**
 * ⑥ Valence（感情価）（コア）
 * Valence は 0〜100（50が中立）。補正中／signed では負値が出るため文言を分岐。
 */
const ruleValence: Rule = (data, baseline) => {
  const val = data.special_stats.valence;
  if (!val) return null;
  const mean = num(val.mean);
  const median = num(val.median);

  if (baseline.isBaselineActive) {
    // 補正中は「平常時より快/不快寄り」で表現
    const dir = mean >= 0 ? 'ポジティブ' : 'ネガティブ';
    return {
      id: 'valence',
      title: 'Valence（平常時比）',
      body: `感情価はベースラインより平均 ${mean >= 0 ? '+' : ''}${mean.toFixed(1)} で、平常時より${dir}寄りに推移しました。`,
      color: 'oklch(0.62 0.18 25)',
      tone: mean >= 0 ? 'positive' : 'caution',
      score: 50 + Math.min(20, Math.abs(mean) / 2),
    };
  }

  const trend = mean >= 60 ? 'ポジティブ' : mean >= 45 ? '中立的' : 'ネガティブ寄り';
  const tone: InsightTone = mean >= 60 ? 'positive' : mean >= 45 ? 'neutral' : 'caution';
  const score = mean >= 60 ? 60 : mean < 45 ? 64 : 46;
  return {
    id: 'valence',
    title: 'Valence の傾向',
    body: `Valence の平均は ${mean.toFixed(1)}%・中央値 ${median.toFixed(1)}% で、${trend}な感情価を示します。`,
    color: 'oklch(0.62 0.18 25)',
    tone,
    score,
  };
};

/**
 * ⑦ Attention（注意）
 * 注意の平均が低いときだけ注意喚起として出す。
 */
const ruleAttention: Rule = (data) => {
  const att = data.emotion_stats['attention'] || data.special_stats['attention'];
  if (!att) return null;
  const mean = num(att.mean);
  if (mean >= 40) return null; // 十分高ければ特筆しない

  return {
    id: 'attention-low',
    title: '注意の低下',
    body: `Attention の平均は ${mean.toFixed(1)}% と低めで、注意がそれていた時間が多かった可能性があります。`,
    color: 'oklch(0.55 0.18 300)',
    tone: 'caution',
    score: 56,
  };
};

/**
 * ⑧ UX 複合指標（ux_scores）
 * フラストレーション・デライト・認知負荷のうち、最も際立ったものを1件出す。
 */
const ruleUXScores: Rule = (data) => {
  const ux = data.ux_scores;
  if (!ux) return null;

  const frustration = num(ux.frustration_index);
  const delight = num(ux.delight_index);
  const cognitive = num(ux.cognitive_load);

  // 候補をスコア化して最も強いものを選ぶ
  const candidates: Insight[] = [];

  if (frustration >= 0.5) {
    candidates.push({
      id: 'ux-frustration',
      title: 'フラストレーションの兆候',
      body: `フラストレーション指数が ${(frustration * 100).toFixed(0)}/100 と高めです（困惑・怒り・悲しみ・嫌悪の合成）。つまずきポイントを確認することをおすすめします。`,
      color: TONE_COLORS.alert,
      tone: 'alert',
      score: 70 + frustration * 20,
    });
  }
  if (cognitive >= 0.6) {
    candidates.push({
      id: 'ux-cognitive',
      title: '認知負荷が高い',
      body: `認知負荷の推定が ${(cognitive * 100).toFixed(0)}/100 と高めです（困惑・眉のしかめの合成）。情報量や操作の複雑さを見直す余地があります。`,
      color: TONE_COLORS.caution,
      tone: 'caution',
      score: 68 + cognitive * 15,
    });
  }
  if (delight >= 0.4) {
    candidates.push({
      id: 'ux-delight',
      title: 'デライト（好反応）',
      body: `デライト指数が ${(delight * 100).toFixed(0)}/100 と高めです（喜び・驚き・感傷の合成）。ポジティブに刺さった場面があったことを示します。`,
      color: TONE_COLORS.positive,
      tone: 'positive',
      score: 64 + delight * 15,
    });
  }

  if (candidates.length === 0) return null;
  // 最もスコアの高い1件のみ採用（UXカードの重複を避ける）
  return candidates.sort((a, b) => b.score - a.score)[0];
};

/**
 * ⑨ 感情の変動性（affect_dynamics）
 * Valence（なければ Engagement）の慣性 AR1 で「持続的／移ろいやすい」を判定。
 * 明確な極値のときだけ出す（中庸なら出さない）。
 */
const ruleAffectInertia: Rule = (data) => {
  const ad = data.affect_dynamics || {};
  const target = ad['valence'] || ad['engagement'];
  if (!target) return null;
  const ar1 = num(target.inertia_ar1);

  if (ar1 >= 0.85) {
    return {
      id: 'affect-inertia-high',
      title: '感情が持続的',
      body: `感情状態の慣性が高く（AR1=${ar1.toFixed(2)}）、一度生じた状態が長く尾を引く傾向が見られました。`,
      color: TONE_COLORS.neutral,
      tone: 'neutral',
      score: 50,
    };
  }
  if (ar1 > 0 && ar1 <= 0.3) {
    return {
      id: 'affect-inertia-low',
      title: '感情が移ろいやすい',
      body: `感情状態の慣性が低く（AR1=${ar1.toFixed(2)}）、状態がすばやく切り替わる反応性の高さが見られました。`,
      color: TONE_COLORS.neutral,
      tone: 'neutral',
      score: 48,
    };
  }
  return null;
};

// ルール一覧（順不同。最終的に score で並べ替えられる）
const RULES: Rule[] = [
  ruleDetectionQuality,
  ruleDominantConcentration,
  ruleChangePoints,
  ruleLongestDuration,
  ruleEngagement,
  ruleValence,
  ruleAttention,
  ruleUXScores,
  ruleAffectInertia,
];

/**
 * インサイトを生成して返す。
 * @param data      ダッシュボードデータ（ベースライン補正済みの場合あり）
 * @param baseline  ベースライン補正の状態（文言出し分け用）
 * @param limit     表示件数（既定4件）
 */
export function generateInsights(
  data: DashboardData,
  baseline: BaselineState,
  limit = 4,
): Insight[] {
  // 全ルールを評価して null を除外
  const all = RULES
    .map(rule => {
      try {
        return rule(data, baseline);
      } catch {
        // 1つのルールが失敗しても全体は止めない
        return null;
      }
    })
    .filter((x): x is Insight => x !== null);

  // score 降順で並べ替え、上位 limit 件を採用
  return all.sort((a, b) => b.score - a.score).slice(0, limit);
}
