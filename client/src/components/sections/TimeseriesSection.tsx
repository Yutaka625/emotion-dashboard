/**
 * DESIGN: Neuro-Signal Interface
 * Time series visualization with signal wave aesthetic
 * Extended with emotion heatmap, sparklines, stacked area, dominant timeline
 * + Event (intervention) registration with graph highlight and stats
 */

import { useState, useMemo } from 'react';
import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart, ComposedChart, BarChart, Bar,
  ReferenceArea, ReferenceLine,
} from 'recharts';
import { Plus, Trash2, ChevronDown, ChevronUp, Tag, Download, Target, Wand2 } from 'lucide-react';
import { useBaseline } from '@/contexts/BaselineContext';
import { useEvents } from '@/contexts/EventsContext';
import type { EventAnnotation } from '@/contexts/EventsContext';
import { EVENT_PALETTE } from '@/contexts/EventsContext';
import { applyBaselineCorrection, detectBaselineWindow } from '@/lib/csvAnalyzer';
import { compareSegments, TESTABLE_EMOTIONS } from '@/lib/statisticsUtils';
import type { TTestResult } from '@/lib/statisticsUtils';
import { toast } from 'sonner';

interface Props {
  data: DashboardData;
}

// EventAnnotation 型と EVENT_PALETTE は EventsContext からインポート済み

const SPECIAL_COLORS: Record<string, string> = {
  engagement: 'oklch(0.78 0.14 82)',   /* ゴールド */
  valence:    'oklch(0.70 0.14 195)',  /* ティール */
  attention:  'oklch(0.60 0.25 15)', /* 赤 */
};

