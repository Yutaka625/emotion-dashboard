/*
 * DESIGN: Neuro-Signal Interface
 * Overview section with hero metrics and key insights
 */

import { useMemo } from 'react';
import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS } from '@/lib/types';
import { Clock, Activity, Eye, Zap, TrendingUp, Brain } from 'lucide-react';
import { useBaseline } from '@/contexts/BaselineContext';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, Label,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';

interface Props {
  data: DashboardData;
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
      <div className="flex items-baseline gap-1.5">
        <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '2rem', color: 'oklch(0.88 0.005 250)', lineHeight: 1 }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.58 0.015 255)' }}>
            {unit}
          </span>
        )}
      </div>
      {sub && (
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.58 0.015 255)' }}>
          {sub}
        </div>
      )}
    </div>
  );
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

export default function OverviewSection({ data }: Props) {
  const { meta, special_stats, dominant_emotion_counts, dominant_emotion_pct, emotion_stats } = data;
  const { isBaselineActive, baselineRange } = useBaseline();
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
    const emotions = ['anger', 'contempt', 'disgust', 'fear', 'joy', 'sadness', 'surprise', 'sentimentality', 'confusion'];
    return emotions.map(e => ({
      emotion: EMOTION_LABELS_JA[e] || e,
      value: Math.min(100, emotion_stats[e]?.mean * 10 || 0),
      max: emotion_stats[e]?.max || 0,
    }));
  }, [emotion_stats]);

  const engMean = special_stats.engagement?.mean || 0;
  const valMean = special_stats.valence?.mean || 0;
  const attMean = attentionStats?.mean || 0;
  const engMax = special_stats.engagement?.max || 0;

  const topEmotion = Object.entries(dominant_emotion_counts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="section-label mb-1">SESSION OVERVIEW</div>
          <h1 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.75rem', color: 'oklch(0.88 0.005 250)', lineHeight: 1.1 }}>
            感情分析レポート
          </h1>
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.58 0.015 255)', marginTop: '0.5rem' }}>
            {meta.recording_date} {meta.recording_time} — 顔表情・感情・Engagement・Valenceの時系列分析
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ベースライン補正アクティブ表示 */}
          {isBaselineActive && baselineRange && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'oklch(0.75 0.18 60 / 0.12)', border: '1px solid oklch(0.75 0.18 60 / 0.4)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.75 0.18 60)' }} />
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.75 0.18 60)' }}>
                BASELINE CORRECTED
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'oklch(0.62 0.18 160 / 0.1)', border: '1px solid oklch(0.62 0.18 160 / 0.3)' }}>
            <div className="w-1.5 h-1.5 rounded-full signal-pulse" style={{ background: 'oklch(0.62 0.18 160)' }} />
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.42 0.12 160)' }}>
              ANALYZED
            </span>
          </div>
        </div>
      </div>

      {/* Hero Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          label="記録時間"
          value={meta.duration_minutes.toFixed(1)}
          unit="分"
          icon={<Clock size={16} />}
          color="oklch(0.62 0.18 160)"
          sub={`${meta.duration_seconds.toFixed(0)}秒`}
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
          value={engMean.toFixed(2)}
          unit="%"
          icon={<Zap size={16} />}
          color="oklch(0.72 0.18 80)"
          sub={`最大: ${engMax.toFixed(1)}%`}
        />
        <MetricCard
          label="Valence 平均"
          value={valMean.toFixed(1)}
          unit="%"
          icon={<TrendingUp size={16} />}
          color="oklch(0.62 0.18 25)"
          sub={`中央値: ${special_stats.valence?.median.toFixed(1)}%`}
        />
        <MetricCard
          label="Attention 平均"
          value={attMean.toFixed(1)}
          unit="%"
          icon={<Eye size={16} />}
          color="oklch(0.55 0.18 300)"
          sub={`最大: ${attentionStats?.max.toFixed(1)}%`}
        />
        <MetricCard
          label="主要感情"
          value={EMOTION_LABELS_JA[topEmotion?.[0]] || '-'}
          icon={<Brain size={16} />}
          color={EMOTION_COLORS[topEmotion?.[0]] || '#999'}
          sub={`${dominant_emotion_pct[topEmotion?.[0]]?.toFixed(1)}% の時間`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dominant Emotion Pie */}
        <div className="metric-card">
          <div className="section-label mb-3">支配的感情の分布</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
            感情状態の占有率
          </div>
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
                contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
              />
              <Legend
                formatter={(value) => <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.75 0.008 250)' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Emotion Radar */}
        <div className="metric-card">
          <div className="section-label mb-3">EMOTION PROFILE</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
            感情プロファイル（平均値×10スケール）
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="oklch(0.28 0.04 255)" />
              <PolarAngleAxis
                dataKey="emotion"
                tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', fill: 'oklch(0.45 0.015 250)' }}
              />
              <Radar
                name="平均値"
                dataKey="value"
                stroke="oklch(0.62 0.18 160)"
                fill="oklch(0.62 0.18 160)"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
                formatter={(v: number) => [`${(v / 10).toFixed(3)}`, '平均値']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key Insights */}
      <div className="metric-card">
        <div className="section-label mb-3">KEY INSIGHTS</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          主要な発見
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: '感情状態の安定性',
              body: `全フレームの${dominant_emotion_pct['confusion']?.toFixed(1)}%で「困惑」が支配的感情として検出されました。これは顔の表情が明確な感情表出を示さない「中立的な認知状態」を反映しています。`,
              color: EMOTION_COLORS['confusion'],
            },
            {
              title: 'Engagementのパターン',
              body: `Engagementの中央値は${special_stats.engagement?.median.toFixed(1)}%と低く、大部分の時間は低覚醒状態でした。最大値${engMax.toFixed(1)}%の高エンゲージメント瞬間が${data.engagement_distribution?.very_high || 0}フレーム検出されています。`,
              color: 'oklch(0.72 0.18 80)',
            },
            {
              title: 'Valenceの傾向',
              body: `Valenceの平均${valMean.toFixed(1)}%・中央値${special_stats.valence?.median.toFixed(1)}%は高い正の感情価を示します。ネガティブなValenceは検出されず、全体的にポジティブな感情状態が維持されていました。`,
              color: 'oklch(0.62 0.18 25)',
            },
          ].map((insight, i) => (
            <div key={i} className="p-4 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: `1px solid ${insight.color}30` }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: insight.color }} />
                <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.85rem', color: 'oklch(0.88 0.005 250)' }}>
                  {insight.title}
                </span>
              </div>
              <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.45 0.015 250)', lineHeight: 1.6 }}>
                {insight.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Data Quality */}
      <div className="metric-card">
        <div className="section-label mb-3">DATA QUALITY</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          データ品質指標
        </div>
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
                <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', color: 'oklch(0.58 0.015 255)', marginTop: '2px' }}>
                  {(item as { note: string }).note}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
