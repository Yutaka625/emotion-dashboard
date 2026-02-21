/*
 * DESIGN: Neuro-Signal Interface
 * Action Units (FACS) analysis section
 */

import type { DashboardData } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface Props {
  data: DashboardData;
}

const AU_DESCRIPTIONS: Record<string, { au: string; muscle: string; desc: string }> = {
  'inner brow raise': { au: 'AU1', muscle: '前頭筋（内側）', desc: '内眉を上げる' },
  'brow raise': { au: 'AU2', muscle: '前頭筋（外側）', desc: '外眉を上げる' },
  'brow furrow': { au: 'AU4', muscle: '皺眉筋', desc: '眉をひそめる' },
  'eye widen': { au: 'AU5', muscle: '上眼瞼挙筋', desc: '目を見開く' },
  'cheek raise': { au: 'AU6', muscle: '眼輪筋（眼窩部）', desc: '頬を上げる' },
  'lid tighten': { au: 'AU7', muscle: '眼輪筋（眼瞼部）', desc: '目を細める' },
  'nose wrinkle': { au: 'AU9', muscle: '鼻根筋', desc: '鼻にしわを寄せる' },
  'upper lip raise': { au: 'AU10', muscle: '上唇挙筋', desc: '上唇を上げる' },
  'dimpler': { au: 'AU14', muscle: '頬骨筋', desc: 'えくぼを作る' },
  'lip corner depressor': { au: 'AU15', muscle: '口角下制筋', desc: '口角を下げる' },
  'chin raise': { au: 'AU17', muscle: '頤筋', desc: '顎を上げる' },
  'lip pucker': { au: 'AU18', muscle: '口輪筋', desc: '唇をすぼめる' },
  'lip stretch': { au: 'AU20', muscle: '笑筋', desc: '唇を横に引く' },
  'lip press': { au: 'AU23', muscle: '口輪筋', desc: '唇を押しつける' },
  'mouth open': { au: 'AU25', muscle: '下唇下制筋', desc: '口を開ける' },
  'jaw drop': { au: 'AU26', muscle: '咬筋', desc: '顎を落とす' },
  'lip suck': { au: 'AU28', muscle: '口輪筋', desc: '唇を吸う' },
  'eye closure': { au: 'AU43', muscle: '眼輪筋', desc: '目を閉じる' },
  'smile': { au: 'AU12', muscle: '大頬骨筋', desc: '微笑む（口角を上げる）' },
  'smirk': { au: 'AU14R', muscle: '頬骨筋（片側）', desc: '片側だけ微笑む' },
  'blink': { au: 'AU46', muscle: '眼輪筋', desc: '瞬き' },
  'blink rate': { au: 'AU46R', muscle: '—', desc: '瞬き頻度（回/分）' },
};

