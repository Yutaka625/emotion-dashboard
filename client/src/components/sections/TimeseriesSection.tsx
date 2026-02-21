/*
 * DESIGN: Neuro-Signal Interface
 * Time series visualization with signal wave aesthetic
 */

import { useState, useMemo } from 'react';
import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Area, AreaChart, ComposedChart, Bar,
} from 'recharts';

interface Props {
  data: DashboardData;
}

const SPECIAL_COLORS = {
  engagement: 'oklch(0.72 0.18 80)',
  valence: 'oklch(0.62 0.18 25)',
  attention: 'oklch(0.55 0.18 300)',
};

export default function TimeseriesSection({ data }: Props) {
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(['confusion', 'sadness', 'fear']);
  const [showSpecial, setShowSpecial] = useState<string[]>(['engagement', 'valence']);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 280]);

  const { timeseries_full, time_summary_10s } = data;

  // サンプリング（表示用に間引き）
  const sampledData = useMemo(() => {
    const filtered = timeseries_full.filter(
      d => d.time >= timeRange[0] && d.time <= timeRange[1]
    );
    // 最大500点に間引き
    const step = Math.max(1, Math.floor(filtered.length / 500));
    return filtered.filter((_, i) => i % step === 0);
  }, [timeseries_full, timeRange]);

  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions(prev =>
      prev.includes(emotion) ? prev.filter(e => e !== emotion) : [...prev, emotion]
    );
  };

  const toggleSpecial = (key: string) => {
    setShowSpecial(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const formatTime = (t: number) => `${t.toFixed(0)}s`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="p-3 rounded-lg shadow-lg" style={{ background: 'oklch(0.15 0.02 250)', border: '1px solid oklch(0.25 0.02 250)', maxWidth: '200px' }}>
        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.62 0.18 160)', marginBottom: '6px' }}>
          t = {Number(label).toFixed(2)}s
        </div>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'oklch(0.75 0.005 80)' }}>
              {p.name}: <span style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 600 }}>{Number(p.value).toFixed(2)}</span>
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-label mb-1">TIME SERIES ANALYSIS</div>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.15 0.02 250)' }}>
          時系列分析
        </h2>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'oklch(0.52 0.015 250)', marginTop: '0.25rem' }}>
          感情スコアおよびEngagement・Valence・Attentionの時間推移
        </p>
      </div>

      {/* Time Range Selector */}
      <div className="metric-card">
        <div className="section-label mb-2">TIME RANGE</div>
        <div className="flex items-center gap-4">
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.45 0.015 250)' }}>
            {timeRange[0].toFixed(0)}s
          </span>
          <input
            type="range" min={0} max={280} step={10}
            value={timeRange[0]}
            onChange={e => setTimeRange([Number(e.target.value), timeRange[1]])}
            className="flex-1"
          />
          <input
            type="range" min={0} max={280} step={10}
            value={timeRange[1]}
            onChange={e => setTimeRange([timeRange[0], Number(e.target.value)])}
            className="flex-1"
          />
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.45 0.015 250)' }}>
            {timeRange[1].toFixed(0)}s
          </span>
        </div>
        <div className="flex gap-2 mt-2">
          {[[0, 280], [0, 60], [60, 120], [120, 180], [180, 280]].map(([s, e]) => (
            <button
              key={`${s}-${e}`}
              onClick={() => setTimeRange([s, e])}
              className="px-2 py-1 rounded text-xs transition-colors"
              style={{
                fontFamily: 'Roboto Mono, monospace',
                background: timeRange[0] === s && timeRange[1] === e ? 'oklch(0.32 0.08 160)' : 'oklch(0.95 0.003 80)',
                color: timeRange[0] === s && timeRange[1] === e ? 'white' : 'oklch(0.45 0.015 250)',
                border: '1px solid oklch(0.88 0.008 80)',
              }}
            >
              {s === 0 && e === 280 ? '全体' : `${s}s-${e}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Special Metrics Chart */}
      <div className="metric-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="section-label mb-1">SPECIAL METRICS</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)' }}>
              Engagement / Valence / Attention
            </div>
          </div>
          <div className="flex gap-2">
            {(['engagement', 'valence', 'attention'] as const).map(key => (
              <button
                key={key}
                onClick={() => toggleSpecial(key)}
                className="px-3 py-1 rounded-full text-xs transition-all"
                style={{
                  fontFamily: 'Roboto Mono, monospace',
                  background: showSpecial.includes(key) ? SPECIAL_COLORS[key] : 'oklch(0.95 0.003 80)',
                  color: showSpecial.includes(key) ? 'white' : 'oklch(0.45 0.015 250)',
                  border: `1px solid ${showSpecial.includes(key) ? SPECIAL_COLORS[key] : 'oklch(0.88 0.008 80)'}`,
                  opacity: showSpecial.includes(key) ? 1 : 0.6,
                }}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={sampledData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" />
            <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            {showSpecial.includes('engagement') && (
              <Area type="monotone" dataKey="engagement" stroke={SPECIAL_COLORS.engagement} fill={SPECIAL_COLORS.engagement + '20'} strokeWidth={1.5} dot={false} name="Engagement" />
            )}
            {showSpecial.includes('valence') && (
              <Line type="monotone" dataKey="valence" stroke={SPECIAL_COLORS.valence} strokeWidth={1.5} dot={false} name="Valence" />
            )}
            {showSpecial.includes('attention') && (
              <Line type="monotone" dataKey="attention" stroke={SPECIAL_COLORS.attention} strokeWidth={1.5} dot={false} name="Attention" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Emotion Time Series */}
      <div className="metric-card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="section-label mb-1">EMOTION SIGNALS</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)' }}>
              感情スコアの時系列
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 max-w-sm justify-end">
            {NON_NEUTRAL_EMOTIONS.map(emotion => (
              <button
                key={emotion}
                onClick={() => toggleEmotion(emotion)}
                className="px-2 py-0.5 rounded-full text-xs transition-all"
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  background: selectedEmotions.includes(emotion) ? EMOTION_COLORS[emotion] : 'oklch(0.95 0.003 80)',
                  color: selectedEmotions.includes(emotion) ? 'white' : 'oklch(0.45 0.015 250)',
                  border: `1px solid ${selectedEmotions.includes(emotion) ? EMOTION_COLORS[emotion] : 'oklch(0.88 0.008 80)'}`,
                  opacity: selectedEmotions.includes(emotion) ? 1 : 0.6,
                  fontSize: '0.7rem',
                }}
              >
                {EMOTION_LABELS_JA[emotion]}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={sampledData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" />
            <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.52 0.015 250)' }} />
            <Tooltip content={<CustomTooltip />} />
            {selectedEmotions.map(emotion => (
              <Line
                key={emotion}
                type="monotone"
                dataKey={emotion}
                stroke={EMOTION_COLORS[emotion]}
                strokeWidth={1.5}
                dot={false}
                name={EMOTION_LABELS_JA[emotion]}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 10-second window summary */}
      <div className="metric-card">
        <div className="section-label mb-3">10-SECOND WINDOWS</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '1rem' }}>
          10秒区間ごとのサマリー
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '2px solid oklch(0.88 0.008 80)' }}>
                {['時間区間', 'フレーム数', 'Engagement', 'Valence', 'Attention', '主要感情'].map(h => (
                  <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.52 0.015 250)', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {time_summary_10s.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid oklch(0.94 0.003 80)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'oklch(0.97 0.003 80)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.45 0.015 250)' }}>
                    {row.time_start}s – {row.time_end}s
                  </td>
                  <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>
                    {row.frame_count}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full" style={{ width: `${Math.min(60, row.engagement_mean)}px`, background: 'oklch(0.72 0.18 80)' }} />
                      <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>
                        {row.engagement_mean.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full" style={{ width: `${Math.min(60, row.valence_mean * 0.6)}px`, background: 'oklch(0.62 0.18 25)' }} />
                      <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>
                        {row.valence_mean.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>
                      {row.attention_mean.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{
                      background: EMOTION_COLORS[row.dominant_emotion] + '20',
                      color: EMOTION_COLORS[row.dominant_emotion],
                      fontFamily: 'Outfit, sans-serif',
                      fontSize: '0.72rem',
                    }}>
                      {EMOTION_LABELS_JA[row.dominant_emotion] || row.dominant_emotion}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
