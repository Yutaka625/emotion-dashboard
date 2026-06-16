// Dashboard data types

export interface EmotionStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
  q25: number;
  q75: number;
  /** NaN除外後の有効フレーム数 */
  n: number;
}

export interface SpecialStats extends EmotionStats {}

export interface TimeseriesPoint {
  time: number;
  engagement: number;
  valence: number;
  attention: number;
  anger: number;
  contempt: number;
  disgust: number;
  fear: number;
  joy: number;
  sadness: number;
  surprise: number;
  sentimentality: number;
  confusion: number;
  neutral: number;
  dominant_emotion: string;
}

export interface TimeSummary {
  time_start: number;
  time_end: number;
  frame_count: number;
  engagement_mean: number;
  valence_mean: number;
  attention_mean: number;
  dominant_emotion: string;
  dominant_share: number;  // 区間内で支配感情が1位を取ったフレームの割合（0〜1）。低いほど僅差
  [key: string]: number | string;
}

export interface AffectDynamics {
  variability_sd: number;
  instability_mssd: number;
  inertia_ar1: number;
  range: number;
  mean_absolute_change: number;
}

export interface EmotionPrevalence {
  threshold: number;
  prevalence_pct: number;
  count: number;
}

export interface ActionUnitStat {
  mean: number;
  max: number;
  active_pct: number;
}

export interface HeadPoseStat {
  mean: number;
  std: number;
  min: number;
  max: number;
}

/** 頭部動作検知イベント（うなづき・首振り・首傾げ） */
export interface HeadMotionEvent {
  /** nod=うなづき(pitch) / shake=首振り(yaw) / tilt=首傾げ(roll) */
  type: 'nod' | 'shake' | 'tilt';
  /** 開始時刻（秒） */
  time_start: number;
  /** 終了時刻（秒） */
  time_end: number;
  /** 最大変化量（度） */
  magnitude: number;
}

export interface EmotionDurationStat {
  count: number;
  mean_duration: number;
  max_duration: number;
  total_duration: number;
}

export interface ScatterPoint {
  time: number;
  engagement: number;
  valence: number;
  dominant: string;
  attention: number;
}

export interface CircumplexSummary {
  high_arousal_positive: number;
  high_arousal_negative: number;
  low_arousal_positive: number;
  low_arousal_negative: number;
  note: string;
}

export interface CorrelationMatrix {
  labels: string[];
  data: number[][];
}

export interface EngagementEmotionProfile {
  high_engagement: Record<string, number>;
  low_engagement: Record<string, number>;
  high_count: number;
  low_count: number;
}

export interface DashboardData {
  meta: {
    filename: string;
    total_frames: number;
    duration_seconds: number;
    duration_minutes: number;
    fps_avg: number;
    start_time: number;
    end_time: number;
    recording_date: string;
    recording_time: string;
    face_detection_rate: number;   // % of frames where face data exists (value can be 0)
    emotion_detection_rate: number; // % of frames where at least one emotion > 0
  };
  emotion_stats: Record<string, EmotionStats>;
  special_stats: Record<string, SpecialStats>;
  timeseries_full: TimeseriesPoint[];
  time_summary_10s: TimeSummary[];
  emotion_transitions: Record<string, Record<string, number>>;
  emotion_duration_stats: Record<string, EmotionDurationStat>;
  engagement_distribution: Record<string, number>;
  valence_distribution: Record<string, number>;
  correlation_matrix: CorrelationMatrix;
  engagement_correlations: Record<string, number>;
  valence_correlations: Record<string, number>;
  affect_dynamics: Record<string, AffectDynamics>;
  emotion_prevalence: Record<string, EmotionPrevalence>;
  action_unit_stats: Record<string, ActionUnitStat>;
  head_pose_stats: Record<string, HeadPoseStat>;
  dominant_emotion_counts: Record<string, number>;
  dominant_emotion_pct: Record<string, number>;
  scatter_eng_val: ScatterPoint[];
  circumplex_summary: CircumplexSummary;
  engagement_emotion_profile: EngagementEmotionProfile;
  histograms: Record<string, { counts: number[]; bin_edges: number[] }>;
  /** 頭部動作検知イベント一覧（うなづき・首振り・首傾げ） */
  head_motion_events: HeadMotionEvent[];
  /** 感情スコアの変化点一覧（上位20件） */
  change_points: ChangePoint[];
  /** UXリサーチ向け複合指標 */
  ux_scores: UXScores;
}

export const EMOTION_COLORS: Record<string, string> = {
  anger:         'oklch(0.58 0.24 24)',    /* スカーレット（朱赤）— 怒り */
  contempt:       'oklch(0.62 0.10 258)',   /* ペリウィンクル — 軽蔑（視認性改善） */
  disgust:        'oklch(0.82 0.12 52)',    /* アプリコット — 嫌悪 */
  fear:           'oklch(0.78 0.13 135)',   /* ピスタチオグリーン — 恐怖 */
  joy:            'oklch(0.92 0.18 96)',    /* カナリアイエロー — 喜び */
  sadness:        'oklch(0.82 0.15 198)',   /* シアン — 悲しみ */
  surprise:       'oklch(0.76 0.18 68)',    /* アンバーオレンジ — 驚き（旧オフホワイトから視認性改善） */
  sentimentality: 'oklch(0.66 0.22 350)',   /* ディープローズ — 感傷（旧シェルピンクから視認性改善） */
  confusion:      'oklch(0.73 0.07 228)',   /* フォグブルー（霧色）— 混乱 */
  neutral:        'oklch(0.58 0.03 255)',   /* ミッドグレーブルー — ニュートラル */
  attention:      'oklch(0.80 0.18 160)',   /* エメラルドグリーン — 注意 */
};

