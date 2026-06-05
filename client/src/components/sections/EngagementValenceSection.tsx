/*
 * DESIGN: Neuro-Signal Interface
 * Special Indicators deep-dive analysis (unified)
 */

import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, AreaChart, Area, Legend, ReferenceLine,
} from 'recharts';
import { rechartsTooltip } from '@/lib/chartTooltip';
import { formatPct } from '@/lib/utils';
import { useBaseline } from '@/contexts/BaselineContext';
import AbsoluteScaleBadge from '@/components/ui/AbsoluteScaleBadge';

interface Props {
  data: DashboardData;
}

export default function EngagementValenceSection({ data }: Props) {
  const { special_stats, engagement_distribution, engagement_correlations, engagement_emotion_profile, scatter_eng_val, affect_dynamics, valence_distribution, valence_correlations, timeseries_full, circumplex_summary } = data;
  // Circumplex は絶対値スケール前提のため補正対象外。補正中はその旨を明示する。
  const { isBaselineActive } = useBaseline();

  const eng = special_stats.engagement;
  const val = special_stats.valence;

  // Engagement data
  // 生成側（csvAnalyzer.ts）の実キーは 'Very Low (0-20)' 〜 'Very High (80-100)'（0〜100を20刻み）。
  // 旧コードは very_low 等の別名キー＋異なるビン境界(<10/10-30…)を参照していたため、
  // 全バーが 0（=グラフが空）になっていた。実キーとビン境界(20刻み)に揃える。
  const engDistData = [
    { label: '0-20\n非常に低い', value: engagement_distribution['Very Low (0-20)'] || 0, color: 'oklch(0.75 0.05 250)' },
    { label: '20-40\n低い', value: engagement_distribution['Low (20-40)'] || 0, color: 'oklch(0.65 0.1 250)' },
    { label: '40-60\n中程度', value: engagement_distribution['Medium (40-60)'] || 0, color: 'oklch(0.72 0.18 80)' },
    { label: '60-80\n高い', value: engagement_distribution['High (60-80)'] || 0, color: 'oklch(0.68 0.26 22)' },
    { label: '80-100\n非常に高い', value: engagement_distribution['Very High (80-100)'] || 0, color: 'oklch(0.58 0.26 22)' },
  ];

  const engCorrData = Object.entries(engagement_correlations)
    .filter(([k]) => k !== 'engagement')
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, val]) => ({
      name: EMOTION_LABELS_JA[key] || key,
      value: val,
      color: val > 0 ? 'oklch(0.70 0.14 195)' : 'oklch(0.68 0.26 22)',
    }));

  // Valence データ
  // 分布は生成側で min〜max を5分割した動的な範囲キー（例 '−7.2~12.3'）なので Object.entries で描画する。
  // 相関は自身（valence）を除外し、|r| の大きい順に並べる（Engagement 相関と同じ体裁）。
  const valDistColors = ['oklch(0.55 0.12 250)', 'oklch(0.60 0.10 220)', 'oklch(0.70 0.08 200)', 'oklch(0.70 0.14 160)', 'oklch(0.62 0.18 160)'];
  const valDistData = Object.entries(valence_distribution).map(([label, value], i) => ({
    label,
    value: value || 0,
    color: valDistColors[i % valDistColors.length],
  }));

  const valCorrData = Object.entries(valence_correlations)
    .filter(([k]) => k !== 'valence')
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, v]) => ({
      name: EMOTION_LABELS_JA[key] || key,
      value: v,
      color: v > 0 ? 'oklch(0.70 0.14 195)' : 'oklch(0.68 0.26 22)',
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
  // 散布図の各点に「表示用の色」と「支配的感情の日本語名」を付与する。
  // 生成側（scatter_eng_val）は dominant（感情キー）だけを持ち color/emotion が無いため、
  // 旧コードでは点が全て同色・ツールチップの感情が常に「N/A」になっていた。
  // 色は表示の関心事なのでここ（コンポーネント側）で dominant から引く。
  const scatterData = scatter_eng_val.slice(0, 1000).map(d => ({
    ...d,
    color: EMOTION_COLORS[d.dominant] || 'oklch(0.70 0.14 195)',
    emotion: EMOTION_LABELS_JA[d.dominant] || d.dominant,
  }));

  const circumplexData = [
    { label: '高覚醒×高Valence', value: circumplex_summary.high_arousal_positive, color: 'oklch(0.62 0.18 160)', desc: '活性化・興奮状態' },
    { label: '高覚醒×低Valence', value: circumplex_summary.high_arousal_negative, color: 'oklch(0.62 0.18 25)', desc: '怒り・不安状態' },
    { label: '低覚醒×高Valence', value: circumplex_summary.low_arousal_positive, color: 'oklch(0.72 0.12 80)', desc: 'リラックス・満足状態' },
    { label: '低覚醒×低Valence', value: circumplex_summary.low_arousal_negative, color: 'oklch(0.55 0.12 250)', desc: '疲労・抑うつ状態' },
  ];

  // 円環モデルの解釈文はデータ駆動で生成する。
  // 固定中立点分割（Engagement=50 / Valence=0）では最多象限がデータにより変わるため、
  // 旧コードのような「低覚醒×高Valence」固定の文言は使わず、実際の最多象限を選ぶ。
  const circumTotal = circumplexData.reduce((s, q) => s + q.value, 0) || 1;
  const dominantQuadrant = [...circumplexData].sort((a, b) => b.value - a.value)[0];
  const dominantQuadrantPct = ((dominantQuadrant.value / circumTotal) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-label mb-1">SPECIAL INDICATORS ANALYSIS</div>
        <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.88 0.005 250)' }}>
          特殊指標 詳細分析
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.68 0.015 255)', marginTop: '0.25rem' }}>
          関与度・感情価の統合分析
        </p>
      </div>

      {/* Special Indicators Tab */}
      <div className="space-y-6">
        {/* ===== Engagement（関与度）ブロック ===== */}
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'oklch(0.78 0.16 80)', borderLeft: '3px solid oklch(0.72 0.18 80)', paddingLeft: '0.6rem' }}>
          Engagement（関与度）
        </div>
        {/* Key Metrics - Engagement */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Engagement 平均値', value: formatPct(eng.mean), unit: '%', color: 'oklch(0.72 0.18 80)' },
            { label: 'Engagement 最大値', value: formatPct(eng.max), unit: '%', color: 'oklch(0.68 0.26 22)' },
            { label: 'Engagement 中央値', value: formatPct(eng.median), unit: '%', color: 'oklch(0.70 0.14 195)' },
            { label: 'Engagement 標準偏差', value: formatPct(eng.std), unit: '%', color: 'oklch(0.55 0.18 300)' },
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

        {/* Distribution + Correlation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribution */}
          <div className="metric-card">
            <div className="section-label mb-3">DISTRIBUTION</div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
              Engagement レベル分布
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={engDistData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
                <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString()} フレーム`, 'フレーム数']}
                  {...rechartsTooltip}
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
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.4rem' }}>
              Engagement と各指標のピアソン相関係数
            </div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)', marginBottom: '0.8rem', lineHeight: 1.6 }}>
              −1〜+1の範囲。+1に近いほど Engagement と同時に増減し、−1に近いほど逆方向に動きます（0は無関係）。
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={engCorrData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" horizontal={false} />
                <XAxis type="number" domain={[-1, 1]} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.75 0.008 250)' }} width={55} />
                <Tooltip
                  formatter={(v: number) => [v.toFixed(4), '相関係数']}
                  {...rechartsTooltip}
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

        {/* ===== Valence（感情価）ブロック ===== */}
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'oklch(0.74 0.14 195)', borderLeft: '3px solid oklch(0.70 0.14 195)', paddingLeft: '0.6rem', marginTop: '0.5rem' }}>
          Valence（感情価）
        </div>
        {/* Key Metrics - Valence */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Valence 平均値', value: formatPct(val.mean), unit: '%', color: 'oklch(0.70 0.14 195)' },
            { label: 'Valence 最大値', value: formatPct(val.max), unit: '%', color: 'oklch(0.62 0.18 160)' },
            { label: 'Valence 中央値', value: formatPct(val.median), unit: '%', color: 'oklch(0.66 0.14 220)' },
            { label: 'Valence 標準偏差', value: formatPct(val.std), unit: '%', color: 'oklch(0.55 0.18 300)' },
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

        {/* Valence Distribution + Correlation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Valence Distribution */}
          <div className="metric-card">
            <div className="section-label mb-3">DISTRIBUTION</div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
              Valence レベル分布
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={valDistData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
                <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString()} フレーム`, 'フレーム数']}
                  {...rechartsTooltip}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
                  {valDistData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Valence Correlation */}
          <div className="metric-card">
            <div className="section-label mb-3">CORRELATIONS</div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.4rem' }}>
              Valence と各指標のピアソン相関係数
            </div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)', marginBottom: '0.8rem', lineHeight: 1.6 }}>
              −1〜+1の範囲。+1に近いほど Valence と同時に増減し、−1に近いほど逆方向に動きます（0は無関係）。
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={valCorrData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" horizontal={false} />
                <XAxis type="number" domain={[-1, 1]} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.75 0.008 250)' }} width={55} />
                <Tooltip
                  formatter={(v: number) => [v.toFixed(4), '相関係数']}
                  {...rechartsTooltip}
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

        {/* Engagement vs Valence Scatter */}
        <div className="metric-card">
          <div className="section-label mb-3">ENGAGEMENT × VALENCE</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
            Engagement × Valence 散布図
          </div>
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
            各点は1フレームを表します。色は支配的感情を示します（先頭1000点を表示）。
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
              <XAxis dataKey="valence" name="Valence" type="number" domain={[-100, 100]}
                label={{ value: 'Valence (%)', position: 'insideBottom', offset: -10, style: { fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', fill: 'oklch(0.68 0.015 255)' } }}
                tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }}
              />
              <YAxis dataKey="engagement" name="Engagement" type="number"
                label={{ value: 'Engagement (%)', angle: -90, position: 'insideLeft', style: { fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', fill: 'oklch(0.68 0.015 255)' } }}
                tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div style={{ background: 'oklch(0.20 0.04 255)', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '4px', padding: '8px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.88 0.005 250)' }}>
                      <p>Engagement: {formatPct(d?.engagement ?? 0)}%</p>
                      <p>Valence: {formatPct(d?.valence ?? 0)}%</p>
                      {/* 感情名は色ドット＋明るい文字色にする（感情色のままだと暗背景で読めないため） */}
                      <p className="flex items-center gap-1.5" style={{ color: 'oklch(0.90 0.005 250)' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: d?.color || 'oklch(0.70 0.14 195)' }} />
                        {d?.emotion || 'N/A'}
                      </p>
                    </div>
                  );
                }}
              />
              <Scatter name="Frames" data={scatterData}>
                {scatterData.map((entry: any, i) => (
                  <Cell key={i} fill={entry.color || 'oklch(0.70 0.14 195)'} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Emotion Profile */}
        <div className="metric-card">
          <div className="section-label mb-3">EMOTION PROFILE</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
            特殊指標レベル別の感情プロファイル
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={profileData} margin={{ top: 5, right: 20, bottom: 20, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
              <XAxis dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
              <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
              <Tooltip
                formatter={(v: number) => [v.toFixed(2), '割合']}
                {...rechartsTooltip}
              />
              <Legend wrapperStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem' }} />
              <Bar dataKey="high" fill="oklch(0.68 0.26 22)" name="高レベル時" radius={[4, 4, 0, 0]} />
              <Bar dataKey="low" fill="oklch(0.70 0.14 195)" name="低レベル時" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Circumplex Model */}
        <div className="metric-card">
          <div className="section-label mb-3">CIRCUMPLEX MODEL</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
            Valence-Arousal 円環モデル
          </div>
          {/* 補正ON中: 円環モデルは絶対値スケール前提のため補正対象外であることを明示 */}
          <div className="mb-3"><AbsoluteScaleBadge /></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {circumplexData.map((item, i) => (
              <div key={i} className="p-3 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: `2px solid ${item.color}` }}>
                <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', color: 'oklch(0.75 0.008 250)', marginBottom: '4px', fontWeight: 600 }}>
                  {item.label}
                </div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 700, fontSize: '1.2rem', color: item.color, lineHeight: 1.2 }}>
                  {item.value.toLocaleString()}
                </div>
                <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.68 0.015 255)' }}>
                  フレーム — {item.desc}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 rounded" style={{ background: 'oklch(0.20 0.04 255)', border: '1px solid oklch(0.30 0.04 255)' }}>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.78 0.012 250)', lineHeight: 1.6 }}>
              <strong>解釈：</strong>最も多くのフレーム（{dominantQuadrant.value.toLocaleString()}フレーム・{dominantQuadrantPct}%）が「{dominantQuadrant.label}」象限に分類されました（{dominantQuadrant.desc}）。分割は固定中立点（Engagement=50／Valence=0）で行っています。
              {isBaselineActive && (
                <span style={{ display: 'block', marginTop: '0.5rem', color: 'oklch(0.82 0.15 70)' }}>
                  ※ ベースライン補正の表示中ですが、この象限分類は補正前の絶対値（Engagement／Valence の生値）に基づいています。
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Affect Dynamics */}
        {engDynamics && (
          <div className="metric-card">
            <div className="section-label mb-3">AFFECT DYNAMICS</div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
              特殊指標の動態指標
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: '変動性 (SD)', value: engDynamics.variability_sd.toFixed(4), desc: '特殊指標の変動幅' },
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
                  <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', color: 'oklch(0.68 0.015 255)', marginTop: '2px' }}>
                    {m.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
