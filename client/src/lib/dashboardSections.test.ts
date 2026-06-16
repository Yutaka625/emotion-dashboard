import { describe, expect, it } from 'vitest';
import { AI_INSIGHTS_SECTION_ID, BASE_DASHBOARD_SECTIONS } from './dashboardSections';

describe('dashboard section definitions', () => {
  it('exposes AI insights as a visible locked Biz tab', () => {
    const aiInsights = BASE_DASHBOARD_SECTIONS.find(section => section.id === AI_INSIGHTS_SECTION_ID);

    expect(aiInsights).toMatchObject({
      id: 'aiinsights',
      label: 'AIインサイト',
      description: 'Gemini解析インサイト',
      tier: 'biz',
      locked: true,
    });
  });
});
