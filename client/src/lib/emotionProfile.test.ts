import { describe, expect, it } from 'vitest';
import type { EmotionStats } from './types';
import { buildEmotionProfileRadarData } from './emotionProfile';

function stat(mean: number, max = mean): EmotionStats {
  return {
    mean,
    std: 0,
    min: 0,
    max,
    median: mean,
    q25: mean,
    q75: mean,
    n: 10,
  };
}

describe('buildEmotionProfileRadarData', () => {
  it('adds formatted value labels for each emotion mean shown on the radar chart', () => {
    const rows = buildEmotionProfileRadarData({
      anger: stat(12.3456),
      joy: stat(0.5),
    });

    expect(rows.find(row => row.key === 'anger')).toMatchObject({
      emotion: '怒り',
      value: 12.3456,
      valueLabel: '12.346',
    });
    expect(rows.find(row => row.key === 'joy')).toMatchObject({
      emotion: '喜び',
      value: 0.5,
      valueLabel: '0.500',
    });
  });

  it('clips negative values for chart geometry but keeps a zero value label', () => {
    const rows = buildEmotionProfileRadarData({
      sadness: stat(-3.25),
    });

    expect(rows.find(row => row.key === 'sadness')).toMatchObject({
      emotion: '悲しみ',
      value: 0,
      valueLabel: '0.000',
    });
  });
});