/**
 * 料金ティアのバッジ色（お試し期間中は全機能無償。将来有料になり得る機能の予告表示用）。
 * pro=紫（解釈指標・状態・比較・レポート出力）／biz=オレンジ（AI予測・インサイト・まとめ）。
 * Core はバッジなし（無印）のため定義しない。
 */
export const TIER_COLORS = {
  pro: 'oklch(0.62 0.20 290)', /* ビビッドパープル — Pro */
  biz: 'oklch(0.70 0.17 60)',  /* ビビッドオレンジ — Biz */
} as const;

export const EMOTION_LABELS_JA: Record<string, string> = {
  anger: '怒り',
  contempt: '軽蔑',
  disgust: '嫌悪',
  fear: '恐怖',
  joy: '喜び',
  sadness: '悲しみ',
  surprise: '驚き',
  sentimentality: '感傷',
  confusion: '混乱',
  neutral: 'ニュートラル',
};

/**
 * ベースライン補正の「中心値」の計算方式
 * - mean:   平均減算（標準）
 * - median: 中央値減算（外れ値に頑健）
 */
export type BaselineCenter = 'mean' | 'median';

/**
 * 補正後の感情スコアをどう見せるかの表示モード
 * - absolute:  補正なし（生スコア 0〜100）
 * - deviation: ベースライン偏差 x − μ（符号付き）
 * - lift:      変化率 (x − μ)/μ × 100（%・近ゼロ baseline ではεガード）
 * - zscore:    標準化 (x − μ)/σ（単位=SD）
 */
export type BaselineDisplayMode = 'absolute' | 'deviation' | 'lift' | 'zscore';

/** ベースライン区間における1感情あたりの統計（中心値とばらつき） */
export interface BaselineStat {
  /** 中心値（平均 or 中央値）。減算オフセットとして使う */
  offset: number;
  /** 標準偏差（Zスコア計算に使う） */
  sd: number;
}

/**
 * ベースライン補正で使う「各感情の統計」の型。
 * キーは BASELINE_EMOTION_COLS（anger〜neutral）。
 */
export type BaselineOffsets = Record<string, BaselineStat>;

// マルチ FaceID のデータ品質情報（ノイズ＝少フレームFaceID の判定結果。しきい値から動的に算出）
export interface FaceQuality {
  /** 録画全体のユニーク時刻数（＝総フレーム数） */
  totalFrames: number;
  /** 解析対象として残した FaceID（出現フレームが十分） */
  kept: string[];
  /** 少フレームのため除外した FaceID（検出が不安定な可能性） */
  minor: { id: string; frames: number }[];
}

// マルチ FaceID 対応: 複数の顔を含む CSV データの管理構造
// ※ ノイズ判定（kept/minor）は固定せず、FaceIDContext がしきい値から動的に算出する。
//    ここでは「検出した全 FaceID」と素材（perFace/rawRowsByFace/totalFrames）のみ保持する。
export interface MultiFaceData {
  /** 検出した全 FaceID（ソート済み）。FaceID 列がない場合は空配列 */
  faceIds: string[];
  /** FaceID 別に事前計算した DashboardData（全 ID） */
  perFace: Map<string, DashboardData>;
  /** 全 FaceID を合算した DashboardData（フォールバック用） */
  allCombined: DashboardData;
  /** FaceID 別の生行データ（再計算・フレーム数算出用。全 ID） */
  rawRowsByFace: Map<string, Record<string, string>[]>;
  /** 元ファイル名 */
  filename: string;
  /** 録画全体のユニーク時刻数（＝総フレーム数） */
  totalFrames: number;
  /** パース済みの全生行（CSV出力で全フレーム・FaceID別抽出に使う。単一Faceでも保持） */
  allRows?: Record<string, string>[];
  /** 時刻列のヘッダー名（通常は先頭列 "time stamp"） */
  timeCol?: string;
  /** FaceID 列のヘッダー名（無ければ null） */
  faceIdCol?: string | null;
}

/** UXリサーチ向け複合指標スコア */
export interface UXScores {
  /** フラストレーション指数 (0〜1): confusion×0.4 + anger×0.3 + sadness×0.2 + disgust×0.1 */
  frustration_index: number;
  /** デライト指数 (0〜1): joy×0.5 + surprise×0.3 + sentimentality×0.2 */
  delight_index: number;
  /** エンゲージメント品質 (0〜1): engagement × max(0, 1 - confusion×2) */
  engagement_quality: number;
  /** 認知負荷推定 (0〜1): confusion×0.6 + brow_furrow_active_pct/100×0.4 */
  cognitive_load: number;
  /** 総合UXスコア (0〜100) */
  ux_score: number;
}

/** 感情スコアの急激な変化（変化点）を表すイベント */
export interface ChangePoint {
  /** 変化が発生した時刻（秒） */
  time: number;
  /** 対象感情 */
  emotion: string;
  /** 変化量（正=上昇、負=下降） */
  delta: number;
  /** 変化方向 */
  direction: 'rise' | 'fall';
}

export const NON_NEUTRAL_EMOTIONS = [
  'anger', 'sadness', 'surprise', 'fear', 'joy',
  'disgust', 'contempt', 'sentimentality', 'confusion'
];

export const ALL_EMOTIONS = [...NON_NEUTRAL_EMOTIONS, 'neutral'];
