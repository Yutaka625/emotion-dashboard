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
}

export const EMOTION_COLORS: Record<string, string> = {
  anger:         'oklch(0.68 0.26 22)',    /* 鮮烈な赤 — 怒り */
  contempt:       'oklch(0.72 0.22 300)',   /* 紫マゼンタ — 軽蔑 */
  disgust:        'oklch(0.72 0.22 145)',   /* 毒々しいグリーン — 嫌悪 */
  fear:           'oklch(0.68 0.20 280)',   /* ディープバイオレット — 恐怖 */
  joy:            'oklch(0.88 0.20 82)',    /* 輝くゴールド — 喜び */
  sadness:        'oklch(0.68 0.18 235)',   /* コバルトブルー — 悲しみ */
  surprise:       'oklch(0.82 0.22 195)',   /* ブライトシアン — 驚き */
  sentimentality: 'oklch(0.78 0.22 340)',   /* ホットピンク — 感傷 */
  confusion:      'oklch(0.78 0.18 60)',    /* アンバー — 困惑 */
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

export const NON_NEUTRAL_EMOTIONS = [
  'anger', 'contempt', 'disgust', 'fear', 'joy', 
  'sadness', 'surprise', 'sentimentality', 'confusion'
];

export const ALL_EMOTIONS = [...NON_NEUTRAL_EMOTIONS, 'neutral'];
