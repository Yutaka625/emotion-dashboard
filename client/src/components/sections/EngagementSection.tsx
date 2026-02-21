/*
 * DESIGN: Neuro-Signal Interface
 * Engagement deep-dive analysis
 */

import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, AreaChart, Area, Legend,
} from 'recharts';

interface Props {
  data: DashboardData;
}

export default function EngagementSection({ data }: Props) {
  const { special_stats, engagement_distribution, engagement_correlations, engagement_emotion_profile, scatter_eng_val, affect_dynamics } = data;

  const eng = special_stats.engagement;

  const distData = [
    { label: '非常に低い\n(<10)', value: engagement_distribution.very_low || 0, color: 'oklch(0.75 0.05 250)' },
    { label: '低い\n(10-30)', value: engagement_distribution.low || 0, color: 'oklch(0.65 0.1 250)' },
    { label: '中程度\n(30-60)', value: engagement_distribution.medium || 0, color: 'oklch(0.72 0.18 80)' },
    { label: '高い\n(60-80)', value: engagement_distribution.high || 0, color: 'oklch(0.62 0.18 25)' },
    { label: '非常に高い\n(>80)', value: engagement_distribution.very_high || 0, color: 'oklch(0.55 0.22 25)' },
  ];

  const corrData = Object.entries(engagement_correlations)
    .filter(([k]) => k !== 'engagement')
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, val]) => ({
      name: EMOTION_LABELS_JA[key] || key,
      value: val,
      color: val > 0 ? 'oklch(0.62 0.18 160)' : 'oklch(0.62 0.18 25)',
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

  // Scatter data for engagement vs valence
  const scatterData = scatter_eng_val.slice(0, 1000);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-label mb-1">ENGAGEMENT ANALYSIS</div>
        <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.15 0.02 250)' }}>
          Engagement 詳細分析
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.52 0.015 250)', marginTop: '0.25rem' }}>
          関与度・覚醒度の時系列パターンと感情との関係性
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '平均値', value: eng.mean.toFixed(2), unit: '%', color: 'oklch(0.72 0.18 80)' },
          { label: '最大値', value: eng.max.toFixed(2), unit: '%', color: 'oklch(0.62 0.18 25)' },
          { label: '中央値', value: eng.median.toFixed(2), unit: '%', color: 'oklch(0.62 0.18 160)' },
          { label: '標準偏差', value: eng.std.toFixed(2), unit: '%', color: 'oklch(0.55 0.18 300)' },
        ].map((m, i) => (
          <div key={i} className="metric-card">
            <div className="section-label mb-2">{m.label}</div>
            <div className="flex items-baseline gap-1">
              <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.75rem', color: m.color, lineHeight: 1 }}>
                {m.value}
              </span>
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', color: 'oklch(0.52 0.015 250)' }}>
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
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '1rem' }}>
            Engagementレベル分布
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }} />
              <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }} />
              <Tooltip
                formatter={(v: number) => [`${v.toLocaleString()} フレーム`, 'フレーム数']}
                contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.88 0.008 80)', borderRadius: '6px' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {distData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Correlation */}
        <div className="metric-card">
          <div className="section-label mb-3">CORRELATIONS</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '1rem' }}>
            Engagementと各指標の相関係数
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={corrData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" horizontal={false} />
              <XAxis type="number" domain={[-1, 1]} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }} />
              <YAxis type="category" dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.35 0.015 250)' }} width={55} />
              <Tooltip
                formatter={(v: number) => [v.toFixed(4), '相関係数']}
                contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.88 0.008 80)', borderRadius: '6px' }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {corrData.map((entry, i) => (
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
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '0.5rem' }}>
          Engagement × Valence 散布図
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.52 0.015 250)', marginBottom: '1rem' }}>
          各点は1フレームを表します。色は支配的感情を示します（先頭1000点を表示）。
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" />
            <XAxis dataKey="valence" name="Valence" type="number" domain={[25, 100]}
              label={{ value: 'Valence (%)', position: 'insideBottom', offset: -10, style: { fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', fill: 'oklch(0.52 0.015 250)' } }}
              tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }}
            />
            <YAxis dataKey="engagement" name="Engagement" type="number"
              label={{ value: 'Engagement (%)', angle: -90, position: 'insideLeft', style: { fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', fill: 'oklch(0.52 0.015 250)' } }}
              tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="p-2 rounded shadow-lg" style={{ background: 'oklch(0.15 0.02 250)', border: '1px solid oklch(0.25 0.02 250)' }}>
                    <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.62 0.18 160)' }}>t={d?.time?.toFixed(2)}s</div>
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
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '0.5rem' }}>
          高/低Engagement時の感情プロファイル比較
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.52 0.015 250)', marginBottom: '1rem' }}>
          高Engagement（&gt;60%）: {engagement_emotion_profile.high_count}フレーム　
          低Engagement（≤10%）: {engagement_emotion_profile.low_count}フレーム
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={profileData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', fill: 'oklch(0.52 0.015 250)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }} />
            <Tooltip
              contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.88 0.008 80)', borderRadius: '6px' }}
            />
            <Legend formatter={v => <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem' }}>{v}</span>} />
            <Bar dataKey="high" name="高Engagement時" fill="oklch(0.62 0.18 25)" radius={[4, 4, 0, 0]} opacity={0.85} />
            <Bar dataKey="low" name="低Engagement時" fill="oklch(0.62 0.18 250)" radius={[4, 4, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Affect Dynamics */}
      {engDynamics && (
        <div className="metric-card">
          <div className="section-label mb-3">AFFECT DYNAMICS</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '1rem' }}>
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
              <div key={i} className="p-3 rounded-lg" style={{ background: 'oklch(0.97 0.003 80)', border: '1px solid oklch(0.92 0.004 80)' }}>
                <div className="section-label mb-1">{m.label}</div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 600, fontSize: '1rem', color: 'oklch(0.25 0.02 250)' }}>
                  {m.value}
                </div>
                <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', color: 'oklch(0.52 0.015 250)', marginTop: '2px' }}>
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
