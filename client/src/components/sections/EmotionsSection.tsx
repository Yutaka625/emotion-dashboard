/*
 * DESIGN: Neuro-Signal Interface
 * Emotion distribution and statistics
 */

import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS, ALL_EMOTIONS } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar, ReferenceLine,
} from 'recharts';
import { rechartsTooltip } from '@/lib/chartTooltip';
import { formatScore } from '@/lib/utils';

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
    // 慣性(AR1)は別カードで符号付き表示するため signed を保持する。
    // 変動性・不安定性(0〜100スケール由来)とはレンジが大きく異なる(-1〜1)ので同一グラフには混ぜない。
    inertia: affect_dynamics[e]?.inertia_ar1 || 0,
    color: EMOTION_COLORS[e] || '#999',
  }));

  const radarData = NON_NEUTRAL_EMOTIONS.map(e => ({
    emotion: EMOTION_LABELS_JA[e] || e,
    mean: emotion_stats[e]?.mean || 0,
    max: emotion_stats[e]?.max || 0,
    prevalence: emotion_prevalence[e]?.prevalence_pct || 0,
  }));

  // 出現率の判定に使われている実際の閾値を取得する（生成側で固定 0.3。emotion_prevalence に格納済み）。
  // 旧文言「設定された閾値」はユーザーが設定できると誤解させるため、実値を明示する。
  const prevalenceThreshold = NON_NEUTRAL_EMOTIONS
    .map(e => emotion_prevalence[e]?.threshold)
    .find(v => v != null) ?? 0.3;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-label mb-1">EMOTION DISTRIBUTION</div>
        <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.88 0.005 250)' }}>
          感情分布・統計
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.68 0.015 255)', marginTop: '0.25rem' }}>
          10種類の感情スコアの統計的分布と出現パターン
        </p>
      </div>

      {/* Emotion Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {NON_NEUTRAL_EMOTIONS.map(e => {
          const stats = emotion_stats[e];
          const pct = dominant_emotion_pct[e] || 0;
          return (
            <div key={e} className="metric-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: EMOTION_COLORS[e] }} />
                <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.8rem', color: 'oklch(0.88 0.005 250)' }}>
                  {EMOTION_LABELS_JA[e]}
                </span>
              </div>
              <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: EMOTION_COLORS[e], lineHeight: 1 }}>
                {formatScore(stats?.mean ?? 0)}
              </div>
              <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.68 0.015 255)', marginTop: '4px' }}>
                平均値
              </div>
              <div className="mt-2 flex items-center gap-1">
                <div className="flex-1 h-1 rounded-full" style={{ background: 'oklch(0.22 0.04 255)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, stats?.max || 0)}%`, background: EMOTION_COLORS[e] }} />
                </div>
                <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)' }}>
                  {formatScore(stats?.max ?? 0)}
                </span>
              </div>
              <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)', marginTop: '2px' }}>
                支配: {pct.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Prevalence Chart */}
      <div className="metric-card">
        <div className="section-label mb-3">EMOTION PREVALENCE</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
          感情出現率（閾値超過の割合）
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
          各感情のスコアが <strong style={{ color: 'oklch(0.82 0.008 250)' }}>{prevalenceThreshold}</strong>（0〜100スケール）を超えたフレームの割合。低めの閾値のため、わずかな表出も出現として数えます。
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={prevalenceData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.68 0.015 255)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} unit="%" />
            <Tooltip
              formatter={(v: number, _: string, props: any) => [
                `${v.toFixed(2)}% (${props.payload.count.toLocaleString()} フレーム)`,
                '出現率'
              ]}
              {...rechartsTooltip}
            />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
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
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          感情スコアの記述統計
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '2px solid oklch(0.28 0.04 255)' }}>
                {['感情', '平均値', '標準偏差', '中央値', '最大値', '変動性(SD)', '慣性(AR1)'].map(h => (
                  <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statsTableData.map((row: { emotion: string; key: string; mean: number; std: number; max: number; median: number; color: string }, i: number) => (
                <tr key={i} className="row-hover" style={{ borderBottom: '1px solid oklch(0.20 0.04 255)' }}>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                      <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 500, fontSize: '0.8rem', color: 'oklch(0.88 0.005 250)' }}>
                        {row.emotion}
                      </span>
                    </div>
                  </td>
                  {[row.mean, row.std, row.median, row.max].map((v, j) => (
                    <td key={j} className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.75 0.008 250)' }}>
                      {v.toFixed(4)}
                    </td>
                  ))}
                  <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.75 0.008 250)' }}>
                    {affect_dynamics[row.key]?.variability_sd.toFixed(4) || '-'}
                  </td>
                  <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.75 0.008 250)' }}>
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
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
          感情動態指標の比較
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
          変動性（SD）・不安定性（MSSD平方根）の感情間比較
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dynamicsData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
            <XAxis dataKey="emotion" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', fill: 'oklch(0.68 0.015 255)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
            <Tooltip
              {...rechartsTooltip}
            />
            <Bar dataKey="variability" name="変動性(SD)" fill="oklch(0.62 0.18 160)" radius={[4, 4, 0, 0]} opacity={0.85} activeBar={{ fill: "oklch(0.55 0.04 255 / 0.6)", stroke: "none" }} />
            <Bar dataKey="instability" name="不安定性(√MSSD)" fill="oklch(0.62 0.18 25)" radius={[4, 4, 0, 0]} opacity={0.85} activeBar={{ fill: "oklch(0.55 0.04 255 / 0.6)", stroke: "none" }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Inertia (AR1) — 別カードで表示 */}
      {/* 慣性(AR1)は -1〜1 スケールで、変動性・不安定性(0〜100由来)と桁が違うため別グラフにする。
          学術タブの慣性カードと同じ体裁（domain[-1,1]・ゼロライン・符号で色分け）に揃える。 */}
      <div className="metric-card">
        <div className="section-label mb-3">AFFECT DYNAMICS — INERTIA</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
          感情慣性（AR1）の比較
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
          1フレーム前との自己相関（AR1）。1に近いほど状態が持続し、負の値は揺り戻し（振動）を示します。
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dynamicsData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
            <XAxis dataKey="emotion" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', fill: 'oklch(0.68 0.015 255)' }} />
            <YAxis domain={[-1, 1]} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
            <Tooltip
              formatter={(v: number) => [v.toFixed(4), 'AR1（慣性）']}
              {...rechartsTooltip}
            />
            <ReferenceLine y={0} stroke="oklch(0.68 0.015 255)" strokeDasharray="4 4" />
            <Bar dataKey="inertia" name="慣性(AR1)" radius={[4, 4, 0, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
              {dynamicsData.map((entry, i) => (
                <Cell key={i} fill={entry.inertia >= 0 ? 'oklch(0.62 0.18 160)' : 'oklch(0.62 0.18 25)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
