import type { BaselineDisplayMode, DashboardData } from './types';
import { EMOTION_LABELS_JA } from './types';

export type PurposeSummaryKind = 'research' | 'ux' | 'marketing';
export type PurposeSummaryTone = 'positive' | 'neutral' | 'caution' | 'alert';

export interface PurposeSummaryAction {
  label: string;
  targetSection: string;
}

export interface PurposeSummaryItem {
  label: string;
  value: string;
  tone: PurposeSummaryTone;
}

export interface PurposeSummaryCard {
  kind: PurposeSummaryKind;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  items: PurposeSummaryItem[];
  action: PurposeSummaryAction;
}

export interface PurposeSummaryBaselineState {
  isBaselineActive: boolean;
  displayMode: BaselineDisplayMode;
}

export interface PurposeSummaryOptions {
  hasComparison?: boolean;
  hasMultiFace?: boolean;
}

function num(v: number | undefined | null, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function emotionLabel(key: string): string {
  return EMOTION_LABELS_JA[key] || key;
}

function fmtTime(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function minEmotionN(data: DashboardData): number {
  const ns = Object.values(data.emotion_stats || {}).map(s => num(s?.n));
  return ns.length > 0 ? Math.min(...ns) : 0;
}

function biggestChangePoint(data: DashboardData) {
  return [...(data.change_points || [])].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
}

function peakEngagementPoint(data: DashboardData) {
  return [...(data.timeseries_full || [])].sort((a, b) => num(b.engagement) - num(a.engagement))[0];
}

export function generatePurposeSummaries(
  data: DashboardData,
  baseline: PurposeSummaryBaselineState,
  options: PurposeSummaryOptions = {},
): PurposeSummaryCard[] {
  const minN = minEmotionN(data);
  const changePoint = biggestChangePoint(data);
  const attentionMean = num(data.emotion_stats.attention?.mean ?? data.special_stats.attention?.mean);
  const confusionMean = num(data.emotion_stats.confusion?.mean);
  const cognitiveLoad = num(data.ux_scores?.cognitive_load);
  const uxScore = num(data.ux_scores?.ux_score);
  const peak = peakEngagementPoint(data);
  const topEmotion = Object.entries(data.dominant_emotion_counts || {}).sort((a, b) => b[1] - a[1])[0];
  const topEmotionPct = topEmotion ? num(data.dominant_emotion_pct[topEmotion[0]]) : 0;

  const researchChange = changePoint
    ? `${fmtTime(changePoint.time)} に「${emotionLabel(changePoint.emotion)}」が${changePoint.direction === 'rise' ? '上昇' : '低下'}`
    : '大きな変化点は検出されません';

  const qualityTone: PurposeSummaryTone =
    data.meta.face_detection_rate < 70 || data.meta.emotion_detection_rate < 50 ? 'alert' :
    baseline.isBaselineActive ? 'positive' : 'neutral';

  const uxRiskTone: PurposeSummaryTone =
    cognitiveLoad >= 0.6 || attentionMean < 40 || confusionMean >= 20 ? 'caution' : 'neutral';

  const marketingTarget = options.hasComparison ? 'comparison' : 'timeseries';
  const peakSummary = peak
    ? `${fmtTime(peak.time)} に Engagement ${fmtPct(num(peak.engagement))}`
    : 'ピーク区間を特定できません';

  return [
    {
      kind: 'research',
      title: '研究者向け',
      subtitle: '統計・品質・再現性を先に確認',
      icon: 'Brain',
      accentColor: 'oklch(0.70 0.14 195)',
      items: [
        { label: '有効n', value: `${minN.toLocaleString()} frames`, tone: minN >= 30 ? 'positive' : 'caution' },
        { label: '変化点', value: researchChange, tone: changePoint ? 'neutral' : 'positive' },
        { label: '品質/補正', value: baseline.isBaselineActive ? `BL補正中（${baseline.displayMode}）` : `顔検出 ${fmtPct(num(data.meta.face_detection_rate))}`, tone: qualityTone },
      ],
      action: { label: '詳細を確認する', targetSection: 'academic' },
    },
    {
      kind: 'ux',
      title: 'UXリサーチ向け',
      subtitle: '見返すべき区間と摩擦の兆候',
      icon: 'FlaskConical',
      accentColor: 'oklch(0.78 0.22 300)',
      items: [
        { label: '見返すべき区間', value: changePoint ? `${fmtTime(changePoint.time)} 付近` : '急変点なし', tone: changePoint ? 'caution' : 'positive' },
        { label: '認知負荷', value: `認知負荷 ${Math.round(cognitiveLoad * 100)}/100・UX ${Math.round(uxScore)}/100`, tone: uxRiskTone },
        { label: '注意/混乱', value: `Attention ${fmtPct(attentionMean)} / Confusion ${fmtPct(confusionMean)}`, tone: uxRiskTone },
      ],
      action: { label: '詳細を確認する', targetSection: 'uxresearch' },
    },
    {
      kind: 'marketing',
      title: 'マーケ向け',
      subtitle: options.hasComparison ? 'A/B差分と反応ピークを確認' : '反応ピークと訴求の刺さりを確認',
      icon: 'Megaphone',
      accentColor: 'oklch(0.78 0.14 82)',
      items: [
        { label: '反応ピーク', value: peakSummary, tone: peak ? 'positive' : 'neutral' },
        { label: '主要反応', value: topEmotion ? `「${emotionLabel(topEmotion[0])}」が ${fmtPct(topEmotionPct)}` : '主要感情なし', tone: 'neutral' },
        { label: '比較導線', value: options.hasComparison ? 'A/B比較データあり' : '単一CSVの時系列を確認', tone: options.hasComparison ? 'positive' : 'neutral' },
      ],
      action: { label: '詳細を確認する', targetSection: marketingTarget },
    },
  ];
}
