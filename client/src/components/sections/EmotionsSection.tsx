/*
 * DESIGN: Neuro-Signal Interface
 * Emotion distribution and statistics
 */

import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS, ALL_EMOTIONS } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';

interface Props {
  data: DashboardData;
}

export default function EmotionsSection({ data }: Props) {
  const { emotion_stats, emotion_prevalence, affect_dynamics, dominant_emotion_pct } = data;

  const statsTableData = ALL_EMOTIONS.map((e: string) => ({
    emotion: EMOTION_LABELS_JA[e] || e,
    key: e,
    mean: emotion_stats[e]?.mean || 0,
    std: emotion_stats[e]?.std || 0,
    max: emotion_stats[e]?.max || 0,
    median: emotion_stats[e]?.median || 0,
    color: EMOTION_COLORS[e] || '#999',
  }));

  const prevalenceData = NON_NEUTRAL_EMOTIONS.map(e => ({
    name: EMOTION_LABELS_JA[e] || e,
    pct: emotion_prevalence[e]?.prevalence_pct || 0,
    count: emotion_prevalence[e]?.count || 0,
    color: EMOTION_COLORS[e] || '#999',
  })).sort((a, b) => b.pct - a.pct);

  const dynamicsData = NON_NEUTRAL_EMOTIONS.map(e => ({
    emotion: EMOTION_LABELS_JA[e] || e,
    variability: affect_dynamics[e]?.variability_sd || 0,
    instability: Math.sqrt(affect_dynamics[e]?.instability_mssd || 0),
    inertia: Math.abs(affect_dynamics[e]?.inertia_ar1 || 0),
    color: EMOTION_COLORS[e] || '#999',
  }));

  const radarData = NON_NEUTRAL_EMOTIONS.map(e => ({
    emotion: EMOTION_LABELS_JA[e] || e,
    mean: emotion_stats[e]?.mean || 0,
    max: emotion_stats[e]?.max || 0,
    prevalence: emotion_prevalence[e]?.prevalence_pct || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-label mb-1">EMOTION DISTRIBUTION</div>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.15 0.02 250)' }}>
          感情分布・統計
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.52 0.015 250)', marginTop: '0.25rem' }}>
          10種類の感情スコアの統計的分布と出現パターン
        </p>
      </div>

      {/* Emotion Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {NON_NEUTRAL_EMOTIONS.map(e => {
          const stats = emotion_stats[e];
          const pct = dominant_emotion_pct[e] || 0;
          return (
            <div key={e} className="metric-card" style={{ borderLeft: `3px solid ${EMOTION_COLORS[e]}` }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: EMOTION_COLORS[e] }} />
                <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.8rem', color: 'oklch(0.25 0.02 250)' }}>
                  {EMOTION_LABELS_JA[e]}
                </span>
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: EMOTION_COLORS[e], lineHeight: 1 }}>
                {stats?.mean.toFixed(3)}
              </div>
              <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.52 0.015 250)', marginTop: '4px' }}>
                平均値
              </div>
              <div className="mt-2 flex items-center gap-1">
                <div className="flex-1 h-1 rounded-full" style={{ background: 'oklch(0.92 0.004 80)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, stats?.max || 0)}%`, background: EMOTION_COLORS[e] }} />
                </div>
                <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.52 0.015 250)' }}>
                  {stats?.max.toFixed(1)}
                </span>
              </div>
              <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.52 0.015 250)', marginTop: '2px' }}>
                支配: {pct.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Prevalence Chart */}
      <div className="metric-card">
        <div className="section-label mb-3">EMOTION PREVALENCE</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '0.5rem' }}>
          感情出現率（閾値超過の割合）
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.52 0.015 250)', marginBottom: '1rem' }}>
          各感情が設定された閾値を超えたフレームの割合
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={prevalenceData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.52 0.015 250)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }} unit="%" />
            <Tooltip
              formatter={(v: number, _: string, props: any) => [
                `${v.toFixed(2)}% (${props.payload.count.toLocaleString()} フレーム)`,
                '出現率'
              ]}
              contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.88 0.008 80)', borderRadius: '6px' }}
            />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
              {prevalenceData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Table */}
      <div className="metric-card">
        <div className="section-label mb-3">DESCRIPTIVE STATISTICS</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '1rem' }}>
          感情スコアの記述統計
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '2px solid oklch(0.88 0.008 80)' }}>
                {['感情', '平均値', '標準偏差', '中央値', '最大値', '変動性(SD)', '慣性(AR1)'].map(h => (
                  <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.52 0.015 250)', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statsTableData.map((row: { emotion: string; key: string; mean: number; std: number; max: number; median: number; color: string }, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid oklch(0.94 0.003 80)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'oklch(0.97 0.003 80)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                      <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 500, fontSize: '0.8rem', color: 'oklch(0.25 0.02 250)' }}>
                        {row.emotion}
                      </span>
                    </div>
                  </td>
                  {[row.mean, row.std, row.median, row.max].map((v, j) => (
                    <td key={j} className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.35 0.015 250)' }}>
                      {v.toFixed(4)}
                    </td>
                  ))}
                  <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.35 0.015 250)' }}>
                    {affect_dynamics[row.key]?.variability_sd.toFixed(4) || '-'}
                  </td>
                  <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.35 0.015 250)' }}>
                    {affect_dynamics[row.key]?.inertia_ar1.toFixed(4) || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamics Comparison */}
      <div className="metric-card">
        <div className="section-label mb-3">AFFECT DYNAMICS COMPARISON</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '0.5rem' }}>
          感情動態指標の比較
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.52 0.015 250)', marginBottom: '1rem' }}>
          変動性（SD）・不安定性（MSSD平方根）・慣性（AR1絶対値）の感情間比較
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dynamicsData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" vertical={false} />
            <XAxis dataKey="emotion" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', fill: 'oklch(0.52 0.015 250)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }} />
            <Tooltip
              contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.88 0.008 80)', borderRadius: '6px' }}
            />
            <Bar dataKey="variability" name="変動性(SD)" fill="oklch(0.62 0.18 160)" radius={[4, 4, 0, 0]} opacity={0.85} />
            <Bar dataKey="instability" name="不安定性(√MSSD)" fill="oklch(0.62 0.18 25)" radius={[4, 4, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
