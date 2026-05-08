// Dashboard data types

export interface EmotionStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
  q25: number;
  q75: number;
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
}

export const EMOTION_COLORS: Record<string, string> = {
  anger:         'oklch(0.58 0.24 24)',    /* スカーレット（朱赤）— 怒り */
  contempt:       'oklch(0.65 0.04 250)',   /* クールグレー — 軽蔑 */
  disgust:        'oklch(0.82 0.12 52)',    /* アプリコット — 嫌悪 */
  fear:           'oklch(0.78 0.13 135)',   /* ピスタチオグリーン — 恐怖 */
  joy:            'oklch(0.92 0.18 96)',    /* カナリアイエロー — 喜び */
  sadness:        'oklch(0.82 0.15 198)',   /* シアン — 悲しみ */
  surprise:       'oklch(0.94 0.02 85)',    /* オフホワイト — 驚き */
  sentimentality: 'oklch(0.84 0.08 355)',   /* シェルピンク — 感傷 */
  confusion:      'oklch(0.73 0.07 228)',   /* フォグブルー（霧色）— 困惑 */
  neutral:        'oklch(0.58 0.03 255)',   /* ミッドグレーブルー — ニュートラル */
  attention:      'oklch(0.80 0.18 160)',   /* エメラルドグリーン — 注意 */
};

export const EMOTION_LABELS_JA: Record<string, string> = {
  anger: '怒り',
  contempt: '軽蔑',
  disgust: '嫌悪',
  fear: '恐怖',
  joy: '喜び',
  sadness: '悲しみ',
  surprise: '驚き',
  sentimentality: '感傷',
  confusion: '困惑',
  neutral: 'ニュートラル',
};

// ベースライン補正で使う「各感情のオフセット平均値」の型
export interface BaselineOffsets {
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
}

// マルチ FaceID 対応: 複数の顔を含む CSV データの管理構造
export interface MultiFaceData {
  /** 検出された全 FaceID（出現順）。FaceID 列がない場合は空配列 */
  faceIds: string[];
  /** FaceID 別に事前計算した DashboardData */
  perFace: Map<string, DashboardData>;
  /** 全 FaceID を合算した DashboardData（従来と同じ） */
  allCombined: DashboardData;
  /** FaceID 別の生行データ（複数選択時の再計算用） */
  rawRowsByFace: Map<string, Record<string, string>[]>;
  /** 元ファイル名 */
  filename: string;
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
  'anger', 'contempt', 'disgust', 'fear', 'joy', 
  'sadness', 'surprise', 'sentimentality', 'confusion'
];

export const ALL_EMOTIONS = [...NON_NEUTRAL_EMOTIONS, 'neutral'];
