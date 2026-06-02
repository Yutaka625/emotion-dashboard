/*
 * DESIGN: Neuro-Signal Interface
 * Valence deep-dive analysis
 */

import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area, ReferenceLine,
} from 'recharts';
import { rechartsTooltip } from '@/lib/chartTooltip';

interface Props {
  data: DashboardData;
}

export default function ValenceSection({ data }: Props) {
  const { special_stats, valence_distribution, valence_correlations, affect_dynamics, timeseries_full, circumplex_summary } = data;

  const val = special_stats.valence;

  const distData = [
    { label: '非常に低い\n(<50)', value: valence_distribution.very_low || 0, color: 'oklch(0.45 0.22 25)' },
    { label: '低い\n(50-80)', value: valence_distribution.low || 0, color: 'oklch(0.58 0.18 25)' },
    { label: '中程度\n(80-90)', value: valence_distribution.neutral_range || 0, color: 'oklch(0.72 0.12 80)' },
    { label: '高い\n(90-95)', value: valence_distribution.high || 0, color: 'oklch(0.62 0.18 160)' },
    { label: '非常に高い\n(>95)', value: valence_distribution.very_high || 0, color: 'oklch(0.52 0.18 160)' },
  ];

  const corrData = Object.entries(valence_correlations)
    .filter(([k]) => k !== 'valence')
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, val]) => ({
      name: EMOTION_LABELS_JA[key] || key,
      value: val,
      color: val > 0 ? 'oklch(0.62 0.18 160)' : 'oklch(0.62 0.18 25)',
    }));

  // Valence time series (sampled)
  const step = Math.max(1, Math.floor(timeseries_full.length / 400));
  const valTS = timeseries_full.filter((_, i) => i % step === 0).map(d => ({
    time: d.time,
    valence: d.valence,
    engagement: d.engagement,
  }));

  const valDynamics = affect_dynamics.valence;

  const circumplexData = [
    { label: '高覚醒×高Valence', value: circumplex_summary.high_arousal_positive, color: 'oklch(0.62 0.18 160)', desc: '活性化・興奮状態' },
    { label: '高覚醒×低Valence', value: circumplex_summary.high_arousal_negative, color: 'oklch(0.62 0.18 25)', desc: '怒り・不安状態' },
    { label: '低覚醒×高Valence', value: circumplex_summary.low_arousal_positive, color: 'oklch(0.72 0.12 80)', desc: 'リラックス・満足状態' },
    { label: '低覚醒×低Valence', value: circumplex_summary.low_arousal_negative, color: 'oklch(0.55 0.12 250)', desc: '疲労・抑うつ状態' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-label mb-1">VALENCE ANALYSIS</div>
        <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.88 0.005 250)' }}>
          Valence 詳細分析
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.68 0.015 255)', marginTop: '0.25rem' }}>
          感情価（ポジティブ/ネガティブ）の分布と時系列パターン
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '平均値', value: val.mean.toFixed(2), unit: '%', color: 'oklch(0.62 0.18 25)' },
          { label: '最大値', value: val.max.toFixed(2), unit: '%', color: 'oklch(0.52 0.18 160)' },
          { label: '中央値', value: val.median.toFixed(2), unit: '%', color: 'oklch(0.62 0.18 160)' },
          { label: '最小値', value: val.min.toFixed(2), unit: '%', color: 'oklch(0.55 0.12 250)' },
        ].map((m, i) => (
          <div key={i} className="metric-card">
            <div className="section-label mb-2">{m.label}</div>
            <div className="flex items-baseline gap-1">
              <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.75rem', color: m.color, lineHeight: 1 }}>
                {m.value}
              </span>
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', color: 'oklch(0.68 0.015 255)' }}>
                {m.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Valence Time Series */}
      <div className="metric-card">
        <div className="section-label mb-3">VALENCE SIGNAL</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          Valenceの時系列推移
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={valTS} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.62 0.18 25)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="oklch(0.62 0.18 25)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
            <XAxis dataKey="time" tickFormatter={t => `${t.toFixed(0)}s`} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
            <YAxis domain={[25, 100]} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
            <Tooltip
              formatter={(v: number) => [v.toFixed(2), 'Valence']}
              {...rechartsTooltip}
            />
            <ReferenceLine y={90} stroke="oklch(0.62 0.18 160)" strokeDasharray="4 4" label={{ value: '90%', style: { fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', fill: 'oklch(0.42 0.12 160)' } }} />
            <Area type="monotone" dataKey="valence" stroke="oklch(0.62 0.18 25)" fill="url(#valGrad)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Distribution + Correlation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card">
          <div className="section-label mb-3">DISTRIBUTION</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
            Valenceレベル分布
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
              <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
              <Tooltip
                formatter={(v: number) => [`${v.toLocaleString()} フレーム`, 'フレーム数']}
                {...rechartsTooltip}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
                {distData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card">
          <div className="section-label mb-3">CORRELATIONS</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
            Valenceと各指標の相関係数
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={corrData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" horizontal={false} />
              <XAxis type="number" domain={[-1, 1]} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
              <YAxis type="category" dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.75 0.008 250)' }} width={55} />
              <Tooltip
                formatter={(v: number) => [v.toFixed(4), '相関係数']}
                {...rechartsTooltip}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
                {corrData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Circumplex Model */}
      <div className="metric-card">
        <div className="section-label mb-3">CIRCUMPLEX MODEL OF AFFECT</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
          感情の円環モデル（Russell, 1980）
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
          Engagementを覚醒度（Arousal）の代理指標として使用。各象限のフレーム数を示します。
        </p>
        <div className="grid grid-cols-2 gap-4">
          {circumplexData.map((item, i) => (
            <div key={i} className="p-4 rounded-lg flex items-start gap-3" style={{ background: 'oklch(0.22 0.04 255)', border: `1px solid ${item.color}30` }}>
              <div className="w-3 h-3 rounded-sm mt-0.5 flex-shrink-0" style={{ background: item.color }} />
              <div>
                <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.82rem', color: 'oklch(0.88 0.005 250)' }}>
                  {item.label}
                </div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 700, fontSize: '1.2rem', color: item.color, lineHeight: 1.2 }}>
                  {item.value.toLocaleString()}
                </div>
                <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.68 0.015 255)' }}>
                  フレーム — {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 rounded" style={{ background: 'oklch(0.95 0.005 250 / 0.5)', border: '1px solid oklch(0.88 0.008 250)' }}>
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.56 0.015 250)', lineHeight: 1.6 }}>
            <strong>解釈：</strong>大多数のフレーム（{circumplex_summary.low_arousal_positive.toLocaleString()}フレーム）が「低覚醒×高Valence」象限に分類されました。これはリラックスした満足状態または穏やかなポジティブ感情を示しており、覚醒度が低い（Engagement低）ながらも感情価は高い（Valence高）という特徴的なパターンです。
          </p>
        </div>
      </div>

      {/* Affect Dynamics */}
      {valDynamics && (
        <div className="metric-card">
          <div className="section-label mb-3">AFFECT DYNAMICS</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
            Valenceの動態指標
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: '変動性 (SD)', value: valDynamics.variability_sd.toFixed(4), desc: '感情価の変動幅' },
              { label: '不安定性 (MSSD)', value: valDynamics.instability_mssd.toFixed(4), desc: '連続変化の激しさ' },
              { label: '慣性 (AR1)', value: valDynamics.inertia_ar1.toFixed(4), desc: '状態の持続性' },
              { label: 'レンジ', value: valDynamics.range.toFixed(4), desc: '最大-最小' },
              { label: '平均絶対変化量', value: valDynamics.mean_absolute_change.toFixed(4), desc: '1フレームあたりの変化' },
            ].map((m, i) => (
              <div key={i} className="p-3 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.22 0.04 255)' }}>
                <div className="section-label mb-1">{m.label}</div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 600, fontSize: '1rem', color: 'oklch(0.88 0.005 250)' }}>
                  {m.value}
                </div>
                <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', color: 'oklch(0.68 0.015 255)', marginTop: '2px' }}>
                  {m.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
