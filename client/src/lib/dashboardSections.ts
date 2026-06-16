import { AI_INSIGHTS_COPY } from './aiInsightsCopy';

export type DashboardSectionTier = 'biz';

export interface DashboardSectionDefinition {
  id: string;
  label: string;
  description: string;
  tier?: DashboardSectionTier;
  locked?: boolean;
  highlight?: boolean;
}

export const AI_INSIGHTS_SECTION_ID = 'aiinsights';

export const BASE_DASHBOARD_SECTIONS: DashboardSectionDefinition[] = [
  { id: 'overview', label: '概要', description: 'セッションサマリー' },
  { id: 'timeseries', label: '時系列分析', description: '感情・指標の推移' },
  { id: 'engagement', label: '特殊指標', description: '関与度・感情価の詳細分析' },
  { id: 'emotions', label: '感情分布', description: '10感情の統計' },
  { id: 'transitions', label: '感情遷移', description: '状態遷移パターン' },
  { id: 'actionunits', label: 'アクションユニット', description: '表情筋動作分析' },
  { id: 'academic', label: '学術的分析', description: 'Affect Dynamics等' },
  { id: 'uxresearch', label: 'UXリサーチ', description: 'フリクション・デライト分析', highlight: true },
  {
    id: AI_INSIGHTS_SECTION_ID,
    label: 'AIインサイト',
    description: AI_INSIGHTS_COPY.navDescription,
    tier: 'biz',
    locked: true,
    highlight: true,
  },
];
