/*
 * DESIGN: Neuro-Signal Interface
 * Action Units (FACS) analysis section
 */

import type { DashboardData } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { rechartsTooltip } from '@/lib/chartTooltip';
import { ArrowUpDown, ArrowLeftRight, RotateCcw } from 'lucide-react';

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

// 時刻を MM:SS 形式に変換
const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
};

const MOTION_CONFIG = {
  nod:   { label: 'うなづき', axis: 'Pitch（上下）', color: 'oklch(0.75 0.14 195)', Icon: ArrowUpDown },
  shake: { label: '首振り',   axis: 'Yaw（左右）',   color: 'oklch(0.82 0.18 80)',  Icon: ArrowLeftRight },
  tilt:  { label: '首傾げ',   axis: 'Roll（傾き）',  color: 'oklch(0.78 0.14 300)', Icon: RotateCcw },
} as const;

export default function ActionUnitsSection({ data }: Props) {
  const { action_unit_stats, head_pose_stats, head_motion_events } = data;

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

  const topActive = auData.filter(d => d.active_pct > 0).sort((a, b) => b.active_pct - a.active_pct);

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
        <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.88 0.005 250)' }}>
          アクションユニット分析
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.68 0.015 255)', marginTop: '0.25rem' }}>
          FACS（顔面動作符号化システム）に基づく表情筋活動の定量分析
        </p>
      </div>

      {/* AU Mean Values Chart */}
      <div className="metric-card">
        <div className="section-label mb-3">AU MEAN ACTIVATION</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          アクションユニット別平均活性化値
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={auData} margin={{ top: 5, right: 10, bottom: 60, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} angle={-45} textAnchor="end" />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
            <Tooltip
              formatter={(v: number, _: string, props: any) => [
                `${v.toFixed(4)} (最大: ${props.payload.max.toFixed(2)})`,
                props.payload.desc
              ]}
              {...rechartsTooltip}
            />
            <Bar dataKey="mean" radius={[4, 4, 0, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
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
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
          アクションユニット活性率（閾値5%超の割合）
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
          各AUが5%以上の活性化を示したフレームの割合
        </p>
        <ResponsiveContainer width="100%" height={Math.max(220, topActive.length * 28 + 20)}>
          <BarChart data={topActive} layout="vertical" margin={{ top: 5, right: 60, bottom: 5, left: 130 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" horizontal={false} />
            <XAxis type="number" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} unit="%" />
            <YAxis type="category" dataKey="desc" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fill: 'oklch(0.75 0.008 250)' }} width={125} />
            <Tooltip
              formatter={(v: number, _: string, props: any) => [`${v.toFixed(2)}%`, `${props.payload.label}: ${props.payload.desc}`]}
              {...rechartsTooltip}
            />
            <Bar dataKey="active_pct" radius={[0, 4, 4, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
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
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          アクションユニット詳細一覧
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '2px solid oklch(0.28 0.04 255)' }}>
                {['AU番号', '動作', '筋肉', '平均値', '最大値', '活性率'].map(h => (
                  <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auData.map((row, i) => {
                const info = AU_DESCRIPTIONS[row.name];
                return (
                  <tr key={i} style={{ borderBottom: '1px solid oklch(0.20 0.04 255)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'oklch(0.22 0.04 255)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded text-xs" style={{ background: getColor(row.mean) + '20', color: getColor(row.mean), fontFamily: 'Roboto Mono, monospace', fontWeight: 600 }}>
                        {info?.au || '—'}
                      </span>
                    </td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', color: 'oklch(0.88 0.005 250)' }}>
                      {info?.desc || row.name}
                    </td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)' }}>
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
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          頭部姿勢分析（Pitch / Yaw / Roll）
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {headPoseData.map((pose, i) => (
            <div key={i} className="p-4 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.22 0.04 255)' }}>
              <div className="section-label mb-2">{pose.name}</div>
              <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.88 0.005 250)', lineHeight: 1 }}>
                {pose.mean.toFixed(2)}°
              </div>
              <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.68 0.015 255)', marginTop: '4px' }}>
                平均値
              </div>
              <div className="mt-3 space-y-1">
                {[
                  { label: 'SD', value: pose.std.toFixed(2) + '°' },
                  { label: 'Min', value: pose.min.toFixed(2) + '°' },
                  { label: 'Max', value: pose.max.toFixed(2) + '°' },
                ].map((item, j) => (
                  <div key={j} className="flex justify-between">
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)' }}>{item.label}</span>
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.75 0.008 250)', fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded" style={{ background: 'oklch(0.95 0.005 250 / 0.5)', border: '1px solid oklch(0.88 0.008 250)' }}>
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.56 0.015 250)', lineHeight: 1.6 }}>
            <strong>解釈：</strong>Pitch（上下方向の傾き）の平均{headPoseData.find(p => p.key === 'pitch')?.mean.toFixed(2)}°は、わずかに下を向いた姿勢を示します。Yaw（左右方向）の平均{headPoseData.find(p => p.key === 'yaw')?.mean.toFixed(2)}°は正面からのわずかな左向きを示します。これらの値は自然な会話・視聴時の典型的な頭部姿勢の範囲内です。
          </p>
        </div>
      </div>

      {/* Head Motion Events */}
      <div className="metric-card">
        <div className="section-label mb-3">HEAD MOTION EVENTS</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
          頭部動作検知イベント
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
          明確なうなづき（Pitch ≥8°）・首振り（Yaw ≥12°）・首傾げ（Roll ≥15°）を検知した時刻一覧
        </p>

        {/* 凡例 */}
        <div className="flex gap-4 mb-4">
          {(Object.entries(MOTION_CONFIG) as [keyof typeof MOTION_CONFIG, typeof MOTION_CONFIG[keyof typeof MOTION_CONFIG]][]).map(([type, cfg]) => {
            const count = head_motion_events.filter(e => e.type === type).length;
            return (
              <div key={type} className="flex items-center gap-1.5">
                <cfg.Icon size={13} style={{ color: cfg.color }} />
                <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.75 0.008 250)' }}>
                  {cfg.label}
                </span>
                <span className="px-1.5 py-0.5 rounded-full" style={{ background: cfg.color + '22', color: cfg.color, fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fontWeight: 700 }}>
                  {count}回
                </span>
              </div>
            );
          })}
        </div>

        {head_motion_events.length === 0 ? (
          <div className="py-8 text-center" style={{ color: 'oklch(0.60 0.015 255)', fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.82rem' }}>
            明確な頭部動作は検知されませんでした
            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.55 0.01 255)', marginTop: '4px' }}>
              （CSV に pitch / yaw / roll 列がない場合も表示されません）
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '2px solid oklch(0.28 0.04 255)' }}>
                  {['動作', '開始時刻', '終了時刻', '持続時間', '変化量'].map(h => (
                    <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {head_motion_events.map((ev, i) => {
                  const cfg = MOTION_CONFIG[ev.type];
                  const duration = (ev.time_end - ev.time_start).toFixed(2);
                  return (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid oklch(0.20 0.04 255)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'oklch(0.22 0.04 255)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* 動作種別 */}
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1.5">
                          <cfg.Icon size={13} style={{ color: cfg.color, flexShrink: 0 }} />
                          <span className="px-2 py-0.5 rounded-full" style={{ background: cfg.color + '1a', color: cfg.color, fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {cfg.label}
                          </span>
                        </div>
                      </td>
                      {/* 開始時刻 */}
                      <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.88 0.005 250)' }}>
                        {formatTime(ev.time_start)}
                      </td>
                      {/* 終了時刻 */}
                      <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.72 0.008 250)' }}>
                        {formatTime(ev.time_end)}
                      </td>
                      {/* 持続時間 */}
                      <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.65 0.015 255)' }}>
                        {duration}s
                      </td>
                      {/* 変化量 */}
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(60, (ev.magnitude / 40) * 60)}px`,
                              background: cfg.color,
                              opacity: 0.7,
                            }}
                          />
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.75 0.008 250)', fontWeight: 600 }}>
                            {ev.magnitude}°
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