// EMOTION_HEX は EMOTION_COLORS (types.ts) に統一
const EMOTION_HEX = EMOTION_COLORS;

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function TimeseriesSection({ data }: Props) {
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(['anger', 'sadness', 'surprise', 'disgust', 'fear', 'joy']);
  const [showSpecial, setShowSpecial] = useState<string[]>(['engagement', 'valence', 'attention']);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, Math.ceil(data.meta.duration_seconds)]);
  const [activeTab, setActiveTab] = useState<'overlay' | 'sparklines' | 'heatmap' | 'stacked' | 'dominant'>('overlay');

  // ---- Event state (EventsContext 経由で共有) ----
  const { events, setEvents } = useEvents();
  const [newEventName, setNewEventName] = useState('');
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd] = useState('');
  const [eventFormError, setEventFormError] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);

  // ---- 区間比較・統計検定 state ----
  const [compSegA, setCompSegA] = useState<string>('');
  const [compSegB, setCompSegB] = useState<string>('');
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<Record<string, TTestResult> | null>(null);

  // ベースライン補正 Context
  const { baselineRange, baselineOffsets, isBaselineActive, setBaseline, clearBaseline } = useBaseline();

  const { timeseries_full, time_summary_10s } = data;
  const maxTime = Math.ceil(data.meta.duration_seconds);

  const TIME_PRESETS: [number, number, string][] = useMemo(() => [
    [0, maxTime, '全体'],
    [0, 60, '0-60s'],
    [60, 120, '60-120s'],
    [120, 180, '120-180s'],
    [180, maxTime, `180-${maxTime}s`],
  ], [maxTime]);

  // フィルタリング＆サンプリング（最大600点）
  const sampledData = useMemo(() => {
    const filtered = timeseries_full.filter(
      d => d.time >= timeRange[0] && d.time <= timeRange[1]
    );
    const step = Math.max(1, Math.floor(filtered.length / 600));
    return filtered.filter((_, i) => i % step === 0);
  }, [timeseries_full, timeRange]);

  // ベースライン補正済みの表示用データ（補正OFFなら元データをそのまま返す）
  const displayData = useMemo(() => {
    if (!isBaselineActive || !baselineOffsets) return sampledData;
    return applyBaselineCorrection(sampledData, baselineOffsets);
  }, [sampledData, isBaselineActive, baselineOffsets]);

  // ヒートマップ・イベント統計用の全件補正済みデータ
  const displayTimeseriesFull = useMemo(() => {
    if (!isBaselineActive || !baselineOffsets) return timeseries_full;
    return applyBaselineCorrection(timeseries_full, baselineOffsets);
  }, [timeseries_full, isBaselineActive, baselineOffsets]);

  // ヒートマップ用データ（5秒区間）
  const heatmapData = useMemo(() => {
    const bucketSize = 5;
    const buckets: Record<number, Record<string, number[]>> = {};
    for (const frame of displayTimeseriesFull) {
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
  }, [displayTimeseriesFull]);

  // スタック面グラフ用（10秒区間サマリー）
  const stackedData = useMemo(() => {
    return time_summary_10s.map(row => {
      const result: Record<string, number | string> = { time: `${row.time_start}s` };
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

  // ヒートマップの最大値
  const heatmapMax = useMemo(() => {
    let max = 0;
    for (const row of heatmapData) {
      for (const e of NON_NEUTRAL_EMOTIONS) {
        if (e !== 'confusion' && (row[e] as number) > max) max = row[e] as number;
      }
    }
    return max || 1;
  }, [heatmapData]);

  // ---- Event stats: for each event, compute emotion averages ----
  const eventStats = useMemo(() => {
    return events.map(ev => {
      const frames = displayTimeseriesFull.filter(
        f => f.time >= ev.startTime && f.time <= ev.endTime
      );
      if (frames.length === 0) {
        const emptyStats: Record<string, { mean: number; max: number }> = {};
        return { id: ev.id, frameCount: 0, stats: emptyStats, dominantEmotion: 'confusion' };
      }
      const stats: Record<string, { mean: number; max: number }> = {};
      const allCols = [...NON_NEUTRAL_EMOTIONS, 'engagement', 'valence', 'attention'];
      for (const col of allCols) {
        const vals = frames.map(f => (f as any)[col] as number || 0);
        stats[col] = {
          mean: vals.reduce((a, b) => a + b, 0) / vals.length,
          max: Math.max(...vals),
        };
      }
      // dominant emotion
      let domEmo = 'confusion';
      let domVal = -Infinity;
      for (const e of NON_NEUTRAL_EMOTIONS) {
        if (stats[e].mean > domVal) { domVal = stats[e].mean; domEmo = e; }
      }
      return { id: ev.id, frameCount: frames.length, stats, dominantEmotion: domEmo };
    });
  }, [events, displayTimeseriesFull]);

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

  // ---- Add event ----
  const handleAddEvent = () => {
    setEventFormError('');
    const name = newEventName.trim();
    const start = parseFloat(newEventStart);
    const end = parseFloat(newEventEnd);
    if (!name) { setEventFormError('イベント名を入力してください'); return; }
    if (isNaN(start) || isNaN(end)) { setEventFormError('開始・終了時間を数値で入力してください'); return; }
    if (start < 0 || end > maxTime) { setEventFormError(`時間は 0 〜 ${maxTime} 秒の範囲で入力してください`); return; }
    if (start >= end) { setEventFormError('終了時間は開始時間より大きくしてください'); return; }
    const colorIdx = events.length % EVENT_PALETTE.length;
    const newEv: EventAnnotation = {
      id: generateId(),
      name,
      startTime: start,
      endTime: end,
      color: EVENT_PALETTE[colorIdx],
    };
    setEvents(prev => [...prev, newEv]);
    setNewEventName('');
    setNewEventStart('');
    setNewEventEnd('');
    setShowEventForm(false);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    if (expandedEventId === id) setExpandedEventId(null);
  };

  const exportFilteredDataToCSV = () => {
    const filteredData = timeseries_full.filter(
      d => d.time >= timeRange[0] && d.time <= timeRange[1]
    );

    if (filteredData.length === 0) {
      alert('フィルタリング範囲にデータがありません');
      return;
    }

    const headers = ['time'];
    for (const emotion of NON_NEUTRAL_EMOTIONS) {
      headers.push(emotion);
    }
    headers.push('engagement', 'valence', 'attention');
    for (let i = 1; i <= 45; i++) {
      headers.push(`AU${String(i).padStart(2, '0')}`);
    }

    const rows = filteredData.map(row => {
      const values: (string | number)[] = [row.time];
      for (const emotion of NON_NEUTRAL_EMOTIONS) {
        values.push((row as any)[emotion] ?? 0);
      }
      values.push(row.engagement ?? 0, row.valence ?? 0, row.attention ?? 0);
      for (let i = 1; i <= 45; i++) {
        const auKey = `AU${String(i).padStart(2, '0')}`;
        values.push((row as any)[auKey] ?? 0);
      }
      return values;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(v => {
        if (typeof v === 'number') return v.toFixed(3);
        return v;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `emotion_data_${timeRange[0]}-${timeRange[1]}s.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    // Find events at this time
    const t = Number(label);
    const activeEvents = events.filter(ev => t >= ev.startTime && t <= ev.endTime);
    return (
      <div className="p-3 rounded-lg shadow-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.30 0.04 255)', maxWidth: '240px' }}>
        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: '#4ade80', marginBottom: '6px' }}>
          t = {t.toFixed(2)}s
        </div>
        {activeEvents.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {activeEvents.map(ev => (
              <span key={ev.id} className="px-1.5 py-0.5 rounded text-xs" style={{ background: ev.color + '30', color: ev.color, fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', border: `1px solid ${ev.color}60` }}>
                {ev.name}
              </span>
            ))}
          </div>
        )}
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.75 0.005 80)' }}>
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

  // ---- ベースライン区間ハイライト（全グラフで共通利用） ----
  const renderBaselineArea = () => {
    if (!baselineRange) return null;
    return (
      <ReferenceArea
        x1={baselineRange[0]}
        x2={baselineRange[1]}
        fill="oklch(0.70 0.14 195)"
        fillOpacity={0.08}
        stroke="oklch(0.70 0.14 195)"
        strokeOpacity={0.4}
        strokeDasharray="4 2"
        label={{ value: 'BL区間', position: 'insideTopLeft', fontSize: 9, fill: 'oklch(0.70 0.14 195)', fontFamily: 'Roboto Mono, monospace' }}
      />
    );
  };

  // ---- ベースライン ゼロライン（補正適用中のみ） ----
  const renderBaselineZeroLine = () => {
    if (!isBaselineActive) return null;
    return (
      <ReferenceLine
        y={0}
        stroke="oklch(0.70 0.14 195)"
        strokeWidth={1.5}
        strokeDasharray="6 3"
        label={{ value: 'BASELINE=0', position: 'insideTopLeft', fontSize: 9, fill: 'oklch(0.70 0.14 195)' }}
      />
    );
  };

  // ---- Render ReferenceAreas for events ----
  const renderEventAreas = () =>
    events.map(ev => (
      <ReferenceArea
        key={ev.id}
        x1={ev.startTime}
        x2={ev.endTime}
        fill={ev.color}
        fillOpacity={0.12}
        stroke={ev.color}
        strokeOpacity={0.5}
        strokeWidth={1}
        strokeDasharray="4 2"
        label={{ value: ev.name, position: 'insideTopLeft', fontSize: 10, fill: ev.color, fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600 }}
      />
    ));

  // ---- Render ReferenceLines (vertical) for event boundaries ----
  const renderEventLines = () =>
    events.flatMap(ev => [
      <ReferenceLine key={`${ev.id}-s`} x={ev.startTime} stroke={ev.color} strokeWidth={1.5} strokeDasharray="4 2" />,
      <ReferenceLine key={`${ev.id}-e`} x={ev.endTime} stroke={ev.color} strokeWidth={1.5} strokeDasharray="4 2" />,
    ]);

  // ---- Render ReferenceLine markers for change points ----
  const visibleChangePoints = useMemo(() =>
    (data.change_points || []).filter(cp => cp.time >= timeRange[0] && cp.time <= timeRange[1]),
    [data.change_points, timeRange]
  );

  const [showChangePoints, setShowChangePoints] = useState(false);

  const renderChangePointLines = () =>
    showChangePoints
      ? visibleChangePoints.map((cp, i) => (
          <ReferenceLine
            key={`cp-${i}`}
            x={cp.time}
            stroke={cp.direction === 'rise' ? 'oklch(0.75 0.22 140)' : 'oklch(0.68 0.24 24)'}
            strokeWidth={1.5}
            strokeOpacity={0.7}
            strokeDasharray="3 3"
            label={{
              value: cp.direction === 'rise' ? '↑' : '↓',
              position: 'insideTopRight',
              fontSize: 11,
              fill: cp.direction === 'rise' ? 'oklch(0.75 0.22 140)' : 'oklch(0.68 0.24 24)',
            }}
          />
        ))
      : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-label mb-1">TIME SERIES ANALYSIS</div>
        <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.88 0.005 250)' }}>
          時系列分析
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.58 0.015 255)', marginTop: '0.25rem' }}>
          感情スコアおよびEngagement・Valence・Attentionの時間推移 — イベント登録でグラフに介入区間を重ねて表示
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
            <div className="absolute w-full h-1 rounded-full" style={{ background: 'oklch(0.28 0.04 255)' }} />
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
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-2 items-center">
            <label style={{ fontSize: '0.75rem', color: 'oklch(0.45 0.015 250)' }}>開始:</label>
            <input
              type="number"
              min={0}
              max={maxTime}
              step={0.1}
              value={timeRange[0]}
              onChange={e => setTimeRange([Math.min(Number(e.target.value), timeRange[1] - 0.1), timeRange[1]])}
              className="w-16 px-2 py-1 rounded text-xs"
              style={{
                fontFamily: 'Roboto Mono, monospace',
                background: 'oklch(0.20 0.04 255)',
                color: 'oklch(0.85 0.005 65)',
                border: '1px solid oklch(0.28 0.04 255)',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'oklch(0.45 0.015 250)' }}>秒</span>
          </div>
          <div className="flex gap-2 items-center">
            <label style={{ fontSize: '0.75rem', color: 'oklch(0.45 0.015 250)' }}>終了:</label>
            <input
              type="number"
              min={0}
              max={maxTime}
              step={0.1}
              value={timeRange[1]}
              onChange={e => setTimeRange([timeRange[0], Math.max(Number(e.target.value), timeRange[0] + 0.1)])}
              className="w-16 px-2 py-1 rounded text-xs"
              style={{
                fontFamily: 'Roboto Mono, monospace',
                background: 'oklch(0.20 0.04 255)',
                color: 'oklch(0.85 0.005 65)',
                border: '1px solid oklch(0.28 0.04 255)',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'oklch(0.45 0.015 250)' }}>秒</span>
          </div>
          {/* Event quick-zoom buttons */}
          {events.map(ev => (
            <button
              key={ev.id}
              onClick={() => setTimeRange([Math.max(0, ev.startTime - 5), Math.min(maxTime, ev.endTime + 5)])}
              className="px-2.5 py-1 rounded text-xs transition-all flex items-center gap-1"
              style={{
                fontFamily: 'Noto Sans JP, sans-serif',
                background: ev.color + '18',
                color: ev.color,
                border: `1px solid ${ev.color}50`,
              }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: ev.color }} />
              {ev.name}
            </button>
          ))}
          {/* ベースラインとして設定ボタン */}
          <button
            onClick={() => setBaseline(timeRange, data.timeseries_full)}
            className="px-3 py-1 rounded text-xs transition-all flex items-center gap-1"
            style={{
              fontFamily: 'Noto Sans JP, sans-serif',
              background: isBaselineActive ? 'rgba(0,180,216,0.20)' : 'oklch(0.22 0.04 255)',
              color: isBaselineActive ? 'oklch(0.70 0.14 195)' : 'oklch(0.72 0.008 250)',
              border: `1px solid ${isBaselineActive ? 'rgba(0,180,216,0.5)' : 'oklch(0.32 0.04 255)'}`,
            }}
            title="現在の表示範囲をベースライン区間として設定する"
          >
            <Target size={14} />
            ベースラインとして設定
          </button>
          <button
            onClick={exportFilteredDataToCSV}
            className="px-3 py-1 rounded text-xs transition-all flex items-center gap-1 ml-auto"
            style={{
              fontFamily: 'Noto Sans JP, sans-serif',
              background: 'oklch(0.32 0.12 160)',
              color: 'white',
              border: '1px solid oklch(0.52 0.18 160)',
            }}
            title="フィルタリング範囲のデータをCSVでダウンロード"
          >
            <Download size={14} />
            CSV出力
          </button>
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.58 0.015 255)', alignSelf: 'center', marginLeft: '4px' }}>
            {sampledData.length} pts表示中
          </span>
        </div>
      </div>

      {/* ---- BASELINE SETTINGS ---- */}
      <div className="metric-card" style={{ borderLeft: '3px solid oklch(0.70 0.14 195)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="section-label mb-1" style={{ color: 'oklch(0.70 0.14 195)' }}>BASELINE SETTINGS</div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)' }}>
              ベースライン補正設定
            </div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.58 0.015 255)', marginTop: '2px' }}>
              セッション冒頭の無表情区間を差し引いて、感情変化を相対値で比較します
            </p>
          </div>
          {isBaselineActive && (
            <span style={{
              fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem',
              background: 'rgba(0,180,216,0.15)', border: '1px solid rgba(0,180,216,0.4)',
              color: 'oklch(0.70 0.14 195)', padding: '3px 10px', borderRadius: '4px',
            }}>
              ⚡ 補正適用中
            </span>
          )}
        </div>

        {/* STEP 1: ベースライン区間の状態表示 */}
        <div className="mb-4 p-3 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.28 0.04 255)' }}>
          <div className="flex items-center justify-between mb-2">
            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.70 0.14 195)', letterSpacing: '0.08em' }}>
              STEP 1 — ベースライン区間
            </div>
            {/* 自動検出ボタン */}
            <button
              onClick={() => {
                const detected = detectBaselineWindow(data.timeseries_full, 30);
                setBaseline(detected, data.timeseries_full);
                toast.success(`ベースライン区間を自動検出しました: ${detected[0]}s 〜 ${detected[1]}s`, {
                  description: '感情活性量が最も低い 30 秒区間を選択しました。',
                  duration: 4000,
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-all"
              style={{
                fontFamily: 'Noto Sans JP, sans-serif',
                background: 'oklch(0.70 0.14 195 / 0.12)',
                color: 'oklch(0.70 0.14 195)',
                border: '1px solid oklch(0.70 0.14 195 / 0.35)',
              }}
              title="感情が最も落ち着いている 30 秒区間を自動的に検出します"
            >
              <Wand2 size={12} />
              自動検出
            </button>
          </div>
          {baselineRange ? (
            <div className="flex items-center gap-3 flex-wrap">
              <div style={{
                fontFamily: 'Roboto Mono, monospace', fontSize: '0.88rem', fontWeight: 700,
                color: isBaselineActive ? 'oklch(0.70 0.14 195)' : 'oklch(0.75 0.008 250)',
              }}>
                {baselineRange[0]}s 〜 {baselineRange[1]}s
              </div>
              <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.58 0.015 255)' }}>
                （{(baselineRange[1] - baselineRange[0]).toFixed(1)}秒区間）
              </span>
            </div>
          ) : (
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.58 0.015 255)' }}>
              未設定 — TIME RANGE FILTERで無表情区間を選択し、「ベースラインとして設定」を押してください
            </p>
          )}
        </div>

        {/* STEP 2: 補正プレビュー（区間設定済みの場合のみ表示） */}
        {baselineOffsets && (
          <div className="mb-4 p-3 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.28 0.04 255)' }}>
            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.70 0.14 195)', letterSpacing: '0.08em', marginBottom: '8px' }}>
              STEP 2 — オフセット値（ベースライン平均）
            </div>
            <div className="flex flex-wrap gap-2">
              {NON_NEUTRAL_EMOTIONS
                .map(e => ({ emotion: e, offset: baselineOffsets[e as keyof typeof baselineOffsets] ?? 0 }))
                .sort((a, b) => b.offset - a.offset)
                .map(({ emotion, offset }) => (
                  <div key={emotion} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: EMOTION_COLORS[emotion] + '18', border: `1px solid ${EMOTION_COLORS[emotion]}40` }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: EMOTION_COLORS[emotion] }} />
                    <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.75 0.008 250)' }}>
                      {EMOTION_LABELS_JA[emotion]}
                    </span>
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', color: EMOTION_COLORS[emotion] }}>
                      {offset.toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* STEP 3: 適用/解除 */}
        {baselineRange && (
          <div className="flex items-center gap-3">
            {isBaselineActive ? (
              <button
                onClick={clearBaseline}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  fontFamily: 'Noto Sans JP, sans-serif',
                  background: 'oklch(0.22 0.04 255)',
                  color: 'oklch(0.75 0.008 250)',
                  border: '1px solid oklch(0.35 0.04 255)',
                }}
              >
                補正を解除する
              </button>
            ) : (
              <button
                onClick={() => setBaseline(baselineRange, data.timeseries_full)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  fontFamily: 'Noto Sans JP, sans-serif',
                  background: 'rgba(0,180,216,0.15)',
                  color: 'oklch(0.70 0.14 195)',
                  border: '1px solid rgba(0,180,216,0.4)',
                }}
              >
                ベースラインを適用する
              </button>
            )}
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.58 0.015 255)', fontStyle: 'italic' }}>
              補正はいつでも解除できます。元データは保持されます。
            </span>
          </div>
        )}
      </div>

      {/* Emotion Charts — Tab Switcher */}
      <div className="metric-card">
        <div className="section-label mb-3">EMOTION TIME SERIES</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          感情スコアの時系列グラフ
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'oklch(0.20 0.04 255)', width: 'fit-content' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-3 py-1.5 rounded-md text-xs transition-all"
              style={{
                fontFamily: 'Noto Sans JP, sans-serif',
                fontWeight: activeTab === tab.id ? 600 : 400,
                background: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? 'oklch(0.22 0.04 255)' : 'oklch(0.58 0.015 255)',
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
              {NON_NEUTRAL_EMOTIONS.map(emotion => {
                // 背景色が明るい感情（L > 0.70）は暗いテキストで視認性を確保
                const LIGHT_EMOTIONS = new Set(['disgust', 'fear', 'joy', 'sadness', 'surprise', 'confusion', 'sentimentality', 'attention']);
                const isActive = selectedEmotions.includes(emotion);
                const textColor = isActive
                  ? (LIGHT_EMOTIONS.has(emotion) ? 'oklch(0.15 0.02 250)' : 'white')
                  : 'oklch(0.45 0.015 250)';
                return (
                <button
                  key={emotion}
                  onClick={() => toggleEmotion(emotion)}
                  className="px-2.5 py-0.5 rounded-full text-xs transition-all"
                  style={{
                    fontFamily: 'Noto Sans JP, sans-serif',
                    background: isActive ? EMOTION_HEX[emotion] : 'oklch(0.20 0.04 255)',
                    color: textColor,
                    border: `1px solid ${isActive ? EMOTION_HEX[emotion] : 'oklch(0.28 0.04 255)'}`,
                    fontSize: '0.72rem',
                  }}
                >
                  {EMOTION_LABELS_JA[emotion]}
                </button>
                );
              })}
            </div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.58 0.015 255)', marginBottom: '0.75rem' }}>
              複数の感情スコアを同一グラフ上に重ねて表示します。感情ボタンをクリックして表示/非表示を切り替えられます。
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={displayData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
                <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatTime} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.58 0.015 255)' }} />
                <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.58 0.015 255)' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={v => <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem' }}>{v}</span>} />
                {renderBaselineArea()}
                {renderBaselineZeroLine()}
                {renderEventAreas()}
                {renderChangePointLines()}
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

            {/* Change Point Toggle + List */}
            <div className="mt-3">
              <button
                onClick={() => setShowChangePoints(p => !p)}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded transition-all"
                style={{
                  fontFamily: 'Roboto Mono, monospace',
                  background: showChangePoints ? 'oklch(0.30 0.06 160)' : 'oklch(0.22 0.04 255)',
                  color: showChangePoints ? 'oklch(0.75 0.22 140)' : 'oklch(0.58 0.015 255)',
                  border: `1px solid ${showChangePoints ? 'oklch(0.45 0.18 140)' : 'oklch(0.28 0.04 255)'}`,
                }}
              >
                <span>{showChangePoints ? '▲' : '▼'}</span>
                変化点検出 ({visibleChangePoints.length}件)
              </button>

              {showChangePoints && visibleChangePoints.length > 0 && (
                <div className="mt-2 rounded-lg overflow-hidden" style={{ border: '1px solid oklch(0.28 0.04 255)' }}>
                  <div className="px-3 py-2" style={{ background: 'oklch(0.20 0.04 255)', borderBottom: '1px solid oklch(0.26 0.04 255)' }}>
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.50 0.015 255)', letterSpacing: '0.06em' }}>
                      CHANGE POINTS — 感情スコアの急変タイミング（グローバルSD×2.5以上の変化）
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'oklch(0.22 0.04 255)' }}>
                    {visibleChangePoints.map((cp, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2" style={{ background: 'oklch(0.185 0.04 255)' }}>
                        <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', color: 'oklch(0.50 0.015 255)', minWidth: '52px' }}>
                          {cp.time.toFixed(1)}s
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-xs"
                          style={{ background: EMOTION_HEX[cp.emotion] + '20', color: EMOTION_HEX[cp.emotion], fontFamily: 'Noto Sans JP, sans-serif', minWidth: '48px', textAlign: 'center' }}
                        >
                          {EMOTION_LABELS_JA[cp.emotion] || cp.emotion}
                        </span>
                        <span style={{ fontSize: '0.9rem' }}>{cp.direction === 'rise' ? '↑' : '↓'}</span>
                        <span style={{
                          fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem',
                          color: cp.direction === 'rise' ? 'oklch(0.75 0.22 140)' : 'oklch(0.68 0.24 24)',
                        }}>
                          {cp.delta > 0 ? '+' : ''}{cp.delta.toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {showChangePoints && visibleChangePoints.length === 0 && (
                <div className="mt-2 text-center py-3" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.50 0.015 255)' }}>
                  この時間範囲内に有意な変化点は検出されませんでした
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: 個別波形（スパークライン） */}
        {activeTab === 'sparklines' && (
          <div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.58 0.015 255)', marginBottom: '1rem' }}>
              各感情スコアを独立したチャートで表示します。微細な変動パターンを個別に確認できます。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {NON_NEUTRAL_EMOTIONS.map(emotion => {
                const maxVal = Math.max(...displayData.map(d => (d as any)[emotion] || 0));
                const meanVal = displayData.reduce((acc, d) => acc + ((d as any)[emotion] || 0), 0) / displayData.length;
                return (
                  <div key={emotion} className="p-3 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: `1px solid ${EMOTION_HEX[emotion]}30` }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: EMOTION_HEX[emotion] }} />
                        <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.82rem', color: 'oklch(0.88 0.005 250)' }}>
                          {EMOTION_LABELS_JA[emotion]}
                        </span>
                      </div>
                      <div className="text-right">
                        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: EMOTION_HEX[emotion] }}>
                          max {maxVal.toFixed(2)}
                        </div>
                        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)' }}>
                          avg {meanVal.toFixed(3)}
                        </div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={80}>
                      <AreaChart data={displayData} margin={{ top: 2, right: 2, bottom: 2, left: 0 }}>
                        <defs>
                          <linearGradient id={`grad-${emotion}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={EMOTION_HEX[emotion]} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={EMOTION_HEX[emotion]} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} hide />
                        <YAxis hide domain={[0, Math.max(maxVal * 1.1, 0.01)]} />
                        <Tooltip
                          formatter={(v: number) => [v.toFixed(3), EMOTION_LABELS_JA[emotion]]}
                          labelFormatter={(l: number) => `t=${Number(l).toFixed(1)}s`}
                          contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', border: `1px solid ${EMOTION_HEX[emotion]}50`, borderRadius: '6px', padding: '4px 8px' }}
                        />
                        {renderEventLines()}
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
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.58 0.015 255)', marginBottom: '1rem' }}>
              5秒区間ごとの感情スコア平均値をヒートマップで表示します。横軸が時間、縦軸が感情種別、色の濃さがスコアの強度を示します。
            </p>
            <div className="overflow-x-auto">
              <div style={{ minWidth: '600px' }}>
                {/* イベントマーカー行 */}
                {events.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-shrink-0 text-right" style={{ width: '60px' }}>
                      <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)' }}>
                        EVENT
                      </span>
                    </div>
                    <div className="flex-1 relative" style={{ height: '16px' }}>
                      {events.map(ev => {
                        const totalDur = data.meta.duration_seconds;
                        const leftPct = (ev.startTime / totalDur) * 100;
                        const widthPct = ((ev.endTime - ev.startTime) / totalDur) * 100;
                        return (
                          <div
                            key={ev.id}
                            className="absolute h-full rounded-sm flex items-center justify-center overflow-hidden"
                            style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: ev.color, opacity: 0.7 }}
                            title={ev.name}
                          >
                            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.55rem', color: 'oklch(0.90 0.005 250)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 2px' }}>
                              {ev.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {NON_NEUTRAL_EMOTIONS.map(emotion => {
                  const emotionMax = emotion === 'confusion'
                    ? Math.max(...heatmapData.map(d => d[emotion] as number))
                    : heatmapMax;
                  return (
                    <div key={emotion} className="flex items-center gap-2 mb-1">
                      <div className="flex-shrink-0 text-right" style={{ width: '60px' }}>
                        <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', color: EMOTION_HEX[emotion], fontWeight: 600 }}>
                          {EMOTION_LABELS_JA[emotion]}
                        </span>
                      </div>
                      <div className="flex gap-0.5 flex-1">
                        {heatmapData.map((d, i) => {
                          const val = d[emotion] as number;
                          const intensity = emotionMax > 0 ? val / emotionMax : 0;
                          const isInEvent = events.some(ev => d.time >= ev.startTime && d.time <= ev.endTime);
                          return (
                            <div
                              key={i}
                              className="flex-1 rounded-sm"
                              style={{
                                height: '22px',
                                background: `${EMOTION_HEX[emotion]}`,
                                opacity: Math.max(0.04, intensity),
                                minWidth: '4px',
                                outline: isInEvent ? '1px solid oklch(0.45 0.015 250)' : 'none',
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
                      <span key={t} style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)' }}>
                        {t}s
                      </span>
                    ))}
                  </div>
                </div>
                {/* カラースケール凡例 */}
                <div className="flex items-center gap-3 mt-3">
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)' }}>低</span>
                  <div className="flex gap-0.5">
                    {[0.05, 0.15, 0.3, 0.5, 0.7, 0.85, 1.0].map((op, i) => (
                      <div key={i} className="w-6 h-3 rounded-sm" style={{ background: 'oklch(0.68 0.18 235)', opacity: op }} />
                    ))}
                  </div>
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)' }}>高</span>
                  <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', color: 'oklch(0.58 0.015 255)', marginLeft: '8px' }}>
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
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.58 0.015 255)', marginBottom: '1rem' }}>
              10秒区間ごとの感情スコア平均値を積み上げ面グラフで表示します。各感情の相対的な変化パターンを把握できます。
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stackedData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
                <XAxis dataKey="time" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.58 0.015 255)' }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.58 0.015 255)' }} />
                <Tooltip
                  contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
                  formatter={(v: number, name: string) => [v.toFixed(3), EMOTION_LABELS_JA[name] || name]}
                />
                <Legend formatter={v => <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem' }}>{EMOTION_LABELS_JA[v] || v}</span>} />
                {NON_NEUTRAL_EMOTIONS.map(emotion => (
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
          </div>
        )}

        {/* TAB: 支配的感情タイムライン */}
        {activeTab === 'dominant' && (
          <div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.58 0.015 255)', marginBottom: '1rem' }}>
              10秒区間ごとに最も高いスコアを示した「支配的感情」の推移を表示します。感情状態の遷移パターンを視覚的に把握できます。
            </p>
            {/* カラーバータイムライン */}
            <div className="mb-4">
              <div className="section-label mb-2">DOMINANT EMOTION TIMELINE</div>
              {/* Event overlay bar */}
              {events.length > 0 && (
                <div className="relative mb-1" style={{ height: '14px' }}>
                  {events.map(ev => {
                    const totalDur = data.meta.duration_seconds;
                    const leftPct = (ev.startTime / totalDur) * 100;
                    const widthPct = ((ev.endTime - ev.startTime) / totalDur) * 100;
                    return (
                      <div
                        key={ev.id}
                        className="absolute h-full rounded-sm flex items-center justify-center overflow-hidden"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: ev.color, opacity: 0.75 }}
                      >
                        <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.55rem', color: 'oklch(0.90 0.005 250)', fontWeight: 700, whiteSpace: 'nowrap', padding: '0 2px' }}>
                          {ev.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-0.5 rounded-lg overflow-hidden" style={{ height: '40px' }}>
                {dominantTimeline.map((d, i) => (
                  <div
                    key={i}
                    className="flex-1 flex items-center justify-center relative group"
                    style={{ background: d.color, minWidth: '8px' }}
                    title={`${d.time}: ${d.label}`}
                  >
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                      style={{ background: 'oklch(0.22 0.04 255)', color: 'oklch(0.90 0.005 250)', fontFamily: 'Noto Sans JP, sans-serif', whiteSpace: 'nowrap' }}>
                      {d.time}: {d.label}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)' }}>0s</span>
                <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)' }}>{maxTime}s</span>
              </div>
            </div>

            {/* 棒グラフ */}
            <div className="section-label mb-2">10-SECOND WINDOW EMOTION SCORES</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stackedData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', fill: 'oklch(0.58 0.015 255)' }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.58 0.015 255)' }} />
                <Tooltip
                  contentStyle={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
                  formatter={(v: number, name: string) => [v.toFixed(3), EMOTION_LABELS_JA[name] || name]}
                />
                <Legend formatter={v => <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem' }}>{EMOTION_LABELS_JA[v] || v}</span>} />
                {NON_NEUTRAL_EMOTIONS.map(emotion => (
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
                  <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.75 0.008 250)' }}>
                    {EMOTION_LABELS_JA[e]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Special Metrics Chart — always visible */}
      <div className="metric-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="section-label mb-1">SPECIAL METRICS</div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)' }}>
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
                  background: showSpecial.includes(key) ? SPECIAL_COLORS[key] : 'oklch(0.20 0.04 255)',
                  color: showSpecial.includes(key) ? 'white' : 'oklch(0.45 0.015 250)',
                  border: `1px solid ${showSpecial.includes(key) ? SPECIAL_COLORS[key] : 'oklch(0.28 0.04 255)'}`,
                  opacity: showSpecial.includes(key) ? 1 : 0.6,
                }}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={displayData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SPECIAL_COLORS.engagement} stopOpacity={0.25} />
                <stop offset="95%" stopColor={SPECIAL_COLORS.engagement} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
            <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatTime} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.58 0.015 255)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.58 0.015 255)' }} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={v => <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem' }}>{v}</span>} />
            {renderBaselineArea()}
            {renderEventAreas()}
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

      {/* ---- EVENT ANNOTATION PANEL ---- */}
      <div className="metric-card" style={{ borderLeft: '3px solid oklch(0.55 0.18 250)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="section-label mb-1">EVENT ANNOTATIONS</div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)' }}>
              イベント（介入）登録
            </div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.58 0.015 255)', marginTop: '2px' }}>
              イベント名・開始・終了時間を登録するとグラフに反映されます
            </p>
          </div>
          <button
            onClick={() => setShowEventForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all"
            style={{
              fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.82rem',
              background: showEventForm ? 'oklch(0.32 0.12 250)' : 'oklch(0.22 0.04 255)',
              color: 'oklch(0.90 0.005 250)',
            }}
          >
            <Plus size={14} />
            イベントを追加
          </button>
        </div>

        {/* Add form */}
        {showEventForm && (
          <div className="mb-4 p-4 rounded-xl" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.28 0.04 255)' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fontWeight: 600, color: 'oklch(0.75 0.008 250)', display: 'block', marginBottom: '4px' }}>
                  イベント名
                </label>
                <input
                  type="text"
                  value={newEventName}
                  onChange={e => setNewEventName(e.target.value)}
                  placeholder="例: プレゼン開始"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.82rem',
                    border: '1px solid oklch(0.28 0.04 255)',
                    background: 'oklch(0.22 0.04 255)', color: 'oklch(0.88 0.005 250)',
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleAddEvent()}
                />
              </div>
              <div>
                <label style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fontWeight: 600, color: 'oklch(0.75 0.008 250)', display: 'block', marginBottom: '4px' }}>
                  開始時間（秒）
                </label>
                <input
                  type="number"
                  value={newEventStart}
                  onChange={e => setNewEventStart(e.target.value)}
                  placeholder={`0 〜 ${maxTime}`}
                  min={0} max={maxTime} step={0.1}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem',
                    border: '1px solid oklch(0.28 0.04 255)',
                    background: 'oklch(0.22 0.04 255)', color: 'oklch(0.88 0.005 250)',
                  }}
                />
              </div>
              <div>
                <label style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fontWeight: 600, color: 'oklch(0.75 0.008 250)', display: 'block', marginBottom: '4px' }}>
                  終了時間（秒）
                </label>
                <input
                  type="number"
                  value={newEventEnd}
                  onChange={e => setNewEventEnd(e.target.value)}
                  placeholder={`0 〜 ${maxTime}`}
                  min={0} max={maxTime} step={0.1}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem',
                    border: '1px solid oklch(0.28 0.04 255)',
                    background: 'oklch(0.22 0.04 255)', color: 'oklch(0.88 0.005 250)',
                  }}
                />
              </div>
            </div>
            {eventFormError && (
              <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: '#ef4444', marginBottom: '8px' }}>
                {eventFormError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleAddEvent}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ fontFamily: 'Noto Sans JP, sans-serif', background: 'oklch(0.22 0.04 255)', color: 'oklch(0.90 0.005 250)' }}
              >
                登録する
              </button>
              <button
                onClick={() => { setShowEventForm(false); setEventFormError(''); }}
                className="px-4 py-2 rounded-lg text-sm transition-all"
                style={{ fontFamily: 'Noto Sans JP, sans-serif', background: 'oklch(0.22 0.04 255)', color: 'oklch(0.75 0.008 250)' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Event list */}
        {events.length === 0 ? (
          <div className="py-6 text-center" style={{ border: '1px dashed oklch(0.28 0.04 255)', borderRadius: '12px' }}>
            <Tag size={20} style={{ color: 'oklch(0.72 0.015 250)', margin: '0 auto 8px' }} />
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.82rem', color: 'oklch(0.58 0.015 255)' }}>
              まだイベントが登録されていません
            </p>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 250)', marginTop: '4px' }}>
              「イベントを追加」ボタンから登録してください
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((ev, idx) => {
              const stat = eventStats.find(s => s.id === ev.id);
              const isExpanded = expandedEventId === ev.id;
              return (
                <div key={ev.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${ev.color}40`, background: `${ev.color}08` }}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ev.color }} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'oklch(0.88 0.005 250)' }}>
                        {ev.name}
                      </div>
                      <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', color: 'oklch(0.45 0.015 250)' }}>
                        {ev.startTime}s — {ev.endTime}s &nbsp;|&nbsp; {(ev.endTime - ev.startTime).toFixed(1)}秒間 &nbsp;|&nbsp; {stat?.frameCount || 0} フレーム
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: ev.color, background: `${ev.color}15` }}
                        title="感情統計を表示"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: '#ef4444', background: '#ef444415' }}
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded stats */}
                  {isExpanded && stat && stat.frameCount > 0 && (
                    <div className="px-4 pb-4 pt-1">
                      <div className="section-label mb-2" style={{ color: ev.color }}>EVENT EMOTION STATS — {ev.name}</div>
                      {/* Special metrics */}
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        {(['engagement', 'valence', 'attention'] as const).map(key => (
                          <div key={key} className="p-2 rounded-lg text-center" style={{ background: SPECIAL_COLORS[key] + '12', border: `1px solid ${SPECIAL_COLORS[key]}30` }}>
                            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: SPECIAL_COLORS[key], marginBottom: '2px', textTransform: 'uppercase' }}>{key}</div>
                            <div style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)' }}>
                              {stat.stats[key]?.mean.toFixed(1)}
                            </div>
                            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)' }}>
                              max {stat.stats[key]?.max.toFixed(1)}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Emotion bars */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {NON_NEUTRAL_EMOTIONS.filter(e => e !== 'confusion').map(e => {
                          const mean = stat.stats[e]?.mean || 0;
                          const isDom = stat.dominantEmotion === e;
                          return (
                            <div key={e} className="flex items-center gap-2">
                              <div className="flex-shrink-0 text-right" style={{ width: '52px' }}>
                                <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: isDom ? EMOTION_HEX[e] : 'oklch(0.45 0.015 250)', fontWeight: isDom ? 700 : 400 }}>
                                  {EMOTION_LABELS_JA[e]}
                                </span>
                              </div>
                              <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'oklch(0.22 0.04 255)' }}>
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${Math.min(100, mean * 2)}%`, background: EMOTION_HEX[e], opacity: isDom ? 1 : 0.7 }}
                                />
                              </div>
                              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: isDom ? EMOTION_HEX[e] : 'oklch(0.58 0.015 255)', minWidth: '36px', fontWeight: isDom ? 700 : 400 }}>
                                {mean.toFixed(2)}
                              </span>
                              {isDom && <span className="px-1 py-0.5 rounded text-xs" style={{ background: EMOTION_HEX[e] + '20', color: EMOTION_HEX[e], fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.6rem' }}>主要</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ---- 区間比較・統計的検定 ---- */}
        {events.length >= 2 && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid oklch(0.25 0.04 255)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="section-label mb-1" style={{ color: 'oklch(0.65 0.20 270)' }}>STATISTICAL COMPARISON</div>
                <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'oklch(0.88 0.005 250)' }}>
                  区間比較・統計的検定
                </div>
                <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.58 0.015 255)', marginTop: '2px' }}>
                  2つのイベント区間の感情スコアをWelchのt検定で比較します
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 mb-3">
              <div>
                <label style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.58 0.015 255)', display: 'block', marginBottom: '4px' }}>区間 A</label>
                <select
                  value={compSegA}
                  onChange={e => { setCompSegA(e.target.value); setComparisonResult(null); }}
                  className="rounded px-2 py-1 text-sm"
                  style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.32 0.06 255)', color: 'oklch(0.88 0.005 250)', fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem' }}
                >
                  <option value="">選択してください</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name} ({ev.startTime}s–{ev.endTime}s)</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.58 0.015 255)', display: 'block', marginBottom: '4px' }}>区間 B</label>
                <select
                  value={compSegB}
                  onChange={e => { setCompSegB(e.target.value); setComparisonResult(null); }}
                  className="rounded px-2 py-1 text-sm"
                  style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.32 0.06 255)', color: 'oklch(0.88 0.005 250)', fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem' }}
                >
                  <option value="">選択してください</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name} ({ev.startTime}s–{ev.endTime}s)</option>
                  ))}
                </select>
              </div>
              <button
                disabled={!compSegA || !compSegB || compSegA === compSegB}
                onClick={() => {
                  const evA = events.find(e => e.id === compSegA);
                  const evB = events.find(e => e.id === compSegB);
                  if (!evA || !evB) return;
                  const result = compareSegments(
                    displayTimeseriesFull,
                    { start: evA.startTime, end: evA.endTime, name: evA.name },
                    { start: evB.startTime, end: evB.endTime, name: evB.name },
                  );
                  setComparisonResult(result);
                  setShowComparison(true);
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: 'oklch(0.45 0.18 270)', color: 'white', fontFamily: 'Noto Sans JP, sans-serif' }}
              >
                検定を実行
              </button>
            </div>

            {showComparison && comparisonResult && (() => {
              const evA = events.find(e => e.id === compSegA);
              const evB = events.find(e => e.id === compSegB);
              return (
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid oklch(0.30 0.06 270)' }}>
                  <div className="px-3 py-2 flex items-center justify-between" style={{ background: 'oklch(0.20 0.05 270)', borderBottom: '1px solid oklch(0.28 0.05 270)' }}>
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.65 0.20 270)', letterSpacing: '0.06em' }}>
                      WELCH t-TEST RESULTS — {evA?.name} vs {evB?.name}
                    </span>
                    <div className="flex gap-3 text-xs" style={{ fontFamily: 'Roboto Mono, monospace', color: 'oklch(0.55 0.015 255)' }}>
                      <span>*** p&lt;0.001</span><span>** p&lt;0.01</span><span>* p&lt;0.05</span><span>n.s. p≥0.05</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: 'oklch(0.185 0.04 255)', borderBottom: '1px solid oklch(0.26 0.04 255)' }}>
                          {['感情', `${evA?.name} 平均`, `${evB?.name} 平均`, 't値', 'df', 'p値', "Cohen's d", '効果量', '有意性'].map(h => (
                            <th key={h} className="px-3 py-2 text-left" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.50 0.015 255)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {TESTABLE_EMOTIONS.map(emotion => {
                          const r = comparisonResult[emotion];
                          if (!r) return null;
                          const isSig = r.significance !== 'n.s.';
                          return (
                            <tr key={emotion} style={{ borderBottom: '1px solid oklch(0.22 0.04 255)', background: isSig ? 'oklch(0.22 0.06 270 / 0.4)' : 'transparent' }}>
                              <td className="px-3 py-2">
                                <span className="px-2 py-0.5 rounded text-xs" style={{ background: EMOTION_HEX[emotion] + '20', color: EMOTION_HEX[emotion], fontFamily: 'Noto Sans JP, sans-serif' }}>
                                  {EMOTION_LABELS_JA[emotion]}
                                </span>
                              </td>
                              <td className="px-3 py-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: evA ? evA.color : 'oklch(0.75 0.008 250)' }}>{r.meanA.toFixed(3)}</td>
                              <td className="px-3 py-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: evB ? evB.color : 'oklch(0.75 0.008 250)' }}>{r.meanB.toFixed(3)}</td>
                              <td className="px-3 py-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'oklch(0.75 0.008 250)' }}>{r.t.toFixed(3)}</td>
                              <td className="px-3 py-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'oklch(0.55 0.015 255)' }}>{r.df.toFixed(1)}</td>
                              <td className="px-3 py-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: isSig ? 'oklch(0.78 0.20 140)' : 'oklch(0.55 0.015 255)' }}>{r.p.toFixed(4)}</td>
                              <td className="px-3 py-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'oklch(0.75 0.008 250)' }}>{r.cohensD.toFixed(3)}</td>
                              <td className="px-3 py-2" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.65 0.015 255)' }}>{r.effectSize}</td>
                              <td className="px-3 py-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.85rem', fontWeight: 700, color: isSig ? 'oklch(0.85 0.22 95)' : 'oklch(0.50 0.015 255)' }}>{r.significance}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* 10-second window summary table */}
      <div className="metric-card">
        <div className="section-label mb-3">10-SECOND WINDOWS TABLE</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          10秒区間ごとのサマリー
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '2px solid oklch(0.28 0.04 255)' }}>
                {['時間区間', 'イベント', 'Eng', 'Val', 'Att', '怒', '軽', '嫌', '恐', '喜', '悲', '驚', '感', '困', '主要感情'].map(h => (
                  <th key={h} className="text-left pb-2 pr-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {time_summary_10s.map((row, i) => {
                const rowEvents = events.filter(ev =>
                  ev.startTime < row.time_end && ev.endTime > row.time_start
                );
                return (
                  <tr key={i}
                    style={{
                      borderBottom: '1px solid oklch(0.20 0.04 255)',
                      background: rowEvents.length > 0 ? `${rowEvents[0].color}08` : 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = rowEvents.length > 0 ? `${rowEvents[0].color}15` : 'oklch(0.22 0.04 255)')}
                    onMouseLeave={e => (e.currentTarget.style.background = rowEvents.length > 0 ? `${rowEvents[0].color}08` : 'transparent')}
                  >
                    <td className="py-1.5 pr-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', color: 'oklch(0.45 0.015 250)', whiteSpace: 'nowrap' }}>
                      {row.time_start}–{row.time_end}s
                    </td>
                    <td className="py-1.5 pr-2">
                      <div className="flex gap-1 flex-wrap">
                        {rowEvents.map(ev => (
                          <span key={ev.id} className="px-1.5 py-0.5 rounded text-xs" style={{ background: ev.color + '20', color: ev.color, fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.6rem', border: `1px solid ${ev.color}40`, whiteSpace: 'nowrap' }}>
                            {ev.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    {['engagement_mean', 'valence_mean', 'attention_mean'].map(key => (
                      <td key={key} className="py-1.5 pr-2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem' }}>
                        {((row as any)[key] || 0).toFixed(1)}
                      </td>
                    ))}
                    {['anger_mean', 'contempt_mean', 'disgust_mean', 'fear_mean', 'joy_mean', 'sadness_mean', 'surprise_mean', 'sentimentality_mean', 'confusion_mean'].map((key) => {
                      const val = (row as any)[key] || 0;
                      const emotionKey = key.replace('_mean', '');
                      return (
                        <td key={key} className="py-1.5 pr-2">
                          <span style={{
                            fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem',
                            color: val > 5 ? EMOTION_HEX[emotionKey] : 'oklch(0.58 0.015 255)',
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
                        fontFamily: 'Noto Sans JP, sans-serif',
                        fontSize: '0.65rem',
                        whiteSpace: 'nowrap',
                      }}>
                        {EMOTION_LABELS_JA[row.dominant_emotion] || row.dominant_emotion}
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
