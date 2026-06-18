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
import CardHeader from '@/components/ui/CardHeader';

interface Props {
  data: DashboardData;
}

export default function EngagementValenceSection({ data }: Props) {
  const { special_stats, engagement_distribution, engagement_correlations, engagement_emotion_profile, scatter_eng_val, affect_dynamics, valence_distribution, valence_correlations } = data;

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

  // 特殊指標（engagement/valence/attention）は EMOTION_LABELS_JA に無いため、
  // 相関グラフのY軸ラベルが英語のまま長く表示され見切れる。日本語の短い名前を補う。
  const SPECIAL_LABELS_JA: Record<string, string> = { engagement: '関与度', valence: '感情価', attention: '注視度' };
  const labelJa = (key: string) => EMOTION_LABELS_JA[key] || SPECIAL_LABELS_JA[key] || key;

  // neutral（無表情）は他タブ・学術相関行列・感情プロファイルと同様に除外し、9感情＋特殊指標に絞る
  const engCorrData = Object.entries(engagement_correlations)
    .filter(([k]) => k !== 'engagement' && k !== 'neutral')
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, val]) => ({
      name: labelJa(key),
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
    .filter(([k]) => k !== 'valence' && k !== 'neutral')
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, v]) => ({
      name: labelJa(key),
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
  const valDynamics = affect_dynamics.valence;
  // 散布図の各点に「表示用の色」と「支配的感情の日本語名」を付与する。
  // 生成側（scatter_eng_val）は dominant（感情キー）だけを持ち color/emotion が無いため、
  // 旧コードでは点が全て同色・ツールチップの感情が常に「N/A」になっていた。
  // 色は表示の関心事なのでここ（コンポーネント側）で dominant から引く。
  const scatterData = scatter_eng_val.slice(0, 1000).map(d => ({
    ...d,
    color: EMOTION_COLORS[d.dominant] || 'oklch(0.70 0.14 195)',
    emotion: EMOTION_LABELS_JA[d.dominant] || d.dominant,
  }));

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

        {/* Affect Dynamics（Valence）— レベル分布の上に配置。Engagement の動態指標と対になる読み出し */}
        {valDynamics && (
          <div className="metric-card">
            <CardHeader
              label="AFFECT DYNAMICS"
              title="Valence の動態指標"
              info="Valence（感情価）の時間的な動きを5つの指標で示します。変動性(SD)=揺れ幅、不安定性(MSSD)=連続変化の激しさ、慣性(AR1)=状態の持続性、レンジ=最大−最小、平均絶対変化量=1フレームあたりの平均変化量。なお SD・MSSD・AR1 は学術的分析タブの動態指標カード（全指標の比較）にも valence として含まれます。"
            />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: '変動性 (SD)', value: valDynamics.variability_sd.toFixed(4), desc: '特殊指標の変動幅' },
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

        {/* Valence Distribution + Correlation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Valence Distribution */}
          <div className="metric-card">
            <CardHeader
              label="VALENCE DISTRIBUTION"
              title="Valence レベル分布"
              info="Valence（感情価・−100〜+100）を測定範囲で5区間に等分し、各区間のフレーム数を示します。ネガティブ寄り・ポジティブ寄りの偏りを把握できます（区間の境界はデータの最小〜最大から自動算出）。"
            />
            <ResponsiveContainer width="100%" height={300}>
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
            <CardHeader
              label="VALENCE CORRELATIONS"
              title="Valence と各指標の相関"
              info="Valence（感情価）と各感情・指標のピアソン相関係数（−1〜+1）です。+1に近いほど Valence と同時に増減し、−1に近いほど逆方向に動きます（0は無関係）。どの感情が感情価と連動するかを把握できます。"
            />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={valCorrData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" horizontal={false} />
                <XAxis type="number" domain={[-1, 1]} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
                <YAxis type="category" dataKey="name" interval={0} tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.75 0.008 250)' }} width={64} />
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

        {/* ===== Engagement（関与度）ブロック ===== */}
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'oklch(0.78 0.16 80)', borderLeft: '3px solid oklch(0.72 0.18 80)', paddingLeft: '0.6rem', marginTop: '0.5rem' }}>
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

        {/* Affect Dynamics（Engagement）— レベル分布の上に配置 */}
        {engDynamics && (
          <div className="metric-card">
            <CardHeader
              label="AFFECT DYNAMICS"
              title="Engagement の動態指標"
              info="Engagement（関与度）の時間的な動きを5つの指標で示します。変動性(SD)=揺れ幅、不安定性(MSSD)=連続変化の激しさ、慣性(AR1)=状態の持続性、レンジ=最大−最小、平均絶対変化量=1フレームあたりの平均変化量。"
            />
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

        {/* Distribution + Correlation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribution */}
          <div className="metric-card">
            <CardHeader
              label="ENGAGEMENT DISTRIBUTION"
              title="Engagement レベル分布"
              info="Engagement（関与度・0〜100）を5段階（非常に低い〜非常に高い）に区切り、各レベルに該当したフレーム数を示します。関与度の高低の偏りを把握できます。"
            />
            <ResponsiveContainer width="100%" height={300}>
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
            <CardHeader
              label="ENGAGEMENT CORRELATIONS"
              title="Engagement と各指標の相関"
              info="Engagement（関与度）と各感情・指標のピアソン相関係数（−1〜+1）です。+1に近いほど Engagement と同時に増減し、−1に近いほど逆方向に動きます（0は無関係）。どの感情が関与度と連動するかを把握できます。"
            />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={engCorrData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" horizontal={false} />
                <XAxis type="number" domain={[-1, 1]} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
                <YAxis type="category" dataKey="name" interval={0} tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.75 0.008 250)' }} width={64} />
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

        {/* Emotion Profile */}
        <div className="metric-card">
          <CardHeader
            label="EMOTION PROFILE"
            title="Engagement レベル別の感情プロファイル"
            info="Engagement が高いとき（50以上）と低いとき（50未満）で、各感情の平均スコアがどう違うかを比較します。関与度が高い場面でどんな感情が伴いやすいかを把握できます。"
          />
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

        {/* Circumplex Model は学術的分析タブに集約したため、特殊指標タブからは削除 */}

        {/* Engagement vs Valence Scatter — 一番下に配置 */}
        <div className="metric-card">
          <CardHeader
            label="ENGAGEMENT × VALENCE"
            title="Engagement × Valence 散布図"
            info="横軸=Valence（感情価）、縦軸=Engagement（関与度）で各フレームを1点として配置します。点の色はそのフレームの支配的感情（最もスコアが高い感情）。右上ほど『関与が高くポジティブ』です。性能のため先頭約1000点を表示。点にカーソルを乗せると経過時間・各値・感情が出ます。"
          />
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
                      {/* 経過時間（録画開始=0秒からの相対秒）。scatter_eng_val の time をそのまま表示 */}
                      <p style={{ color: 'oklch(0.70 0.012 250)' }}>経過時間: {(d?.time ?? 0).toFixed(1)}s</p>
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
      </div>
    </div>
  );
}
