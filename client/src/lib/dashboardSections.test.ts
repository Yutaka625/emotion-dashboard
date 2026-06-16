import { describe, expect, it } from 'vitest';
import { AI_INSIGHTS_COPY } from './aiInsightsCopy';
import { AI_INSIGHTS_SECTION_ID, BASE_DASHBOARD_SECTIONS } from './dashboardSections';

describe('dashboard section definitions', () => {
  it('exposes AI insights as a visible locked Biz tab', () => {
    const aiInsights = BASE_DASHBOARD_SECTIONS.find(section => section.id === AI_INSIGHTS_SECTION_ID);

    expect(aiInsights).toMatchObject({
      id: 'aiinsights',
      label: 'AIインサイト',
      description: 'AI解析インサイト',
      tier: 'biz',
      locked: true,
    });
  });

  it('does not expose provider names in AI insights locked copy', () => {
    expect(Object.values(AI_INSIGHTS_COPY).join('\n')).not.toContain('Gemini');
    expect(AI_INSIGHTS_COPY.lockMessage).toBe(
      'この機能は現在利用できません。今後、感情・注意・健康・UX・行動予測など、多様な側面を推定・分析する機能を提供する予定です。'
    );
  });
});
