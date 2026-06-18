import { EMOTION_LABELS_JA, type EmotionStats } from './types';
import { formatScore } from './utils';

export const EMOTION_PROFILE_KEYS = [
  'anger',
  'contempt',
  'disgust',
  'fear',
  'joy',
  'sadness',
  'surprise',
  'sentimentality',
  'confusion',
] as const;

export interface EmotionProfileRadarRow {
  key: string;
  emotion: string;
  value: number;
  valueLabel: string;
  max: number;
}

export function buildEmotionProfileRadarData(
  emotionStats: Record<string, EmotionStats | undefined>,
): EmotionProfileRadarRow[] {
  return EMOTION_PROFILE_KEYS.map(key => {
    const value = Math.max(0, emotionStats[key]?.mean ?? 0);

    return {
      key,
      emotion: EMOTION_LABELS_JA[key] || key,
      value,
      valueLabel: formatScore(value),
      max: Math.max(0, emotionStats[key]?.max ?? 0),
    };
  });
}
