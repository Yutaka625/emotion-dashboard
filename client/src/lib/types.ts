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
  anger: '#e17055',
  contempt: '#a29bfe',
  disgust: '#00b894',
  fear: '#6c5ce7',
  joy: '#fdcb6e',
  sadness: '#74b9ff',
  surprise: '#00cec9',
  sentimentality: '#fd79a8',
  confusion: '#b2bec3',
  neutral: '#636e72',
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

export const NON_NEUTRAL_EMOTIONS = [
  'anger', 'contempt', 'disgust', 'fear', 'joy', 
  'sadness', 'surprise', 'sentimentality', 'confusion'
];

export const ALL_EMOTIONS = [...NON_NEUTRAL_EMOTIONS, 'neutral'];