export default function ActionUnitsSection({ data }: Props) {
  const { action_unit_stats, head_pose_stats } = data;

  const auData = Object.entries(action_unit_stats)
    .map(([key, stats]) => ({
      name: key,
      label: AU_DESCRIPTIONS[key]?.au || key,
      desc: AU_DESCRIPTIONS[key]?.desc || key,
      mean: stats.mean,
      max: stats.max,
      active_pct: stats.active_pct,
    }))
    .sort((a, b) => b.mean - a.mean);

  const topActive = auData.filter(d => d.active_pct > 0).sort((a, b) => b.active_pct - a.active_pct).slice(0, 10);

  const headPoseData = Object.entries(head_pose_stats).map(([key, stats]) => ({
    name: key === 'pitch' ? 'Pitch（上下）' : key === 'yaw' ? 'Yaw（左右）' : 'Roll（傾き）',
    key,
    mean: stats.mean,
    std: stats.std,
    min: stats.min,
    max: stats.max,
  }));

  const getColor = (mean: number) => {
    if (mean > 20) return 'oklch(0.62 0.18 25)';
    if (mean > 10) return 'oklch(0.72 0.18 80)';
    if (mean > 5) return 'oklch(0.62 0.18 160)';
    return 'oklch(0.62 0.12 250)';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-label mb-1">ACTION UNITS ANALYSIS</div>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.15 0.02 250)' }}>
          アクションユニット分析
        </h2>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'oklch(0.52 0.015 250)', marginTop: '0.25rem' }}>
          FACS（顔面動作符号化システム）に基づく表情筋活動の定量分析
        </p>
      </div>

      {/* AU Mean Values Chart */}
      <div className="metric-card">
        <div className="section-label mb-3">AU MEAN ACTIVATION</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '1rem' }}>
          アクションユニット別平均活性化値
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={auData} margin={{ top: 5, right: 10, bottom: 60, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.52 0.015 250)' }} angle={-45} textAnchor="end" />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }} />
            <Tooltip
              formatter={(v: number, _: string, props: any) => [
                `${v.toFixed(4)} (最大: ${props.payload.max.toFixed(2)})`,
                props.payload.desc
              ]}
              contentStyle={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.88 0.008 80)', borderRadius: '6px' }}
            />
            <Bar dataKey="mean" radius={[4, 4, 0, 0]}>
              {auData.map((entry, i) => (
                <Cell key={i} fill={getColor(entry.mean)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Active AU Percentage */}
      <div className="metric-card">
        <div className="section-label mb-3">AU ACTIVITY RATE</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '0.5rem' }}>
          アクションユニット活性率（閾値5%超の割合）
        </div>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', color: 'oklch(0.52 0.015 250)', marginBottom: '1rem' }}>
          各AUが5%以上の活性化を示したフレームの割合
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={topActive} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" horizontal={false} />
            <XAxis type="number" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }} unit="%" />
            <YAxis type="category" dataKey="desc" tick={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.68rem', fill: 'oklch(0.35 0.015 250)' }} width={75} />
            <Tooltip
              formatter={(v: number, _: string, props: any) => [`${v.toFixed(2)}%`, `${props.payload.label}: ${props.payload.desc}`]}
              contentStyle={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.88 0.008 80)', borderRadius: '6px' }}
            />
            <Bar dataKey="active_pct" radius={[0, 4, 4, 0]}>
              {topActive.map((entry, i) => (
                <Cell key={i} fill={getColor(entry.mean)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* AU Details Table */}
      <div className="metric-card">
        <div className="section-label mb-3">AU REFERENCE TABLE</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '1rem' }}>
          アクションユニット詳細一覧
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '2px solid oklch(0.88 0.008 80)' }}>
                {['AU番号', '動作', '筋肉', '平均値', '最大値', '活性率'].map(h => (
                  <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.52 0.015 250)', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auData.map((row, i) => {
                const info = AU_DESCRIPTIONS[row.name];
                return (
                  <tr key={i} style={{ borderBottom: '1px solid oklch(0.94 0.003 80)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'oklch(0.97 0.003 80)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded text-xs" style={{ background: getColor(row.mean) + '20', color: getColor(row.mean), fontFamily: 'Roboto Mono, monospace', fontWeight: 600 }}>
                        {info?.au || '—'}
                      </span>
                    </td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem', color: 'oklch(0.25 0.02 250)' }}>
                      {info?.desc || row.name}
                    </td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'oklch(0.52 0.015 250)' }}>
                      {info?.muscle || '—'}
                    </td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>
                      {row.mean.toFixed(4)}
                    </td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>
                      {row.max.toFixed(2)}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(60, row.active_pct)}px`, background: getColor(row.mean) }} />
                        <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>
                          {row.active_pct.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Head Pose */}
      <div className="metric-card">
        <div className="section-label mb-3">HEAD POSE ANALYSIS</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '1rem' }}>
          頭部姿勢分析（Pitch / Yaw / Roll）
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {headPoseData.map((pose, i) => (
            <div key={i} className="p-4 rounded-lg" style={{ background: 'oklch(0.97 0.003 80)', border: '1px solid oklch(0.92 0.004 80)' }}>
              <div className="section-label mb-2">{pose.name}</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.25 0.02 250)', lineHeight: 1 }}>
                {pose.mean.toFixed(2)}°
              </div>
              <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.52 0.015 250)', marginTop: '4px' }}>
                平均値
              </div>
              <div className="mt-3 space-y-1">
                {[
                  { label: 'SD', value: pose.std.toFixed(2) + '°' },
                  { label: 'Min', value: pose.min.toFixed(2) + '°' },
                  { label: 'Max', value: pose.max.toFixed(2) + '°' },
                ].map((item, j) => (
                  <div key={j} className="flex justify-between">
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.52 0.015 250)' }}>{item.label}</span>
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.35 0.015 250)', fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded" style={{ background: 'oklch(0.95 0.005 250 / 0.5)', border: '1px solid oklch(0.88 0.008 250)' }}>
          <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', color: 'oklch(0.42 0.015 250)', lineHeight: 1.6 }}>
            <strong>解釈：</strong>Pitch（上下方向の傾き）の平均{headPoseData.find(p => p.key === 'pitch')?.mean.toFixed(2)}°は、わずかに下を向いた姿勢を示します。Yaw（左右方向）の平均{headPoseData.find(p => p.key === 'yaw')?.mean.toFixed(2)}°は正面からのわずかな左向きを示します。これらの値は自然な会話・視聴時の典型的な頭部姿勢の範囲内です。
          </p>
        </div>
      </div>
    </div>
  );
}
