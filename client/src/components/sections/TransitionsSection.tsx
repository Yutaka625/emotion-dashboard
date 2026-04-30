/*
 * DESIGN: Neuro-Signal Interface
 * Emotion transition analysis
 */

import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface Props {
  data: DashboardData;
}

export default function TransitionsSection({ data }: Props) {
  const { emotion_transitions, emotion_duration_stats, dominant_emotion_pct } = data;

  // 遷移行列の最大値を計算
  const allValues = Object.values(emotion_transitions).flatMap(row => Object.values(row));
  const maxVal = Math.max(...allValues);

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
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.58 0.015 255)', marginTop: '0.25rem' }}>
          感情状態間の遷移パターンと持続時間の分析
        </p>
      </div>

      {/* Transition Matrix + Top Transitions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Transition Matrix */}
      <div className="metric-card">
        <div className="section-label mb-3">TRANSITION MATRIX</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
          感情遷移行列
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.58 0.015 255)', marginBottom: '1rem' }}>
          行：遷移元の感情、列：遷移先の感情。セルの色の濃さは遷移頻度を示します。
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="w-16 pb-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)' }}>
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
                    return (
                      <td key={toE} className="py-1 px-1 text-center" title={`${EMOTION_LABELS_JA[fromE]} → ${EMOTION_LABELS_JA[toE]}: ${count}回`}>
                        <div
                          className="w-12 h-8 rounded flex items-center justify-center mx-auto"
                          style={{
                            background: isDiag
                              ? 'oklch(0.22 0.04 255)'
                              : count > 0
                                ? `oklch(0.62 0.18 160 / ${Math.max(0.05, intensity)})`
                                : 'oklch(0.97 0.002 80)',
                            border: isDiag ? '1px dashed oklch(0.85 0.005 80)' : '1px solid oklch(0.22 0.04 255)',
                          }}
                        >
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: intensity > 0.5 ? 'white' : 'oklch(0.45 0.015 250)', fontWeight: count > 0 ? 600 : 400 }}>
                            {isDiag ? '—' : count > 0 ? count : '0'}
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
        <div className="section-label mb-3">TOP TRANSITIONS</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          主要な感情遷移パターン（上位10件）
        </div>
        <div className="space-y-2">
          {top10.map((t, i) => (
            <div key={i} className="flex items-center gap-3">
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.58 0.015 255)', width: '20px' }}>
                #{i + 1}
              </span>
              <span className="px-2 py-0.5 rounded text-xs" style={{ background: EMOTION_COLORS[t.from] + '20', color: EMOTION_COLORS[t.from], fontFamily: 'Noto Sans JP, sans-serif', minWidth: '60px', textAlign: 'center' }}>
                {EMOTION_LABELS_JA[t.from]}
              </span>
              <span style={{ color: 'oklch(0.58 0.015 255)', fontSize: '0.8rem' }}>→</span>
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
          <div className="section-label mb-3">DURATION ANALYSIS</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
            感情状態の平均持続時間
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={durationData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 55 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" horizontal={false} />
              <XAxis type="number" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }} unit="s" />
              <YAxis type="category" dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.75 0.008 250)' }} width={50} />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(3)}秒`, '平均持続時間']}
                contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
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
          <div className="section-label mb-3">TOTAL DURATION</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
            感情状態の累積時間
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={durationData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 55 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" horizontal={false} />
              <XAxis type="number" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.58 0.015 255)' }} unit="s" />
              <YAxis type="category" dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.75 0.008 250)' }} width={50} />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(2)}秒`, '累積時間']}
                contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
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
        <div className="section-label mb-3">DURATION STATISTICS</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          感情持続時間の詳細統計
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '2px solid oklch(0.28 0.04 255)' }}>
                {['感情', '出現回数', '平均持続時間', '最大持続時間', '累積時間', '支配的割合'].map(h => (
                  <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.58 0.015 255)', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {durationData.map((row, i) => {
                const key = NON_NEUTRAL_EMOTIONS.find(e => EMOTION_LABELS_JA[e] === row.name) || '';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid oklch(0.20 0.04 255)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'oklch(0.22 0.04 255)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
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
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: row.color + '20', color: row.color, fontFamily: 'Roboto Mono, monospace' }}>
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
