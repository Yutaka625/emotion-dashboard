/*
 * DESIGN: Neuro-Signal Interface
 * Overview section with hero metrics and key insights
 */

import { useMemo } from 'react';
import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS } from '@/lib/types';
import { Clock, Activity, Eye, Zap, TrendingUp, Brain, CheckCircle2, Info, AlertTriangle, AlertOctagon, FlaskConical, Megaphone, ArrowRight } from 'lucide-react';
import { useBaseline } from '@/contexts/BaselineContext';
import { generateInsights, type InsightTone } from '@/lib/insightEngine';
import { generatePurposeSummaries, type PurposeSummaryTone } from '@/lib/purposeSummaryEngine';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, Label,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import { rechartsTooltip } from '@/lib/chartTooltip';
import CollapsibleCard from '@/components/ui/CollapsibleCard';
import { formatScore, formatPct } from '@/lib/utils';
import { buildEmotionProfileRadarData } from '@/lib/emotionProfile';

interface Props {
  data: DashboardData;
  onSectionChange?: (id: string) => void;
  hasComparison?: boolean;
}

function MetricCard({ label, value, unit, icon, color, sub }: {
  label: string; value: string | number; unit?: string; icon: React.ReactNode;
  color: string; sub?: string;
}) {
  return (
    <div className="metric-card flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="section-label">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      {/* 値と単位。長い値（総フレーム数など）でカード枠からはみ出さないよう
          flex-wrap で単位を折り返し可能にし、値は折り返しを許可する */}
      <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
        <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '2rem', color: 'oklch(0.88 0.005 250)', lineHeight: 1, wordBreak: 'break-word', minWidth: 0 }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.68 0.015 255)' }}>
            {unit}
          </span>
        )}
      </div>
      {sub && (
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.68 0.015 255)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// 記録時間を「M分S秒」形式に整形する。
// 「0.3分」のような小数表記は直感的でないため、分・秒に分けて表示する。
// 1分未満のときは「S秒」だけにする（「0分18秒」の冗長さを避ける）。
function formatDuration(totalSeconds: number): string {
  const total = Math.round(totalSeconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m >= 1 ? `${m}分${s}秒` : `${s}秒`;
}

// トーン（良好/中立/注意/警告）に対応するアイコンを返す
function toneIcon(tone: InsightTone, color: string) {
  const size = 15;
  switch (tone) {
    case 'positive': return <CheckCircle2 size={size} style={{ color }} />;
    case 'caution':  return <AlertTriangle size={size} style={{ color }} />;
    case 'alert':    return <AlertOctagon size={size} style={{ color }} />;
    default:         return <Info size={size} style={{ color }} />;
  }
}

function purposeToneColor(tone: PurposeSummaryTone): string {
  switch (tone) {
    case 'positive': return 'oklch(0.70 0.16 150)';
    case 'caution':  return 'oklch(0.76 0.15 70)';
    case 'alert':    return 'oklch(0.62 0.20 25)';
    default:         return 'oklch(0.64 0.10 250)';
  }
}

function purposeIcon(icon: string, color: string) {
  const props = { size: 18, style: { color } };
  switch (icon) {
    case 'Brain': return <Brain {...props} />;
    case 'FlaskConical': return <FlaskConical {...props} />;
    case 'Megaphone': return <Megaphone {...props} />;
    default: return <Info {...props} />;
  }
}

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.03) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    // stroke + paintOrder で背景色に関わらず文字を読みやすくする
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      stroke="rgba(0,0,0,0.55)" strokeWidth={3} paintOrder="stroke"
      style={{ fontSize: '0.68rem', fontFamily: 'Roboto Mono, monospace', fontWeight: 700 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function OverviewSection({ data, onSectionChange, hasComparison }: Props) {
  const { meta, special_stats, dominant_emotion_counts, dominant_emotion_pct, emotion_stats } = data;
  const { isBaselineActive, baselineRange, displayMode } = useBaseline();
  // attention is treated as a facial expression metric (in emotion_stats)
  const attentionStats = emotion_stats['attention'] || special_stats['attention'];

  const dominantPieData = useMemo(() => {
    return Object.entries(dominant_emotion_counts)
      .sort((a, b) => b[1] - a[1])
      .map(([emotion, count]) => ({
        name: EMOTION_LABELS_JA[emotion] || emotion,
        value: count,
        color: EMOTION_COLORS[emotion] || '#999',
      }));
  }, [dominant_emotion_counts]);

  const radarData = useMemo(() => {
    // 生の平均値をそのまま使用（×10スケール廃止）
    // signed モード時に mean がマイナスになっても RadarChart が崩れないよう 0 でクリップ（表示用のみ）
    return buildEmotionProfileRadarData(emotion_stats);
  }, [emotion_stats]);

  const engMean = special_stats.engagement?.mean || 0;
  const valMean = special_stats.valence?.mean || 0;
  const attMean = attentionStats?.mean || 0;
  const engMax = special_stats.engagement?.max || 0;

  const topEmotion = Object.entries(dominant_emotion_counts).sort((a, b) => b[1] - a[1])[0];

  // KEY INSIGHTS をルールベースのエンジンから生成（AI・API不使用の純粋関数）
  // ベースライン補正の状態を渡し、補正中／signed モードでは文言を自動で切り替える
  const keyInsights = useMemo(
    () => generateInsights(data, { isBaselineActive, displayMode }, 4),
    [data, isBaselineActive, displayMode],
  );
  const purposeSummaries = useMemo(
    () => generatePurposeSummaries(data, { isBaselineActive, displayMode }, { hasComparison }),
    [data, isBaselineActive, displayMode, hasComparison],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="section-label mb-1">SESSION OVERVIEW</div>
          <h1 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.75rem', color: 'oklch(0.88 0.005 250)', lineHeight: 1.1 }}>
            感情分析レポート
          </h1>
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.68 0.015 255)', marginTop: '0.5rem' }}>
            {meta.recording_date} {meta.recording_time} — 顔表情・感情・Engagement・Valenceの時系列分析
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ベースライン補正アクティブ表示 */}
          {isBaselineActive && baselineRange && (
            <div className="status-pill flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'oklch(0.75 0.18 60 / 0.12)', border: '1px solid oklch(0.75 0.18 60 / 0.4)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.75 0.18 60)' }} />
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.75 0.18 60)' }}>
                BASELINE CORRECTED
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Hero Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          label="記録時間"
          value={formatDuration(meta.duration_seconds)}
          icon={<Clock size={16} />}
          color="oklch(0.62 0.18 160)"
          sub={`${meta.duration_seconds.toFixed(1)}秒`}
        />
        <MetricCard
          label="総フレーム数"
          value={meta.total_frames.toLocaleString()}
          unit="frames"
          icon={<Activity size={16} />}
          color="oklch(0.62 0.18 250)"
          sub={`${meta.fps_avg.toFixed(1)} fps`}
        />
        <MetricCard
          label="Engagement 平均"
          value={formatPct(engMean)}
          unit="%"
          icon={<Zap size={16} />}
          color="oklch(0.72 0.18 80)"
          sub={`最大: ${formatPct(engMax)}%`}
        />
        <MetricCard
          label="Valence 平均"
          value={formatPct(valMean)}
          unit="%"
          icon={<TrendingUp size={16} />}
          color="oklch(0.62 0.18 25)"
          sub={`中央値: ${formatPct(special_stats.valence?.median ?? 0)}%`}
        />
        <MetricCard
          label="Attention 平均"
          value={formatPct(attMean)}
          unit="%"
          icon={<Eye size={16} />}
          color="oklch(0.55 0.18 300)"
          sub={`最大: ${formatPct(attentionStats?.max ?? 0)}%`}
        />
        <MetricCard
          label="主要感情"
          value={EMOTION_LABELS_JA[topEmotion?.[0]] || '-'}
          icon={<Brain size={16} />}
          color={EMOTION_COLORS[topEmotion?.[0]] || '#999'}
          sub={`${dominant_emotion_pct[topEmotion?.[0]]?.toFixed(1)}% の時間`}
        />
      </div>

      {/* Purpose Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {purposeSummaries.map(card => (
          <div
            key={card.kind}
            className="p-4 rounded-xl flex flex-col gap-3"
            style={{
              background: 'oklch(0.22 0.04 255)',
              border: `1px solid ${card.accentColor}40`,
              boxShadow: `0 0 0 1px ${card.accentColor}10 inset`,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="section-label mb-1">PURPOSE SUMMARY</div>
                <div className="flex items-center gap-2">
                  {purposeIcon(card.icon, card.accentColor)}
                  <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'oklch(0.88 0.005 250)' }}>
                    {card.title}
                  </h2>
                </div>
                <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.66 0.015 250)', marginTop: '0.35rem', lineHeight: 1.5 }}>
                  {card.subtitle}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {card.items.map(item => {
                const toneColor = purposeToneColor(item.tone);
                return (
                  <div key={item.label} className="flex items-start gap-2">
                    <span
                      className="mt-1 rounded-full"
                      style={{ width: 7, height: 7, background: toneColor, boxShadow: `0 0 8px ${toneColor}70`, flexShrink: 0 }}
                    />
                    <div className="min-w-0">
                      <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.58rem', color: 'oklch(0.58 0.015 255)', letterSpacing: '0.04em' }}>
                        {item.label}
                      </div>
                      <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.76rem', color: 'oklch(0.80 0.008 250)', lineHeight: 1.45 }}>
                        {item.value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onSectionChange?.(card.action.targetSection)}
              className="mt-auto flex items-center justify-center gap-1.5 rounded-lg hbg"
              style={{
                height: 34,
                border: `1px solid ${card.accentColor}70`,
                color: card.accentColor,
                fontFamily: 'Noto Sans JP, sans-serif',
                fontWeight: 700,
                fontSize: '0.76rem',
                ['--hbg']: `${card.accentColor}12`,
                ['--hbg-h']: `${card.accentColor}20`,
              } as React.CSSProperties}
            >
              {card.action.label}
              <ArrowRight size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dominant Emotion Pie */}
        <CollapsibleCard
          label="DOMINANT EMOTION DISTRIBUTION"
          title="感情状態の占有率"
          info="各フレームで最も強い感情を「支配的感情」として集計し、占有率（時間割合）で示します。"
          storageKey="ksdv.collapse.overview.pie"
        >
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={dominantPieData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={55}
                dataKey="value"
                labelLine={false}
                label={renderCustomizedLabel}
                stroke="none"
              >
                {dominantPieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
                {/* ドーナツ中央に最大感情を表示 */}
                <Label
                  content={({ viewBox }: any) => {
                    const { cx, cy } = viewBox;
                    const top = dominantPieData[0];
                    if (!top) return null;
                    const pct = ((top.value / meta.total_frames) * 100).toFixed(0);
                    return (
                      <g>
                        <text x={cx} y={cy - 7} textAnchor="middle"
                          fill={top.color} fontSize={20} fontWeight={700}
                          fontFamily="Noto Sans JP, sans-serif">
                          {pct}%
                        </text>
                        <text x={cx} y={cy + 13} textAnchor="middle"
                          fill="oklch(0.62 0.015 255)" fontSize={10}
                          fontFamily="Noto Sans JP, sans-serif">
                          {top.name}
                        </text>
                      </g>
                    );
                  }}
                />
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value.toLocaleString()} フレーム (${((value / meta.total_frames) * 100).toFixed(1)}%)`,
                  name
                ]}
                {...rechartsTooltip}
              />
              <Legend
                formatter={(value) => <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.75 0.008 250)' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </CollapsibleCard>

        {/* Emotion Radar */}
        <CollapsibleCard
          label="EMOTION PROFILE"
          title="感情プロファイル（平均値）"
          info="9種類の感情スコアの平均値をレーダーチャートで俯瞰します。外側に広がるほどその感情が強く表れています。"
          storageKey="ksdv.collapse.overview.radar"
        >
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="oklch(0.28 0.04 255)" />
              <PolarAngleAxis
                dataKey="emotion"
                tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.80 0.01 250)' }}
              />
              {/* 各点の数値ラベルは非表示（ホバー時のツールチップで確認できる） */}
              <Radar
                name="平均値"
                dataKey="value"
                stroke="oklch(0.62 0.18 160)"
                fill="oklch(0.62 0.18 160)"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Tooltip
                {...rechartsTooltip}
                formatter={(v: number) => [formatScore(v), '平均値']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </CollapsibleCard>
      </div>

      {/* Key Insights */}
      <CollapsibleCard
        label="KEY INSIGHTS"
        title="主要な発見"
        info="本セッションの統計から自動抽出した注目ポイントです（ルールベース判定、上位4件）。"
        storageKey="ksdv.collapse.overview.insights"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {keyInsights.map(insight => (
            <div key={insight.id} className="p-4 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.30 0.035 255)' }}>
              <div className="flex items-center gap-2 mb-2">
                {toneIcon(insight.tone, insight.color)}
                <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.85rem', color: 'oklch(0.88 0.005 250)' }}>
                  {insight.title}
                </span>
              </div>
              <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.66 0.015 250)', lineHeight: 1.6 }}>
                {insight.body}
              </p>
            </div>
          ))}
        </div>
      </CollapsibleCard>

      {/* Data Quality */}
      <CollapsibleCard
        label="DATA QUALITY"
        title="データ品質指標"
        info="記録日時・フレームレート・顔/感情の検出率など、分析の信頼性を示す指標です。"
        storageKey="ksdv.collapse.overview.quality"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '記録日時', value: `${meta.recording_date} ${meta.recording_time}` },
            { label: '平均フレームレート', value: `${meta.fps_avg.toFixed(2)} fps` },
            { label: '顔検出率', value: `${meta.face_detection_rate.toFixed(1)}%`, note: 'データありフレーム割合' },
            { label: '感情検出率', value: `${meta.emotion_detection_rate.toFixed(1)}%`, note: '少なくと1感情>0の割合' },
          ].map((item, i) => (
            <div key={i}>
              <div className="section-label mb-1">{item.label}</div>
              <div style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 600, fontSize: '0.9rem', color: 'oklch(0.88 0.005 250)' }}>
                {item.value}
              </div>
              {'note' in item && (
                <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', marginTop: '2px' }}>
                  {(item as { note: string }).note}
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleCard>
    </div>
  );
}
