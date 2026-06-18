/*
 * DESIGN: Neuro-Signal Interface
 * Emotion transition analysis
 */
import { useMemo } from 'react';

import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { rechartsTooltip } from '@/lib/chartTooltip';
import CardHeader from '@/components/ui/CardHeader';

interface Props {
  data: DashboardData;
}

function extractOklchHue(color: string): string {
  const m = color.match(/oklch\([\d.]+\s+[\d.]+\s+([\d.]+)/);
  return m ? m[1] : '255';
}

export default function TransitionsSection({ data }: Props) {
  const { emotion_transitions, emotion_duration_stats, dominant_emotion_pct, time_summary_10s, timeseries_full } = data;

  // 遷移行列の最大値を計算
  const allValues = Object.values(emotion_transitions).flatMap(row => Object.values(row));
  const maxVal = Math.max(...allValues);

  // ---- 感情ヒートマップデータ（time_summary_10s を使用、最大40ビン） ----
  const heatmapBins = useMemo(() => {
    if (time_summary_10s.length <= 40) return time_summary_10s;
    // 40超ならtimeseries_fullから20ビンに再集計
    const n = timeseries_full.length;
    const binCount = 20;
    const binSize = Math.ceil(n / binCount);
    return Array.from({ length: binCount }, (_, bi) => {
      const slice = timeseries_full.slice(bi * binSize, (bi + 1) * binSize);
      if (slice.length === 0) return null;
      const entry: Record<string, number> = {
        time_start: slice[0].time - timeseries_full[0].time,
        time_end: slice[slice.length - 1].time - timeseries_full[0].time,
      };
      for (const e of NON_NEUTRAL_EMOTIONS) {
        const vals = slice.map(f => (f as any)[e] as number ?? 0);
        entry[`${e}_mean`] = vals.reduce((a, b) => a + b, 0) / vals.length;
      }
      return entry;
    }).filter(Boolean) as typeof time_summary_10s;
  }, [time_summary_10s, timeseries_full]);

  // 各感情の全ビン最大値（正規化用）
  const heatmapMaxPerEmotion = useMemo(() => {
    const maxMap: Record<string, number> = {};
    for (const e of NON_NEUTRAL_EMOTIONS) {
      maxMap[e] = Math.max(0.001, ...heatmapBins.map(b => ((b as any)[`${e}_mean`] ?? 0) as number));
    }
    return maxMap;
  }, [heatmapBins]);


  // 持続時間データ
  const durationData = NON_NEUTRAL_EMOTIONS
    .filter(e => emotion_duration_stats[e]?.count > 0)
    .map(e => ({
      name: EMOTION_LABELS_JA[e] || e,
      count: emotion_duration_stats[e]?.count || 0,
      mean_duration: emotion_duration_stats[e]?.mean_duration || 0,
      max_duration: emotion_duration_stats[e]?.max_duration || 0,
      total_duration: emotion_duration_stats[e]?.total_duration || 0,
      color: EMOTION_COLORS[e] || '#999',
    }))
    .sort((a, b) => b.total_duration - a.total_duration);

  // 主要な遷移パターン（上位10件）
  const topTransitions: { from: string; to: string; count: number }[] = [];
  for (const [from, toMap] of Object.entries(emotion_transitions)) {
    for (const [to, count] of Object.entries(toMap)) {
      if (from !== to && count > 0) {
        topTransitions.push({ from, to, count });
      }
    }
  }
  topTransitions.sort((a, b) => b.count - a.count);
  const top10 = topTransitions.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-label mb-1">EMOTION TRANSITIONS</div>
        <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.88 0.005 250)' }}>
          感情遷移分析
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.68 0.015 255)', marginTop: '0.25rem' }}>
          感情状態間の遷移パターンと持続時間の分析
        </p>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Panel 2: 感情ヒートマップ
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="metric-card">
        <CardHeader
          label="EMOTION HEATMAP"
          title="感情強度ヒートマップ（時間 × 感情）"
          info="横軸=時間、縦軸=感情種別のマス目で、各時間帯にどの感情がどれだけ強く出たかを色の明るさで示します。明るいマスほど感情強度が高く、時間に沿った感情の盛り上がりを把握できます。"
        />

        {/* グリッド本体 */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${Math.max(400, heatmapBins.length * 18)}px` }}>
            {NON_NEUTRAL_EMOTIONS.map(emotion => {
              const hue = extractOklchHue(EMOTION_COLORS[emotion] ?? 'oklch(0.62 0.18 255)');
              const maxVal = heatmapMaxPerEmotion[emotion];
              return (
                <div key={emotion} className="flex items-center gap-1 mb-0.5">
                  {/* 感情ラベル */}
                  <div
                    style={{
                      fontFamily: 'Noto Sans JP, sans-serif',
                      fontSize: '0.65rem',
                      color: EMOTION_COLORS[emotion],
                      width: '56px',
                      flexShrink: 0,
                      textAlign: 'right',
                    }}
                  >
                    {EMOTION_LABELS_JA[emotion]}
                  </div>
                  {/* セル列 */}
                  <div className="flex gap-px flex-1">
                    {heatmapBins.map((bin, bi) => {
                      const val = ((bin as any)[`${emotion}_mean`] ?? 0) as number;
                      const intensity = val / maxVal; // 0〜1
                      const opacity = 0.08 + intensity * 0.88; // 最小 0.08 で常に見える
                      return (
                        <div
                          key={bi}
                          className="flex-1 rounded-sm group relative"
                          style={{
                            height: '22px',
                            background: `oklch(0.62 0.18 ${hue} / ${opacity.toFixed(2)})`,
                            cursor: 'default',
                          }}
                          title={`${EMOTION_LABELS_JA[emotion]} @ ${Math.round((bin as any).time_start ?? 0)}s — 強度: ${(val * 100).toFixed(1)}%`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {/* X軸ラベル */}
            <div className="flex items-center gap-1 mt-1">
              <div style={{ width: '56px', flexShrink: 0 }} />
              <div className="flex gap-px flex-1">
                {heatmapBins.filter((_, i) => i % Math.max(1, Math.floor(heatmapBins.length / 8)) === 0).map((bin, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: 'Roboto Mono, monospace',
                      fontSize: '0.55rem',
                      color: 'oklch(0.58 0.01 255)',
                      flex: Math.max(1, Math.floor(heatmapBins.length / 8)),
                    }}
                  >
                    {Math.round((bin as any).time_start ?? 0)}s
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 凡例 */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {NON_NEUTRAL_EMOTIONS.map(e => (
            <div key={e} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: EMOTION_COLORS[e] }} />
              <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', color: 'oklch(0.60 0.01 255)' }}>
                {EMOTION_LABELS_JA[e]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Transition Matrix + Top Transitions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Transition Matrix */}
      <div className="metric-card">
        <CardHeader
          label="TRANSITION MATRIX"
          title="感情遷移行列"
          info="支配的感情が「どの感情から、どの感情へ」変化したかの回数を行列で示します。行＝遷移元、列＝遷移先で、セルの色が濃いほどその遷移が多く起きたことを表します。"
        />
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="w-16 pb-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)' }}>
                  FROM↓ TO→
                </th>
                {NON_NEUTRAL_EMOTIONS.map(e => (
                  <th key={e} className="pb-2 px-1 text-center" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', color: EMOTION_COLORS[e], minWidth: '52px' }}>
                    {EMOTION_LABELS_JA[e]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NON_NEUTRAL_EMOTIONS.map(fromE => (
                <tr key={fromE}>
                  <td className="py-1 pr-2" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', color: EMOTION_COLORS[fromE], fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {EMOTION_LABELS_JA[fromE]}
                  </td>
                  {NON_NEUTRAL_EMOTIONS.map(toE => {
                    const count = emotion_transitions[fromE]?.[toE] || 0;
                    const intensity = maxVal > 0 ? count / maxVal : 0;
                    const isDiag = fromE === toE;
                    // 知覚的に均等な色変化のため、強度の平方根でスケール（低値の差を視認しやすくする）
                    const scaledIntensity = Math.pow(intensity, 0.5);
                    // 明度を暗（0.22）→明（0.72）で補間し、彩度も同時に変化させる
                    const L = 0.22 + scaledIntensity * 0.50;
                    const C = 0.02 + scaledIntensity * 0.20;
                    return (
                      <td key={toE} className="py-1 px-1 text-center" title={`${EMOTION_LABELS_JA[fromE]} → ${EMOTION_LABELS_JA[toE]}: ${count}回`}>
                        <div
                          className="w-12 h-8 rounded flex items-center justify-center mx-auto"
                          style={{
                            background: isDiag
                              ? 'oklch(0.22 0.04 255)'
                              : count > 0
                                ? `oklch(${L.toFixed(2)} ${C.toFixed(2)} 160)`
                                : 'oklch(0.19 0.01 255)',
                            border: isDiag
                              ? '1px dashed oklch(0.55 0.01 255)'
                              : count > 0
                                ? `1px solid oklch(${(L + 0.08).toFixed(2)} ${C.toFixed(2)} 160 / 0.6)`
                                : '1px solid oklch(0.25 0.02 255)',
                          }}
                        >
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: scaledIntensity > 0.45 ? 'oklch(0.98 0.005 250)' : 'oklch(0.64 0.015 250)', fontWeight: count > 0 ? 600 : 400 }}>
                            {isDiag ? '—' : count > 0 ? count : '·'}
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

      {/* Top Transitions */}
      <div className="metric-card">
        <CardHeader
          label="TOP TRANSITIONS"
          title="主要な感情遷移パターン（上位10件）"
          info="最も多く起きた『感情→感情』の遷移を回数の多い順に上位10件並べます。セッション中に頻繁に繰り返された感情の移り変わりを把握できます。"
        />
        <div className="space-y-2">
          {top10.map((t, i) => (
            <div key={i} className="flex items-center gap-3">
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', width: '20px' }}>
                #{i + 1}
              </span>
              <span className="px-2 py-0.5 rounded text-xs" style={{ background: EMOTION_COLORS[t.from] + '20', color: EMOTION_COLORS[t.from], fontFamily: 'Noto Sans JP, sans-serif', minWidth: '60px', textAlign: 'center' }}>
                {EMOTION_LABELS_JA[t.from]}
              </span>
              <span style={{ color: 'oklch(0.68 0.015 255)', fontSize: '0.8rem' }}>→</span>
              <span className="px-2 py-0.5 rounded text-xs" style={{ background: EMOTION_COLORS[t.to] + '20', color: EMOTION_COLORS[t.to], fontFamily: 'Noto Sans JP, sans-serif', minWidth: '60px', textAlign: 'center' }}>
                {EMOTION_LABELS_JA[t.to]}
              </span>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: 'oklch(0.22 0.04 255)' }}>
                <div className="h-full rounded-full" style={{ width: `${(t.count / top10[0].count) * 100}%`, background: 'oklch(0.62 0.18 160)' }} />
              </div>
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'oklch(0.75 0.008 250)', width: '40px', textAlign: 'right' }}>
                {t.count}回
              </span>
            </div>
          ))}
        </div>
      </div>
      </div>{/* end grid: TRANSITION MATRIX + TOP TRANSITIONS */}

      {/* Duration Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card">
          <CardHeader
            label="DURATION ANALYSIS"
            title="感情状態の平均持続時間"
            info="各感情が支配的だった『ひと続きの区間』が平均で何秒続いたかを示します。値が大きいほど、その感情が一度出ると長く続きやすいことを表します。"
          />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={durationData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 55 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" horizontal={false} />
              <XAxis type="number" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} unit="s" />
              <YAxis type="category" dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.75 0.008 250)' }} width={50} />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(3)}秒`, '平均持続時間']}
                {...rechartsTooltip}
              />
              <Bar dataKey="mean_duration" radius={[0, 4, 4, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
                {durationData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card">
          <CardHeader
            label="TOTAL DURATION"
            title="感情状態の累積時間"
            info="各感情が支配的だった時間の合計（秒）です。セッション全体を通して、どの感情が長く占めていたかを把握できます。"
          />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={durationData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 55 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" horizontal={false} />
              <XAxis type="number" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} unit="s" />
              <YAxis type="category" dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.75 0.008 250)' }} width={50} />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(2)}秒`, '累積時間']}
                {...rechartsTooltip}
              />
              <Bar dataKey="total_duration" radius={[0, 4, 4, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
                {durationData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} opacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Duration Stats Table */}
      <div className="metric-card">
        <CardHeader
          label="DURATION STATISTICS"
          title="感情持続時間の詳細統計"
          info="各感情について、出現回数・平均持続時間・最大持続時間・累積時間・支配的割合を表でまとめたものです。持続のパターンを数値で詳しく確認できます。"
        />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '2px solid oklch(0.28 0.04 255)' }}>
                {['感情', '出現回数', '平均持続時間', '最大持続時間', '累積時間', '支配的割合'].map(h => (
                  <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {durationData.map((row, i) => {
                const key = NON_NEUTRAL_EMOTIONS.find(e => EMOTION_LABELS_JA[e] === row.name) || '';
                return (
                  <tr key={i} className="row-hover" style={{ borderBottom: '1px solid oklch(0.20 0.04 255)' }}>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                        <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 500, fontSize: '0.8rem', color: 'oklch(0.88 0.005 250)' }}>
                          {row.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>{row.count}</td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>{row.mean_duration.toFixed(3)}s</td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>{row.max_duration.toFixed(3)}s</td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>{row.total_duration.toFixed(2)}s</td>
                    <td className="py-2 pr-4">
                      <span className="status-pill px-2 py-0.5 rounded-full text-xs" style={{ background: row.color + '20', color: row.color, fontFamily: 'Roboto Mono, monospace' }}>
                        {(dominant_emotion_pct[key] || 0).toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
