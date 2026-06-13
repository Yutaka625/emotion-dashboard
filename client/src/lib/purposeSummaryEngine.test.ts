import { describe, expect, it } from 'vitest';
import type { DashboardData } from './types';
import { generatePurposeSummaries } from './purposeSummaryEngine';

const stat = (mean: number, n = 120) => ({
  mean,
  std: 1,
  min: 0,
  max: Math.max(mean, 1),
  median: mean,
  q25: Math.max(0, mean - 1),
  q75: mean + 1,
  n,
});

function makeData(overrides: Partial<DashboardData> = {}): DashboardData {
  const base: DashboardData = {
    meta: {
      filename: 'sample.csv',
      total_frames: 120,
      duration_seconds: 12,
      duration_minutes: 0.2,
      fps_avg: 10,
      start_time: 0,
      end_time: 12,
      recording_date: '2026-06-13',
      recording_time: '08:00:00',
      face_detection_rate: 92,
      emotion_detection_rate: 76,
    },
    emotion_stats: {
      anger: stat(2),
      contempt: stat(1),
      disgust: stat(1),
      fear: stat(2),
      joy: stat(18),
      sadness: stat(1),
      surprise: stat(6),
      sentimentality: stat(5),
      confusion: stat(24),
      neutral: stat(42),
      attention: stat(28),
    },
    special_stats: {
      engagement: stat(64),
      valence: stat(58),
      attention: stat(28),
    },
    timeseries_full: [
      { time: 0, engagement: 30, valence: 48, attention: 22, anger: 0, contempt: 0, disgust: 0, fear: 0, joy: 4, sadness: 0, surprise: 0, sentimentality: 0, confusion: 12, neutral: 80, dominant_emotion: 'confusion' },
      { time: 4.2, engagement: 82, valence: 64, attention: 36, anger: 0, contempt: 0, disgust: 0, fear: 0, joy: 38, sadness: 0, surprise: 16, sentimentality: 10, confusion: 8, neutral: 28, dominant_emotion: 'joy' },
      { time: 8, engagement: 54, valence: 55, attention: 26, anger: 0, contempt: 0, disgust: 0, fear: 0, joy: 12, sadness: 0, surprise: 2, sentimentality: 5, confusion: 22, neutral: 44, dominant_emotion: 'confusion' },
    ],
    time_summary_10s: [
      { time_start: 0, time_end: 10, frame_count: 120, engagement_mean: 64, valence_mean: 58, attention_mean: 28, dominant_emotion: 'joy', dominant_share: 0.58, joy_mean: 18, confusion_mean: 24 },
    ],
    emotion_transitions: {},
    emotion_duration_stats: {
      joy: { count: 2, mean_duration: 2, max_duration: 4.2, total_duration: 4 },
      confusion: { count: 2, mean_duration: 1.5, max_duration: 3.1, total_duration: 3 },
    },
    engagement_distribution: { 'High (60-80)': 40, 'Very High (80-100)': 22 },
    valence_distribution: {},
    correlation_matrix: { labels: [], data: [] },
    engagement_correlations: {},
    valence_correlations: {},
    affect_dynamics: {},
    emotion_prevalence: { confusion: { threshold: 0.3, prevalence_pct: 42, count: 50 } },
    action_unit_stats: {},
    head_pose_stats: {},
    dominant_emotion_counts: { joy: 70, confusion: 50 },
    dominant_emotion_pct: { joy: 58.3, confusion: 41.7 },
    scatter_eng_val: [],
    circumplex_summary: { high_arousal_positive: 40, high_arousal_negative: 5, low_arousal_positive: 25, low_arousal_negative: 3, note: '' },
    engagement_emotion_profile: { high_engagement: {}, low_engagement: {}, high_count: 0, low_count: 0 },
    histograms: {},
    head_motion_events: [],
    change_points: [
      { time: 4.2, emotion: 'joy', delta: 18, direction: 'rise' },
      { time: 8.0, emotion: 'confusion', delta: 15, direction: 'rise' },
    ],
    ux_scores: {
      frustration_index: 0.62,
      delight_index: 0.48,
      engagement_quality: 0.52,
      cognitive_load: 0.71,
      ux_score: 54,
    },
  };

  return { ...base, ...overrides };
}

describe('generatePurposeSummaries', () => {
  it('always returns the three purpose cards in a stable order', () => {
    const cards = generatePurposeSummaries(makeData(), { isBaselineActive: false, displayMode: 'absolute' }, {});

    expect(cards.map(card => card.kind)).toEqual(['research', 'ux', 'marketing']);
  });

  it('includes change point information in the research card', () => {
    const cards = generatePurposeSummaries(makeData(), { isBaselineActive: false, displayMode: 'absolute' }, {});
    const research = cards.find(card => card.kind === 'research');

    expect(research?.items.some(item => item.value.includes('4.2s') && item.value.includes('喜び'))).toBe(true);
    expect(research?.action.targetSection).toBe('academic');
  });

  it('summarizes UX risk from attention, confusion, and UX scores', () => {
    const cards = generatePurposeSummaries(makeData(), { isBaselineActive: false, displayMode: 'absolute' }, {});
    const ux = cards.find(card => card.kind === 'ux');

    expect(ux?.items.some(item => item.tone === 'caution' || item.tone === 'alert')).toBe(true);
    expect(ux?.items.map(item => item.value).join(' ')).toContain('認知負荷');
    expect(ux?.action.targetSection).toBe('uxresearch');
  });

  it('routes the marketing card to comparison when comparison data is available', () => {
    const cards = generatePurposeSummaries(makeData(), { isBaselineActive: false, displayMode: 'absolute' }, { hasComparison: true });
    const marketing = cards.find(card => card.kind === 'marketing');

    expect(marketing?.action.targetSection).toBe('comparison');
  });

  it('routes the marketing card to timeseries when comparison data is not available', () => {
    const cards = generatePurposeSummaries(makeData(), { isBaselineActive: false, displayMode: 'absolute' }, { hasComparison: false });
    const marketing = cards.find(card => card.kind === 'marketing');

    expect(marketing?.action.targetSection).toBe('timeseries');
  });
});
