/*
 * DESIGN: Neuro-Signal Interface
 * Time series visualization with signal wave aesthetic
 * Extended with emotion heatmap, sparklines, stacked area, dominant timeline
 */

import { useState, useMemo } from 'react';
import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart, ComposedChart, BarChart, Bar, Cell,
} from 'recharts';

interface Props {
  data: DashboardData;
}

const SPECIAL_COLORS: Record<string, string> = {
  engagement: '#d97706',
  valence: '#dc4f1e',
  attention: '#7c3aed',
};

// oklchをHEX近似に変換（recharts用）
const EMOTION_HEX: Record<string, string> = {
  anger: '#e17055',
  contempt: '#a29bfe',
  disgust: '#00b894',
  fear: '#6c5ce7',
  joy: '#fdcb6e',
  sadness: '#74b9ff',
  surprise: '#00cec9',
  sentimentality: '#fd79a8',
  confusion: '#b2bec3',
  neutral: '#636e72',
};

const TIME_PRESETS: [number, number, string][] = [
  [0, 278, '全体'],
  [0, 60, '0-60s'],
  [60, 120, '60-120s'],
  [120, 180, '120-180s'],
  [180, 278, '180-278s'],
];

export default function TimeseriesSection({ data }: Props) {
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(['confusion', 'sadness', 'fear', 'disgust']);
  const [showSpecial, setShowSpecial] = useState<string[]>(['engagement', 'valence']);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 278]);
  const [activeTab, setActiveTab] = useState<'overlay' | 'sparklines' | 'heatmap' | 'stacked' | 'dominant'>('overlay');

  const { timeseries_full, time_summary_10s } = data;
  const maxTime = Math.ceil(data.meta.duration_seconds);

  // フィルタリング＆サンプリング（最大600点）
  const sampledData = useMemo(() => {
    const filtered = timeseries_full.filter(
      d => d.time >= timeRange[0] && d.time <= timeRange[1]
    );
    const step = Math.max(1, Math.floor(filtered.length / 600));
    return filtered.filter((_, i) => i % step === 0);
  }, [timeseries_full, timeRange]);

  // ヒートマップ用データ（30秒区間）
  const heatmapData = useMemo(() => {
    const bucketSize = 5; // 5秒区間
    const buckets: Record<number, Record<string, number[]>> = {};
    for (const frame of timeseries_full) {
      const bucket = Math.floor(frame.time / bucketSize) * bucketSize;
      if (!buckets[bucket]) buckets[bucket] = {};
      for (const e of NON_NEUTRAL_EMOTIONS) {
        if (!buckets[bucket][e]) buckets[bucket][e] = [];
        buckets[bucket][e].push((frame as any)[e] || 0);
      }
    }
    return Object.entries(buckets)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([t, emotionData]) => {
        const row: Record<string, number> = { time: Number(t) };
        for (const e of NON_NEUTRAL_EMOTIONS) {
          const vals = emotionData[e] || [0];
          row[e] = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
        return row;
      });
  }, [timeseries_full]);

  // スタック面グラフ用（10秒区間サマリーを使用）
  const stackedData = useMemo(() => {
    return time_summary_10s.map(row => {
      const result: Record<string, number | string> = {
        time: `${row.time_start}s`,
      };
      for (const e of NON_NEUTRAL_EMOTIONS) {
        result[e] = (row as any)[`${e}_mean`] || 0;
      }
      return result;
    });
  }, [time_summary_10s]);

  // 支配的感情タイムライン（10秒区間）
  const dominantTimeline = useMemo(() => {
    return time_summary_10s.map(row => ({
      time: `${row.time_start}s`,
      emotion: row.dominant_emotion,
      color: EMOTION_HEX[row.dominant_emotion] || '#999',
      label: EMOTION_LABELS_JA[row.dominant_emotion] || row.dominant_emotion,
    }));
  }, [time_summary_10s]);

  // ヒートマップの最大値（スケーリング用）
  const heatmapMax = useMemo(() => {
    let max = 0;
    for (const row of heatmapData) {
      for (const e of NON_NEUTRAL_EMOTIONS) {
        if (e !== 'confusion' && (row[e] as number) > max) max = row[e] as number;
      }
    }
    return max || 1;
  }, [heatmapData]);

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

  const formatTime = (t: number) => `${Number(t).toFixed(0)}s`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="p-3 rounded-lg shadow-lg" style={{ background: 'oklch(0.15 0.02 250)', border: '1px solid oklch(0.25 0.02 250)', maxWidth: '220px' }}>
        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: '#4ade80', marginBottom: '6px' }}>
          t = {Number(label).toFixed(2)}s
        </div>
        {payload.slice(0, 8).map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.7rem', color: 'oklch(0.75 0.005 80)' }}>
              {p.name}: <span style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 600 }}>{Number(p.value).toFixed(3)}</span>
            </span>
          </div>
        ))}
      </div>
    );
  };

  const tabs = [
    { id: 'overlay', label: 'オーバーレイ' },
    { id: 'sparklines', label: '個別波形' },
    { id: 'heatmap', label: 'ヒートマップ' },
    { id: 'stacked', label: 'スタック面' },
    { id: 'dominant', label: '支配感情' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-label mb-1">TIME SERIES ANALYSIS</div>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.15 0.02 250)' }}>
          時系列分析
        </h2>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: 'oklch(0.52 0.015 250)', marginTop: '0.25rem' }}>
          感情スコアおよびEngagement・Valence・Attentionの時間推移 — 5つの可視化モードで多角的に分析
        </p>
      </div>

      {/* Time Range Selector */}
      <div className="metric-card">
        <div className="section-label mb-2">TIME RANGE FILTER</div>
        <div className="flex items-center gap-3 mb-2">
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'oklch(0.45 0.015 250)', minWidth: '32px' }}>
            {timeRange[0]}s
          </span>
          <div className="flex-1 relative h-6 flex items-center">
            <div className="absolute w-full h-1 rounded-full" style={{ background: 'oklch(0.9 0.005 80)' }} />
            <div
              className="absolute h-1 rounded-full"
              style={{
                left: `${(timeRange[0] / maxTime) * 100}%`,
                right: `${100 - (timeRange[1] / maxTime) * 100}%`,
                background: 'oklch(0.62 0.18 160)',
              }}
            />
            <input
              type="range" min={0} max={maxTime} step={5}
              value={timeRange[0]}
              onChange={e => setTimeRange([Math.min(Number(e.target.value), timeRange[1] - 10), timeRange[1]])}
              className="absolute w-full opacity-0 cursor-pointer h-6"
              style={{ zIndex: 2 }}
            />
            <input
              type="range" min={0} max={maxTime} step={5}
              value={timeRange[1]}
              onChange={e => setTimeRange([timeRange[0], Math.max(Number(e.target.value), timeRange[0] + 10)])}
              className="absolute w-full opacity-0 cursor-pointer h-6"
              style={{ zIndex: 3 }}
            />
          </div>
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'oklch(0.45 0.015 250)', minWidth: '32px', textAlign: 'right' }}>
            {timeRange[1]}s
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {TIME_PRESETS.map(([s, e, label]) => (
            <button
              key={label}
              onClick={() => setTimeRange([s, e])}
              className="px-2.5 py-1 rounded text-xs transition-all"
              style={{
                fontFamily: 'Roboto Mono, monospace',
                background: timeRange[0] === s && timeRange[1] === e ? 'oklch(0.32 0.12 160)' : 'oklch(0.95 0.003 80)',
                color: timeRange[0] === s && timeRange[1] === e ? 'white' : 'oklch(0.45 0.015 250)',
                border: `1px solid ${timeRange[0] === s && timeRange[1] === e ? 'oklch(0.52 0.18 160)' : 'oklch(0.88 0.008 80)'}`,
              }}
            >
              {label}
            </button>
          ))}
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.52 0.015 250)', alignSelf: 'center', marginLeft: '4px' }}>
            {sampledData.length} pts表示中
          </span>
        </div>
      </div>

      {/* Special Metrics Chart — always visible */}
      <div className="metric-card">
        <div className="flex items-center justify-between mb-3">
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
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={sampledData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SPECIAL_COLORS.engagement} stopOpacity={0.25} />
                <stop offset="95%" stopColor={SPECIAL_COLORS.engagement} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" />
            <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.52 0.015 250)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.52 0.015 250)' }} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={v => <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem' }}>{v}</span>} />
            {showSpecial.includes('engagement') && (
              <Area type="monotone" dataKey="engagement" stroke={SPECIAL_COLORS.engagement} fill="url(#engGrad)" strokeWidth={1.5} dot={false} name="Engagement" />
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

      {/* Emotion Charts — Tab Switcher */}
      <div className="metric-card">
        <div className="section-label mb-3">EMOTION TIME SERIES</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '1rem' }}>
          感情スコアの時系列グラフ
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'oklch(0.95 0.003 80)', width: 'fit-content' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-3 py-1.5 rounded-md text-xs transition-all"
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontWeight: activeTab === tab.id ? 600 : 400,
                background: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? 'oklch(0.15 0.02 250)' : 'oklch(0.52 0.015 250)',
                boxShadow: activeTab === tab.id ? '0 1px 3px oklch(0.15 0.02 250 / 0.1)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: オーバーレイ */}
        {activeTab === 'overlay' && (
          <div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {NON_NEUTRAL_EMOTIONS.map(emotion => (
                <button
                  key={emotion}
                  onClick={() => toggleEmotion(emotion)}
                  className="px-2.5 py-0.5 rounded-full text-xs transition-all"
                  style={{
                    fontFamily: 'Outfit, sans-serif',
                    background: selectedEmotions.includes(emotion) ? EMOTION_HEX[emotion] : 'oklch(0.95 0.003 80)',
                    color: selectedEmotions.includes(emotion) ? 'white' : 'oklch(0.45 0.015 250)',
                    border: `1px solid ${selectedEmotions.includes(emotion) ? EMOTION_HEX[emotion] : 'oklch(0.88 0.008 80)'}`,
                    fontSize: '0.72rem',
                  }}
                >
                  {EMOTION_LABELS_JA[emotion]}
                </button>
              ))}
            </div>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'oklch(0.55 0.015 250)', marginBottom: '0.75rem' }}>
              複数の感情スコアを同一グラフ上に重ねて表示します。感情ボタンをクリックして表示/非表示を切り替えられます。
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={sampledData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" />
                <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.52 0.015 250)' }} />
                <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.52 0.015 250)' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={v => <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem' }}>{v}</span>} />
                {selectedEmotions.map(emotion => (
                  <Line
                    key={emotion}
                    type="monotone"
                    dataKey={emotion}
                    stroke={EMOTION_HEX[emotion]}
                    strokeWidth={1.5}
                    dot={false}
                    name={EMOTION_LABELS_JA[emotion]}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* TAB: 個別波形（スパークライン） */}
        {activeTab === 'sparklines' && (
          <div>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'oklch(0.55 0.015 250)', marginBottom: '1rem' }}>
              各感情スコアを独立したチャートで表示します。微細な変動パターンを個別に確認できます。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {NON_NEUTRAL_EMOTIONS.map(emotion => {
                const maxVal = Math.max(...sampledData.map(d => (d as any)[emotion] || 0));
                const meanVal = sampledData.reduce((acc, d) => acc + ((d as any)[emotion] || 0), 0) / sampledData.length;
                return (
                  <div key={emotion} className="p-3 rounded-lg" style={{ background: 'oklch(0.97 0.003 80)', border: `1px solid ${EMOTION_HEX[emotion]}30` }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: EMOTION_HEX[emotion] }} />
                        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '0.82rem', color: 'oklch(0.15 0.02 250)' }}>
                          {EMOTION_LABELS_JA[emotion]}
                        </span>
                      </div>
                      <div className="text-right">
                        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: EMOTION_HEX[emotion] }}>
                          max {maxVal.toFixed(2)}
                        </div>
                        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.52 0.015 250)' }}>
                          avg {meanVal.toFixed(3)}
                        </div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={80}>
                      <AreaChart data={sampledData} margin={{ top: 2, right: 2, bottom: 2, left: 0 }}>
                        <defs>
                          <linearGradient id={`grad-${emotion}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={EMOTION_HEX[emotion]} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={EMOTION_HEX[emotion]} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" hide />
                        <YAxis hide domain={[0, Math.max(maxVal * 1.1, 0.01)]} />
                        <Tooltip
                          formatter={(v: number) => [v.toFixed(3), EMOTION_LABELS_JA[emotion]]}
                          labelFormatter={(l: number) => `t=${Number(l).toFixed(1)}s`}
                          contentStyle={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', border: `1px solid ${EMOTION_HEX[emotion]}50`, borderRadius: '6px', padding: '4px 8px' }}
                        />
                        <Area
                          type="monotone"
                          dataKey={emotion}
                          stroke={EMOTION_HEX[emotion]}
                          fill={`url(#grad-${emotion})`}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: ヒートマップ */}
        {activeTab === 'heatmap' && (
          <div>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'oklch(0.55 0.015 250)', marginBottom: '1rem' }}>
              5秒区間ごとの感情スコア平均値をヒートマップで表示します。横軸が時間、縦軸が感情種別、色の濃さがスコアの強度を示します。
            </p>
            <div className="overflow-x-auto">
              <div style={{ minWidth: '600px' }}>
                {/* 感情ラベル + ヒートマップ行 */}
                {NON_NEUTRAL_EMOTIONS.map(emotion => {
                  const emotionMax = emotion === 'confusion'
                    ? Math.max(...heatmapData.map(d => d[emotion] as number))
                    : heatmapMax;
                  return (
                    <div key={emotion} className="flex items-center gap-2 mb-1">
                      <div className="flex-shrink-0 text-right" style={{ width: '60px' }}>
                        <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.68rem', color: EMOTION_HEX[emotion], fontWeight: 600 }}>
                          {EMOTION_LABELS_JA[emotion]}
                        </span>
                      </div>
                      <div className="flex gap-0.5 flex-1">
                        {heatmapData.map((d, i) => {
                          const val = d[emotion] as number;
                          const intensity = emotionMax > 0 ? val / emotionMax : 0;
                          return (
                            <div
                              key={i}
                              className="flex-1 rounded-sm"
                              style={{
                                height: '22px',
                                background: `${EMOTION_HEX[emotion]}`,
                                opacity: Math.max(0.04, intensity),
                                minWidth: '4px',
                              }}
                              title={`t=${d.time}s: ${val.toFixed(3)}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {/* 時間軸 */}
                <div className="flex items-center gap-2 mt-2">
                  <div style={{ width: '60px' }} />
                  <div className="flex justify-between flex-1">
                    {[0, 50, 100, 150, 200, 250].map(t => (
                      <span key={t} style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.52 0.015 250)' }}>
                        {t}s
                      </span>
                    ))}
                  </div>
                </div>
                {/* カラースケール凡例 */}
                <div className="flex items-center gap-3 mt-3">
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.52 0.015 250)' }}>低</span>
                  <div className="flex gap-0.5">
                    {[0.05, 0.15, 0.3, 0.5, 0.7, 0.85, 1.0].map((op, i) => (
                      <div key={i} className="w-6 h-3 rounded-sm" style={{ background: '#74b9ff', opacity: op }} />
                    ))}
                  </div>
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.52 0.015 250)' }}>高</span>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.65rem', color: 'oklch(0.52 0.015 250)', marginLeft: '8px' }}>
                    ※各感情内での相対スケール（5秒区間平均値）
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: スタック面グラフ */}
        {activeTab === 'stacked' && (
          <div>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'oklch(0.55 0.015 250)', marginBottom: '1rem' }}>
              10秒区間ごとの感情スコア平均値を積み上げ面グラフで表示します。各感情の相対的な変化パターンを把握できます。
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stackedData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" />
                <XAxis dataKey="time" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.52 0.015 250)' }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.52 0.015 250)' }} />
                <Tooltip
                  contentStyle={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', border: '1px solid oklch(0.88 0.008 80)', borderRadius: '6px' }}
                  formatter={(v: number, name: string) => [v.toFixed(3), EMOTION_LABELS_JA[name] || name]}
                />
                <Legend formatter={v => <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem' }}>{EMOTION_LABELS_JA[v] || v}</span>} />
                {NON_NEUTRAL_EMOTIONS.filter(e => e !== 'confusion').map(emotion => (
                  <Area
                    key={emotion}
                    type="monotone"
                    dataKey={emotion}
                    stackId="1"
                    stroke={EMOTION_HEX[emotion]}
                    fill={EMOTION_HEX[emotion]}
                    fillOpacity={0.75}
                    strokeWidth={0.5}
                    dot={false}
                    name={emotion}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'oklch(0.55 0.015 250)', marginTop: '0.5rem' }}>
              ※「困惑」（平均89.9%）は他感情との視認性確保のため除外しています
            </p>
          </div>
        )}

        {/* TAB: 支配的感情タイムライン */}
        {activeTab === 'dominant' && (
          <div>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'oklch(0.55 0.015 250)', marginBottom: '1rem' }}>
              10秒区間ごとに最も高いスコアを示した「支配的感情」の推移を表示します。感情状態の遷移パターンを視覚的に把握できます。
            </p>
            {/* カラーバータイムライン */}
            <div className="mb-4">
              <div className="section-label mb-2">DOMINANT EMOTION TIMELINE</div>
              <div className="flex gap-0.5 rounded-lg overflow-hidden" style={{ height: '40px' }}>
                {dominantTimeline.map((d, i) => (
                  <div
                    key={i}
                    className="flex-1 flex items-center justify-center relative group"
                    style={{ background: d.color, minWidth: '8px' }}
                    title={`${d.time}: ${d.label}`}
                  >
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                      style={{ background: 'oklch(0.15 0.02 250)', color: 'white', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>
                      {d.time}: {d.label}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.52 0.015 250)' }}>0s</span>
                <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.52 0.015 250)' }}>278s</span>
              </div>
            </div>

            {/* 棒グラフ：10秒区間ごとの感情 */}
            <div className="section-label mb-2">10-SECOND WINDOW EMOTION SCORES</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stackedData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', fill: 'oklch(0.52 0.015 250)' }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.52 0.015 250)' }} />
                <Tooltip
                  contentStyle={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', border: '1px solid oklch(0.88 0.008 80)', borderRadius: '6px' }}
                  formatter={(v: number, name: string) => [v.toFixed(3), EMOTION_LABELS_JA[name] || name]}
                />
                <Legend formatter={v => <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem' }}>{EMOTION_LABELS_JA[v] || v}</span>} />
                {NON_NEUTRAL_EMOTIONS.filter(e => e !== 'confusion').map(emotion => (
                  <Bar
                    key={emotion}
                    dataKey={emotion}
                    stackId="a"
                    fill={EMOTION_HEX[emotion]}
                    fillOpacity={0.85}
                    name={emotion}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>

            {/* 凡例 */}
            <div className="flex flex-wrap gap-3 mt-3">
              {NON_NEUTRAL_EMOTIONS.map(e => (
                <div key={e} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: EMOTION_HEX[e] }} />
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.72rem', color: 'oklch(0.35 0.015 250)' }}>
                    {EMOTION_LABELS_JA[e]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 全感情の統合ビュー（常時表示） */}
      <div className="metric-card">
        <div className="section-label mb-3">ALL EMOTIONS — FULL SESSION</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '0.5rem' }}>
          全感情スコアの全期間推移（困惑を除く）
        </div>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', color: 'oklch(0.55 0.015 250)', marginBottom: '1rem' }}>
          困惑（平均89.9%）を除く8感情の全セッション推移。各感情の突発的な上昇イベントを確認できます。
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={useMemo(() => {
              const step = Math.max(1, Math.floor(timeseries_full.length / 600));
              return timeseries_full.filter((_, i) => i % step === 0);
            }, [timeseries_full])}
            margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 80)" />
            <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.52 0.015 250)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.52 0.015 250)' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={v => <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.7rem' }}>{EMOTION_LABELS_JA[v] || v}</span>} />
            {NON_NEUTRAL_EMOTIONS.filter(e => e !== 'confusion').map(emotion => (
              <Line
                key={emotion}
                type="monotone"
                dataKey={emotion}
                stroke={EMOTION_HEX[emotion]}
                strokeWidth={1.5}
                dot={false}
                name={emotion}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 10-second window summary table */}
      <div className="metric-card">
        <div className="section-label mb-3">10-SECOND WINDOWS TABLE</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.15 0.02 250)', marginBottom: '1rem' }}>
          10秒区間ごとのサマリー
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '2px solid oklch(0.88 0.008 80)' }}>
                {['時間区間', 'Eng', 'Val', 'Att', '怒', '軽', '嫌', '恐', '喜', '悲', '驚', '感', '困', '主要感情'].map(h => (
                  <th key={h} className="text-left pb-2 pr-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.52 0.015 250)', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
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
                  <td className="py-1.5 pr-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', color: 'oklch(0.45 0.015 250)', whiteSpace: 'nowrap' }}>
                    {row.time_start}–{row.time_end}s
                  </td>
                  {['engagement_mean', 'valence_mean', 'attention_mean'].map(key => (
                    <td key={key} className="py-1.5 pr-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem' }}>
                      {((row as any)[key] || 0).toFixed(1)}
                    </td>
                  ))}
                  {['anger_mean', 'contempt_mean', 'disgust_mean', 'fear_mean', 'joy_mean', 'sadness_mean', 'surprise_mean', 'sentimentality_mean', 'confusion_mean'].map((key, j) => {
                    const val = (row as any)[key] || 0;
                    const emotionKey = key.replace('_mean', '');
                    return (
                      <td key={key} className="py-1.5 pr-2">
                        <span style={{
                          fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem',
                          color: val > 5 ? EMOTION_HEX[emotionKey] : 'oklch(0.52 0.015 250)',
                          fontWeight: val > 5 ? 600 : 400,
                        }}>
                          {val.toFixed(1)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-1.5">
                    <span className="px-1.5 py-0.5 rounded-full" style={{
                      background: EMOTION_HEX[row.dominant_emotion] + '25',
                      color: EMOTION_HEX[row.dominant_emotion],
                      fontFamily: 'Outfit, sans-serif',
                      fontSize: '0.65rem',
                      whiteSpace: 'nowrap',
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
