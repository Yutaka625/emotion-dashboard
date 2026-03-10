/*
 * DESIGN: Neuro-Signal Interface
 * Engagement & Valence deep-dive analysis (unified)
 */

import { useState } from 'react';
import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, AreaChart, Area, Legend, ReferenceLine,
} from 'recharts';

interface Props {
  data: DashboardData;
}

export default function EngagementValenceSection({ data }: Props) {
  const [activeTab, setActiveTab] = useState<'engagement' | 'valence'>('engagement');

  const { special_stats, engagement_distribution, engagement_correlations, engagement_emotion_profile, scatter_eng_val, affect_dynamics, valence_distribution, valence_correlations, timeseries_full, circumplex_summary } = data;

  const eng = special_stats.engagement;
  const val = special_stats.valence;

  // Engagement data
  const engDistData = [
    { label: '非常に低い\n(<10)', value: engagement_distribution.very_low || 0, color: 'oklch(0.75 0.05 250)' },
    { label: '低い\n(10-30)', value: engagement_distribution.low || 0, color: 'oklch(0.65 0.1 250)' },
    { label: '中程度\n(30-60)', value: engagement_distribution.medium || 0, color: 'oklch(0.72 0.18 80)' },
    { label: '高い\n(60-80)', value: engagement_distribution.high || 0, color: 'oklch(0.68 0.26 22)' },
    { label: '非常に高い\n(>80)', value: engagement_distribution.very_high || 0, color: 'oklch(0.58 0.26 22)' },
  ];

  const engCorrData = Object.entries(engagement_correlations)
    .filter(([k]) => k !== 'engagement')
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, val]) => ({
      name: EMOTION_LABELS_JA[key] || key,
      value: val,
      color: val > 0 ? 'oklch(0.70 0.14 195)' : 'oklch(0.68 0.26 22)',
    }));

  const profileData = Object.entries(engagement_emotion_profile.high_engagement || {})
    .filter(([k]) => k !== 'neutral')
    .map(([key, highVal]) => ({
      name: EMOTION_LABELS_JA[key] || key,
      high: highVal,
      low: engagement_emotion_profile.low_engagement?.[key] || 0,
      color: EMOTION_COLORS[key] || '#999',
    }));

  const engDynamics = affect_dynamics.engagement;
  const scatterData = scatter_eng_val.slice(0, 1000);

  // Valence data
  const valDistData = [
    { label: '非常に低い\n(<50)', value: valence_distribution.very_low || 0, color: 'oklch(0.45 0.22 25)' },
    { label: '低い\n(50-80)', value: valence_distribution.low || 0, color: 'oklch(0.58 0.18 25)' },
    { label: '中程度\n(80-90)', value: valence_distribution.neutral_range || 0, color: 'oklch(0.72 0.12 80)' },
    { label: '高い\n(90-95)', value: valence_distribution.high || 0, color: 'oklch(0.62 0.18 160)' },
    { label: '非常に高い\n(>95)', value: valence_distribution.very_high || 0, color: 'oklch(0.52 0.18 160)' },
  ];

  const valCorrData = Object.entries(valence_correlations)
    .filter(([k]) => k !== 'valence')
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, val]) => ({
      name: EMOTION_LABELS_JA[key] || key,
      value: val,
      color: val > 0 ? 'oklch(0.62 0.18 160)' : 'oklch(0.62 0.18 25)',
    }));

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
        <div className="section-label mb-1">ENGAGEMENT & VALENCE ANALYSIS</div>
        <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.88 0.005 250)' }}>
          Engagement & Valence 詳細分析
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.58 0.015 255)', marginTop: '0.25rem' }}>
          関与度・感情価の統合分析
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'engagement', label: 'Engagement' },
          { id: 'valence', label: 'Valence' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'engagement' | 'valence')}
            className="px-4 py-2 rounded text-sm transition-all"
            style={{
              fontFamily: 'Noto Sans JP, sans-serif',
              background: activeTab === tab.id ? 'oklch(0.32 0.12 160)' : 'oklch(0.20 0.04 255)',
              color: activeTab === tab.id ? 'white' : 'oklch(0.45 0.015 250)',
              border: `1px solid ${activeTab === tab.id ? 'oklch(0.52 0.18 160)' : 'oklch(0.28 0.04 255)'}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Engagement Tab */}
      {activeTab === 'engagement' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '平均値', value: eng.mean.toFixed(2), unit: '%', color: 'oklch(0.72 0.18 80)' },
              { label: '最大値', value: eng.max.toFixed(2), unit: '%', color: 'oklch(0.68 0.26 22)' },
              { label: '中央値', value: eng.median.toFixed(2), unit: '%', color: 'oklch(0.70 0.14 195)' },
              { label: '標準偏差', value: eng.std.toFixed(2), unit: '%', color: 'oklch(0.55 0.18 300)' },
            ].map((m, i) => (
              <div key={i} className="metric-card">
                <div className="section-label mb-2">{m.label}</div>
                <div className="flex items-baseline gap-1">
                  <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.75rem', color: m.color, lineHeight: 1 }}>
                    {m.value}
                  </span>
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', color: 'oklch(0.58 0.015 255)' }}>
                    {m.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Distribution + Correlation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribution */}
            <div className="metric-card">
              <div className="section-label mb-3">DISTRIBUTION</div>
              <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
                Engagementレベル分布
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={engDistData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }} />
                  <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }} />
                  <Tooltip
                    formatter={(v: number) => [`${v.toLocaleString()} フレーム`, 'フレーム数']}
                    contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
                    {engDistData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Correlation */}
            <div className="metric-card">
              <div className="section-label mb-3">CORRELATIONS</div>
              <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
                Engagementと各指標の相関係数
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={engCorrData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" horizontal={false} />
                  <XAxis type="number" domain={[-1, 1]} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.75 0.008 250)' }} width={55} />
                  <Tooltip
                    formatter={(v: number) => [v.toFixed(4), '相関係数']}
                    contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
                    {engCorrData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Engagement vs Valence Scatter */}
          <div className="metric-card">
            <div className="section-label mb-3">ENGAGEMENT × VALENCE</div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
              Engagement × Valence 散布図
            </div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.58 0.015 255)', marginBottom: '1rem' }}>
              各点は1フレームを表します。色は支配的感情を示します（先頭1000点を表示）。
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
                <XAxis dataKey="valence" name="Valence" type="number" domain={[25, 100]}
                  label={{ value: 'Valence (%)', position: 'insideBottom', offset: -10, style: { fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', fill: 'oklch(0.58 0.015 255)' } }}
                  tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }}
                />
                <YAxis dataKey="engagement" name="Engagement" type="number"
                  label={{ value: 'Engagement (%)', angle: -90, position: 'insideLeft', style: { fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', fill: 'oklch(0.58 0.015 255)' } }}
                  tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="p-2 rounded shadow-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.30 0.04 255)' }}>
                        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.70 0.14 195)' }}>t={d?.time?.toFixed(2)}s</div>
                        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.75 0.005 80)' }}>
                          Eng: {d?.engagement?.toFixed(1)} | Val: {d?.valence?.toFixed(1)}
                        </div>
                        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: EMOTION_COLORS[d?.dominant] || '#999' }}>
                          {EMOTION_LABELS_JA[d?.dominant] || d?.dominant}
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData} opacity={0.6}>
                  {scatterData.map((entry, i) => (
                    <Cell key={i} fill={EMOTION_COLORS[entry.dominant] || '#999'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* High vs Low Engagement Profile */}
          <div className="metric-card">
            <div className="section-label mb-3">EMOTION PROFILE BY ENGAGEMENT</div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
              高/低Engagement時の感情プロファイル比較
            </div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.58 0.015 255)', marginBottom: '1rem' }}>
              高Engagement（&gt;60%）: {engagement_emotion_profile.high_count}フレーム　
              低Engagement（≤10%）: {engagement_emotion_profile.low_count}フレーム
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={profileData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', fill: 'oklch(0.58 0.015 255)' }} />
                <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }} />
                <Tooltip
                  contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
                />
                <Legend formatter={v => <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem' }}>{v}</span>} />
                <Bar dataKey="high" name="高Engagement時" fill="oklch(0.68 0.26 22)" radius={[4, 4, 0, 0]} opacity={0.85} activeBar={{ fill: "oklch(0.55 0.04 255 / 0.6)", stroke: "none" }} />
                <Bar dataKey="low" name="低Engagement時" fill="oklch(0.62 0.18 250)" radius={[4, 4, 0, 0]} opacity={0.85} activeBar={{ fill: "oklch(0.55 0.04 255 / 0.6)", stroke: "none" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Affect Dynamics */}
          {engDynamics && (
            <div className="metric-card">
              <div className="section-label mb-3">AFFECT DYNAMICS</div>
              <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
                Engagementの動態指標（学術的分析）
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: '変動性 (SD)', value: engDynamics.variability_sd.toFixed(4), desc: '感情の変動幅' },
                  { label: '不安定性 (MSSD)', value: engDynamics.instability_mssd.toFixed(4), desc: '連続変化の激しさ' },
                  { label: '慣性 (AR1)', value: engDynamics.inertia_ar1.toFixed(4), desc: '状態の持続性' },
                  { label: 'レンジ', value: engDynamics.range.toFixed(4), desc: '最大-最小' },
                  { label: '平均絶対変化量', value: engDynamics.mean_absolute_change.toFixed(4), desc: '1フレームあたりの変化' },
                ].map((m, i) => (
                  <div key={i} className="p-3 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.22 0.04 255)' }}>
                    <div className="section-label mb-1">{m.label}</div>
                    <div style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 600, fontSize: '1rem', color: 'oklch(0.88 0.005 250)' }}>
                      {m.value}
                    </div>
                    <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', color: 'oklch(0.58 0.015 255)', marginTop: '2px' }}>
                      {m.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Valence Tab */}
      {activeTab === 'valence' && (
        <div className="space-y-6">
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
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', color: 'oklch(0.58 0.015 255)' }}>
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
                <XAxis dataKey="time" tickFormatter={t => `${t.toFixed(0)}s`} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }} />
                <YAxis domain={[25, 100]} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }} />
                <Tooltip
                  formatter={(v: number) => [v.toFixed(2), 'Valence']}
                  contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
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
                <BarChart data={valDistData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.62rem', fill: 'oklch(0.58 0.015 255)' }} />
                  <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }} />
                  <Tooltip
                    formatter={(v: number) => [`${v.toLocaleString()} フレーム`, 'フレーム数']}
                    contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
                    {valDistData.map((entry, i) => (
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
                <BarChart data={valCorrData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" horizontal={false} />
                  <XAxis type="number" domain={[-1, 1]} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.75 0.008 250)' }} width={55} />
                  <Tooltip
                    formatter={(v: number) => [v.toFixed(4), '相関係数']}
                    contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
                    {valCorrData.map((entry, i) => (
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
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.58 0.015 255)', marginBottom: '1rem' }}>
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
                    <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.58 0.015 255)' }}>
                      フレーム — {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 rounded" style={{ background: 'oklch(0.95 0.005 250 / 0.5)', border: '1px solid oklch(0.88 0.008 250)' }}>
              <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.42 0.015 250)', lineHeight: 1.6 }}>
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
                    <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', color: 'oklch(0.58 0.015 255)', marginTop: '2px' }}>
                      {m.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
