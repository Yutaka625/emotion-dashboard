/*
 * DESIGN: Neuro-Signal Interface
 * Academic analysis section with Affect Dynamics, Circumplex Model, etc.
 */

import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from 'recharts';

interface Props {
  data: DashboardData;
}

export default function AcademicSection({ data }: Props) {
  const { affect_dynamics, correlation_matrix, circumplex_summary, emotion_prevalence, special_stats, engagement_correlations } = data;

  // Affect Dynamics comparison
  const dynamicsCompare = [...NON_NEUTRAL_EMOTIONS, 'engagement', 'valence'].map(key => ({
    name: EMOTION_LABELS_JA[key] || key,
    key,
    sd: affect_dynamics[key]?.variability_sd || 0,
    mssd: Math.sqrt(affect_dynamics[key]?.instability_mssd || 0),
    ar1: affect_dynamics[key]?.inertia_ar1 || 0,
    mac: affect_dynamics[key]?.mean_absolute_change || 0,
    color: EMOTION_COLORS[key] || (key === 'engagement' ? 'oklch(0.72 0.18 80)' : 'oklch(0.62 0.18 25)'),
  }));

  // Correlation heatmap data
  const corrLabels = correlation_matrix.labels;
  const corrData = correlation_matrix.data;

  // Inertia vs Variability scatter
  const inertiaVarData = dynamicsCompare.map(d => ({
    name: d.name,
    variability: d.sd,
    inertia: d.ar1,
    color: d.color,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-label mb-1">ACADEMIC ANALYSIS</div>
        <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.88 0.005 250)' }}>
          学術的分析
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.58 0.015 255)', marginTop: '0.25rem' }}>
          Affect Dynamics・Circumplex Model・相関分析など学術研究の視点からの多角的分析
        </p>
      </div>

      {/* Theoretical Framework */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: 'Affect Dynamics',
            author: 'Kuppens et al. (2010)',
            desc: '感情の変動性（SD）・不安定性（MSSD）・慣性（AR1）を用いて感情の動的特性を定量化する枠組み。変動性は感情の揺れ幅、慣性は状態の持続性を示す。',
            color: 'oklch(0.62 0.18 160)',
          },
          {
            title: 'Circumplex Model of Affect',
            author: 'Russell (1980)',
            desc: '感情を覚醒度（Arousal）と感情価（Valence）の2次元空間で表現するモデル。EngagementをArousalの代理指標として使用し、感情状態を4象限に分類。',
            color: 'oklch(0.62 0.18 25)',
          },
          {
            title: 'Facial Action Coding System',
            author: 'Ekman & Friesen (1978)',
            desc: 'アクションユニット（AU）を用いて顔の筋肉動作を体系的に記述するシステム。本データのアクションユニット列はFACSに基づく表情筋活動の定量化。',
            color: 'oklch(0.55 0.18 300)',
          },
        ].map((f, i) => (
          <div key={i} className="p-4 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: `1px solid ${f.color}30` }}>
            <div className="flex items-start gap-2 mb-2">
              <div className="w-1 h-full min-h-12 rounded-full flex-shrink-0" style={{ background: f.color }} />
              <div>
                <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: 'oklch(0.88 0.005 250)' }}>
                  {f.title}
                </div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: f.color, marginTop: '2px' }}>
                  {f.author}
                </div>
              </div>
            </div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.45 0.015 250)', lineHeight: 1.6 }}>
              {f.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Affect Dynamics - Variability */}
      <div className="metric-card">
        <div className="section-label mb-3">AFFECT DYNAMICS — VARIABILITY</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
          感情変動性（Standard Deviation）
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.58 0.015 255)', marginBottom: '1rem' }}>
          高い変動性は感情の揺れ幅が大きいことを示します。Fearの変動性が最も高く、Engagementも高い変動性を示しています。
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dynamicsCompare} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', fill: 'oklch(0.58 0.015 255)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }} />
            <Tooltip
              formatter={(v: number) => [v.toFixed(4), 'SD（変動性）']}
              contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
            />
            <Bar dataKey="sd" radius={[4, 4, 0, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
              {dynamicsCompare.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Affect Dynamics - Inertia */}
      <div className="metric-card">
        <div className="section-label mb-3">AFFECT DYNAMICS — INERTIA (AR1)</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
          感情慣性（1次自己相関係数）
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.58 0.015 255)', marginBottom: '1rem' }}>
          高い慣性（AR1が1に近い）は感情状態が持続しやすいことを示します。負の値は振動パターンを示します。
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dynamicsCompare} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', fill: 'oklch(0.58 0.015 255)' }} />
            <YAxis domain={[-1, 1]} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }} />
            <Tooltip
              formatter={(v: number) => [v.toFixed(4), 'AR1（慣性）']}
              contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
            />
            <ReferenceLine y={0} stroke="oklch(0.58 0.015 255)" strokeDasharray="4 4" />
            <Bar dataKey="ar1" radius={[4, 4, 0, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
              {dynamicsCompare.map((entry, i) => (
                <Cell key={i} fill={entry.ar1 >= 0 ? 'oklch(0.62 0.18 160)' : 'oklch(0.62 0.18 25)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Correlation Heatmap */}
      <div className="metric-card">
        <div className="section-label mb-3">CORRELATION MATRIX</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
          感情指標間の相関行列
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.58 0.015 255)', marginBottom: '1rem' }}>
          色の濃さは相関の強さを示します。緑：正の相関、赤：負の相関。
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="w-16 pb-1" />
                {corrLabels.map(label => (
                  <th key={label} className="pb-1 px-0.5 text-center" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.6rem', color: EMOTION_COLORS[label] || 'oklch(0.58 0.015 255)', minWidth: '44px', writingMode: 'vertical-rl', height: '60px' }}>
                    {EMOTION_LABELS_JA[label] || label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corrLabels.map((rowLabel, ri) => (
                <tr key={rowLabel}>
                  <td className="py-0.5 pr-2" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.62rem', color: EMOTION_COLORS[rowLabel] || 'oklch(0.58 0.015 255)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {EMOTION_LABELS_JA[rowLabel] || rowLabel}
                  </td>
                  {corrLabels.map((colLabel, ci) => {
                    const val = corrData[ri]?.[ci] || 0;
                    const isDiag = ri === ci;
                    const intensity = Math.abs(val);
                    const isPos = val >= 0;
                    return (
                      <td key={colLabel} className="py-0.5 px-0.5" title={`${EMOTION_LABELS_JA[rowLabel] || rowLabel} × ${EMOTION_LABELS_JA[colLabel] || colLabel}: ${val.toFixed(3)}`}>
                        <div
                          className="w-10 h-7 rounded flex items-center justify-center"
                          style={{
                            background: isDiag
                              ? 'oklch(0.75 0.01 250)'
                              : isPos
                                ? `oklch(0.62 0.18 160 / ${Math.min(0.9, intensity * 1.2)})`
                                : `oklch(0.62 0.18 25 / ${Math.min(0.9, intensity * 1.2)})`,
                          }}
                        >
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.55rem', color: intensity > 0.4 ? 'white' : 'oklch(0.75 0.008 250)', fontWeight: 600 }}>
                            {isDiag ? '1.0' : val.toFixed(2)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Circumplex Model Visualization */}
      <div className="metric-card">
        <div className="section-label mb-3">CIRCUMPLEX MODEL — QUADRANT ANALYSIS</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
          感情の円環モデル象限分析（Russell, 1980）
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.58 0.015 255)', marginBottom: '1.5rem' }}>
          X軸：Valence（感情価）、Y軸：Engagement（覚醒度代理）。各象限のフレーム数と割合を示します。
        </p>
        <div className="relative" style={{ height: '280px' }}>
          {/* Quadrant grid */}
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0">
            {[
              { label: '高覚醒×高Valence', value: circumplex_summary.high_arousal_positive, desc: '活性化・興奮', color: 'oklch(0.62 0.18 160)', position: 'top-right' },
              { label: '高覚醒×低Valence', value: circumplex_summary.high_arousal_negative, desc: '怒り・不安', color: 'oklch(0.62 0.18 25)', position: 'top-left' },
              { label: '低覚醒×高Valence', value: circumplex_summary.low_arousal_positive, desc: 'リラックス・満足', color: 'oklch(0.72 0.12 80)', position: 'bottom-right' },
              { label: '低覚醒×低Valence', value: circumplex_summary.low_arousal_negative, desc: '疲労・抑うつ', color: 'oklch(0.55 0.12 250)', position: 'bottom-left' },
            ].map((q, i) => {
              const total = circumplex_summary.high_arousal_positive + circumplex_summary.high_arousal_negative + circumplex_summary.low_arousal_positive + circumplex_summary.low_arousal_negative;
              const pct = total > 0 ? (q.value / total * 100).toFixed(1) : '0';
              return (
                <div key={i} className="flex flex-col items-center justify-center p-4 rounded-lg m-1" style={{ background: `${q.color}10`, border: `1px solid ${q.color}30` }}>
                  <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.8rem', color: q.color, lineHeight: 1 }}>
                    {q.value.toLocaleString()}
                  </div>
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: q.color, marginTop: '2px' }}>
                    {pct}%
                  </div>
                  <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.75rem', color: 'oklch(0.88 0.005 250)', marginTop: '4px', textAlign: 'center' }}>
                    {q.label}
                  </div>
                  <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', color: 'oklch(0.58 0.015 255)', textAlign: 'center' }}>
                    {q.desc}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Axis labels */}
          <div className="absolute left-1/2 top-1 -translate-x-1/2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)' }}>
            ↑ 高覚醒 (High Arousal)
          </div>
          <div className="absolute left-1/2 bottom-1 -translate-x-1/2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)' }}>
            ↓ 低覚醒 (Low Arousal)
          </div>
          <div className="absolute top-1/2 left-1 -translate-y-1/2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)', writingMode: 'vertical-rl' }}>
            ← 低Valence
          </div>
          <div className="absolute top-1/2 right-1 -translate-y-1/2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)', writingMode: 'vertical-rl' }}>
            高Valence →
          </div>
        </div>
      </div>

      {/* Academic Interpretation */}
      <div className="metric-card">
        <div className="section-label mb-3">ACADEMIC INTERPRETATION</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          学術的解釈と考察
        </div>
        <div className="space-y-4">
          {[
            {
              heading: '1. 感情の安定性と慣性',
              content: `Affect Dynamicsの分析から、本セッションでは「困惑」が高い慣性（AR1: ${affect_dynamics.confusion?.inertia_ar1.toFixed(4)}）を示しており、一度この感情状態に入ると持続しやすいことが示唆されます。一方、Engagementは高い変動性（SD: ${affect_dynamics.engagement?.variability_sd.toFixed(4)}）を示し、瞬間的な覚醒の変化が頻繁に発生していました。`,
              color: 'oklch(0.62 0.18 160)',
            },
            {
              heading: '2. Valenceの高安定性',
              content: `Valenceの慣性（AR1: ${affect_dynamics.valence?.inertia_ar1.toFixed(4)}）は非常に高く、感情価が一度設定されると長時間維持される傾向があります。平均値${data.special_stats.valence?.mean.toFixed(2)}%という高いValenceが持続したことは、ポジティブな感情状態の安定性を示しています。`,
              color: 'oklch(0.62 0.18 25)',
            },
            {
              heading: '3. Engagement-Fear相関の解釈',
              content: `EngagementとFearの高い正相関（r = ${engagement_correlations.fear?.toFixed(4)}）は、高覚醒状態において恐怖・驚愕に関連する表情筋活動が増加することを示します。これはFACSにおけるAU1（内眉挙上）・AU2（外眉挙上）・AU5（目を見開く）の同時活性化パターンと一致します。`,
              color: 'oklch(0.55 0.18 300)',
            },
            {
              heading: '4. Circumplex Modelによる感情状態の分類',
              content: `Russell（1980）の円環モデルに基づく分析では、${circumplex_summary.low_arousal_positive.toLocaleString()}フレーム（${((circumplex_summary.low_arousal_positive / (data.meta?.total_frames || 3371)) * 100).toFixed(1)}%）が「低覚醒×高Valence」象限に分類されました。これは「穏やかな満足感」「リラックス状態」に対応し、本セッションの主要な感情状態を特徴づけています。`,
              color: 'oklch(0.72 0.12 80)',
            },
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', borderLeft: `3px solid ${item.color}` }}>
              <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.85rem', color: 'oklch(0.88 0.005 250)', marginBottom: '6px' }}>
                {item.heading}
              </div>
              <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.42 0.015 250)', lineHeight: 1.7 }}>
                {item.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
