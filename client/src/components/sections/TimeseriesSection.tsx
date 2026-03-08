/*
 * DESIGN: Neuro-Signal Interface
 * Time series visualization with signal wave aesthetic
 * Extended with emotion heatmap, sparklines, stacked area, dominant timeline
 * + Event (intervention) registration with graph highlight and stats
 * + Time range selection for detailed analysis
 */

import { useState, useMemo } from 'react';
import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart, ComposedChart, BarChart, Bar,
  ReferenceArea, ReferenceLine,
} from 'recharts';
import { Plus, Trash2, ChevronDown, ChevronUp, Tag, Clock } from 'lucide-react';

interface Props {
  data: DashboardData;
}

// ---- Event type ----
interface EventAnnotation {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  color: string;
}

// ---- Time Range Selection type ----
interface TimeRangeSelection {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
}

const EVENT_PALETTE = [
  'oklch(0.78 0.14 82)',   /* gold */
  'oklch(0.70 0.14 195)', /* teal */
  'oklch(0.78 0.22 340)', /* hot pink */
  'oklch(0.80 0.18 160)', /* emerald */
  'oklch(0.72 0.22 300)', /* magenta */
  'oklch(0.82 0.22 195)', /* bright cyan */
  'oklch(0.78 0.18 60)',  /* amber */
  'oklch(0.68 0.26 22)',  /* vivid red */
  'oklch(0.88 0.20 82)',  /* bright gold */
  'oklch(0.68 0.20 280)', /* violet */
];

const SPECIAL_COLORS: Record<string, string> = {
  engagement: 'oklch(0.78 0.14 82)',   /* ゴールド */
  valence:    'oklch(0.70 0.14 195)',  /* ティール */
  attention:  'oklch(0.80 0.18 160)', /* エメラルド */
};

// EMOTION_HEX は EMOTION_COLORS (types.ts) に統一
const EMOTION_HEX = EMOTION_COLORS;

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function TimeseriesSection({ data }: Props) {
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(['confusion', 'sadness', 'fear', 'disgust']);
  const [showSpecial, setShowSpecial] = useState<string[]>(['engagement', 'valence']);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, Math.ceil(data.meta.duration_seconds)]);
  const [activeTab, setActiveTab] = useState<'overlay' | 'sparklines' | 'heatmap' | 'stacked' | 'dominant'>('overlay');

  // ---- Event state ----
  const [events, setEvents] = useState<EventAnnotation[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd] = useState('');
  const [eventFormError, setEventFormError] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);

  // ---- Time Range Selection state ----
  const [timeRangeSelections, setTimeRangeSelections] = useState<TimeRangeSelection[]>([]);
  const [newRangeName, setNewRangeName] = useState('');
  const [newRangeStart, setNewRangeStart] = useState('');
  const [newRangeEnd, setNewRangeEnd] = useState('');
  const [rangeFormError, setRangeFormError] = useState('');
  const [showRangeForm, setShowRangeForm] = useState(false);
  const [selectedRangeId, setSelectedRangeId] = useState<string | null>(null);

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
      d => (typeof d.time === 'number' ? d.time : parseFloat(String(d.time))) >= timeRange[0] && (typeof d.time === 'number' ? d.time : parseFloat(String(d.time))) <= timeRange[1]
    );
    const step = Math.max(1, Math.floor(filtered.length / 600));
    return filtered.filter((_, i) => i % step === 0);
  }, [timeseries_full, timeRange]);

  // ヒートマップ用データ（5秒区間）
  const heatmapData = useMemo(() => {
    const bucketSize = 5;
    const buckets: Record<number, Record<string, number[]>> = {};
    for (const frame of timeseries_full) {
      const frameTime = typeof frame.time === 'number' ? frame.time : parseFloat(String(frame.time));
      const bucket = Math.floor(frameTime / bucketSize) * bucketSize;
      if (!buckets[bucket]) buckets[bucket] = {};
      for (const e of NON_NEUTRAL_EMOTIONS) {
        if (!buckets[bucket][e]) buckets[bucket][e] = [];
        buckets[bucket][e].push((frame as any)[e] || 0);
      }
    }
    return Object.entries(buckets)
      .filter(([t]) => {
        const bucketTime = Number(t);
        return bucketTime >= timeRange[0] && bucketTime <= timeRange[1];
      })
      .map(([t, emotions]) => ({
        time: Number(t),
        ...Object.fromEntries(
          NON_NEUTRAL_EMOTIONS.map(e => [e, emotions[e]?.length > 0 ? emotions[e].reduce((a, b) => a + b) / emotions[e].length : 0])
        ),
      }));
  }, [timeseries_full, timeRange]);

  // スタック面用データ（10秒区間）
  const stackedData = useMemo(() => {
    return time_summary_10s
      .filter(d => {
        const dTime = typeof d.time === 'number' ? d.time : parseFloat(String(d.time));
        return dTime >= timeRange[0] && dTime <= timeRange[1];
      })
      .map(d => ({
        time: d.time,
        ...Object.fromEntries(NON_NEUTRAL_EMOTIONS.map(e => [e, (d as any)[e] || 0]))
      }));
  }, [time_summary_10s, timeRange]);

  // 支配感情タイムライン（10秒区間）
  const dominantTimeline = useMemo(() => {
    return time_summary_10s
      .filter(d => {
        const dTime = typeof d.time === 'number' ? d.time : parseFloat(String(d.time));
        return dTime >= timeRange[0] && dTime <= timeRange[1];
      })
      .map(d => {
        const scores = NON_NEUTRAL_EMOTIONS.map(e => ({ emotion: e, score: (d as any)[e] || 0 }));
        const dominant = scores.reduce((a, b) => a.score > b.score ? a : b);
        return {
          time: d.time,
          dominant: dominant.emotion,
          score: dominant.score,
        };
      });
  }, [time_summary_10s, timeRange]);

  // ---- Time Range Selection Logic ----
  const addTimeRange = () => {
    setRangeFormError('');
    const start = parseFloat(newRangeStart);
    const end = parseFloat(newRangeEnd);
    if (!newRangeName.trim()) {
      setRangeFormError('区間名を入力してください');
      return;
    }
    if (isNaN(start) || isNaN(end) || start < 0 || end > maxTime || start >= end) {
      setRangeFormError('有効な時間範囲を入力してください');
      return;
    }
    setTimeRangeSelections([...timeRangeSelections, { id: generateId(), name: newRangeName, startTime: start, endTime: end }]);
    setNewRangeName('');
    setNewRangeStart('');
    setNewRangeEnd('');
    setShowRangeForm(false);
  };

  const removeTimeRange = (id: string) => {
    setTimeRangeSelections(timeRangeSelections.filter(r => r.id !== id));
    if (selectedRangeId === id) setSelectedRangeId(null);
  };

  // 選択された区間のデータ分析
  const selectedRangeAnalysis = useMemo(() => {
    if (!selectedRangeId) return null;
    const range = timeRangeSelections.find(r => r.id === selectedRangeId);
    if (!range) return null;

    const rangeData = timeseries_full.filter(d => d.time >= range.startTime && d.time <= range.endTime);
    if (rangeData.length === 0) return null;

    const emotionStats: Record<string, { mean: number; max: number; min: number }> = {};
    for (const e of NON_NEUTRAL_EMOTIONS) {
      const values = rangeData.map(d => (d as any)[e] || 0);
      emotionStats[e] = {
        mean: values.reduce((a, b) => a + b) / values.length,
        max: Math.max(...values),
        min: Math.min(...values),
      };
    }

    const engagementValues = rangeData.map(d => (d as any).engagement || 0);
    const valenceValues = rangeData.map(d => (d as any).valence || 0);
    const attentionValues = rangeData.map(d => (d as any).attention || 0);

    return {
      duration: range.endTime - range.startTime,
      frameCount: rangeData.length,
      emotionStats,
      engagement: {
        mean: engagementValues.reduce((a, b) => a + b) / engagementValues.length,
        max: Math.max(...engagementValues),
      },
      valence: {
        mean: valenceValues.reduce((a, b) => a + b) / valenceValues.length,
        max: Math.max(...valenceValues),
      },
      attention: {
        mean: attentionValues.reduce((a, b) => a + b) / attentionValues.length,
        max: Math.max(...attentionValues),
      },
    };
  }, [selectedRangeId, timeRangeSelections, timeseries_full]);

  // ---- Event Logic ----
  const addEvent = () => {
    setEventFormError('');
    const start = parseFloat(newEventStart);
    const end = parseFloat(newEventEnd);
    if (!newEventName.trim()) {
      setEventFormError('イベント名を入力してください');
      return;
    }
    if (isNaN(start) || isNaN(end) || start < 0 || end > maxTime || start >= end) {
      setEventFormError('有効な時間範囲を入力してください');
      return;
    }
    const colorIndex = events.length % EVENT_PALETTE.length;
    setEvents([...events, { id: generateId(), name: newEventName, startTime: start, endTime: end, color: EVENT_PALETTE[colorIndex] }]);
    setNewEventName('');
    setNewEventStart('');
    setNewEventEnd('');
    setShowEventForm(false);
  };

  const removeEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
    if (expandedEventId === id) setExpandedEventId(null);
  };

  // イベント中の感情統計
  const eventStats = useMemo(() => {
    if (!expandedEventId) return null;
    const event = events.find(e => e.id === expandedEventId);
    if (!event) return null;

    const eventData = timeseries_full.filter(d => d.time >= event.startTime && d.time <= event.endTime);
    if (eventData.length === 0) return null;

    const emotionStats: Record<string, { mean: number; max: number }> = {};
    for (const e of NON_NEUTRAL_EMOTIONS) {
      const values = eventData.map(d => (d as any)[e] || 0);
      emotionStats[e] = {
        mean: values.reduce((a, b) => a + b) / values.length,
        max: Math.max(...values),
      };
    }

    const engagementValues = eventData.map(d => (d as any).engagement || 0);
    const valenceValues = eventData.map(d => (d as any).valence || 0);
    const attentionValues = eventData.map(d => (d as any).attention || 0);

    const dominantEmotions = Object.entries(emotionStats)
      .sort((a, b) => b[1].mean - a[1].mean)
      .slice(0, 3);

    return {
      duration: event.endTime - event.startTime,
      frameCount: eventData.length,
      emotionStats,
      engagement: {
        mean: engagementValues.reduce((a, b) => a + b) / engagementValues.length,
        max: Math.max(...engagementValues),
      },
      valence: {
        mean: valenceValues.reduce((a, b) => a + b) / valenceValues.length,
        max: Math.max(...valenceValues),
      },
      attention: {
        mean: attentionValues.reduce((a, b) => a + b) / attentionValues.length,
        max: Math.max(...attentionValues),
      },
      dominantEmotions,
    };
  }, [expandedEventId, events, timeseries_full]);

  return (
    <section className="space-y-6">
      {/* ---- Time Range Selection Panel ---- */}
      <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-teal-400" />
          <h3 className="text-lg font-semibold text-gray-100">区間別分析</h3>
        </div>

        {/* Time Range List */}
        <div className="space-y-2">
          {timeRangeSelections.map(range => (
            <div
              key={range.id}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                selectedRangeId === range.id
                  ? 'bg-teal-900 border-teal-500'
                  : 'bg-navy-700 border-navy-600 hover:border-teal-500'
              }`}
              onClick={() => setSelectedRangeId(selectedRangeId === range.id ? null : range.id)}
            >
              <div className="flex-1">
                <p className="font-medium text-gray-100">{range.name}</p>
                <p className="text-sm text-gray-400">{range.startTime.toFixed(1)}s - {range.endTime.toFixed(1)}s</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTimeRange(range.id);
                }}
                className="p-1 hover:bg-red-900 rounded transition"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Time Range Form */}
        {!showRangeForm ? (
          <button
            onClick={() => setShowRangeForm(true)}
            className="w-full py-2 px-3 bg-teal-900 hover:bg-teal-800 text-teal-100 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4" /> 区間を追加
          </button>
        ) : (
          <div className="bg-navy-700 p-3 rounded-lg space-y-2">
            <input
              type="text"
              placeholder="区間名（例：介入前）"
              value={newRangeName}
              onChange={(e) => setNewRangeName(e.target.value)}
              className="w-full px-3 py-2 bg-navy-600 border border-navy-500 rounded text-gray-100 placeholder-gray-500"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="開始時間（秒）"
                value={newRangeStart}
                onChange={(e) => setNewRangeStart(e.target.value)}
                className="flex-1 px-3 py-2 bg-navy-600 border border-navy-500 rounded text-gray-100 placeholder-gray-500"
              />
              <input
                type="number"
                placeholder="終了時間（秒）"
                value={newRangeEnd}
                onChange={(e) => setNewRangeEnd(e.target.value)}
                className="flex-1 px-3 py-2 bg-navy-600 border border-navy-500 rounded text-gray-100 placeholder-gray-500"
              />
            </div>
            {rangeFormError && <p className="text-sm text-red-400">{rangeFormError}</p>}
            <div className="flex gap-2">
              <button
                onClick={addTimeRange}
                className="flex-1 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded transition"
              >
                追加
              </button>
              <button
                onClick={() => setShowRangeForm(false)}
                className="flex-1 py-2 bg-navy-600 hover:bg-navy-500 text-gray-300 rounded transition"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Selected Range Analysis */}
        {selectedRangeAnalysis && (
          <div className="bg-navy-700 p-4 rounded-lg border border-teal-500 space-y-3">
            <h4 className="font-semibold text-teal-100">区間分析結果</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-navy-600 p-3 rounded">
                <p className="text-xs text-gray-400">区間長</p>
                <p className="text-lg font-semibold text-teal-300">{selectedRangeAnalysis.duration.toFixed(1)}秒</p>
              </div>
              <div className="bg-navy-600 p-3 rounded">
                <p className="text-xs text-gray-400">フレーム数</p>
                <p className="text-lg font-semibold text-teal-300">{selectedRangeAnalysis.frameCount}</p>
              </div>
              <div className="bg-navy-600 p-3 rounded">
                <p className="text-xs text-gray-400">Engagement平均</p>
                <p className="text-lg font-semibold text-gold-300">{selectedRangeAnalysis.engagement.mean.toFixed(2)}</p>
              </div>
              <div className="bg-navy-600 p-3 rounded">
                <p className="text-xs text-gray-400">Valence平均</p>
                <p className="text-lg font-semibold text-teal-300">{selectedRangeAnalysis.valence.mean.toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-navy-600 p-3 rounded">
              <p className="text-xs text-gray-400 mb-2">感情スコア（平均値）</p>
              <div className="space-y-1">
                {NON_NEUTRAL_EMOTIONS.map(e => (
                  <div key={e} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{EMOTION_LABELS_JA[e]}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-navy-500 rounded overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.min(100, selectedRangeAnalysis.emotionStats[e].mean * 10)}%`,
                            backgroundColor: EMOTION_HEX[e],
                          }}
                        />
                      </div>
                      <span className="text-gray-400 w-10 text-right">{selectedRangeAnalysis.emotionStats[e].mean.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- Event Panel (existing) ---- */}
      <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-gold-400" />
          <h3 className="text-lg font-semibold text-gray-100">イベント（介入）</h3>
        </div>

        {/* Event List */}
        <div className="space-y-2">
          {events.map(event => (
            <div key={event.id} className="bg-navy-700 rounded-lg border border-navy-600 overflow-hidden">
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-navy-600 transition"
                onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: event.color }} />
                  <div>
                    <p className="font-medium text-gray-100">{event.name}</p>
                    <p className="text-sm text-gray-400">{event.startTime.toFixed(1)}s - {event.endTime.toFixed(1)}s</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {expandedEventId === event.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeEvent(event.id);
                    }}
                    className="p-1 hover:bg-red-900 rounded transition"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>

              {/* Event Stats */}
              {expandedEventId === event.id && eventStats && (
                <div className="bg-navy-600 p-3 border-t border-navy-500 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-navy-700 p-2 rounded">
                      <p className="text-xs text-gray-400">区間長</p>
                      <p className="text-sm font-semibold text-gray-100">{eventStats.duration.toFixed(1)}秒</p>
                    </div>
                    <div className="bg-navy-700 p-2 rounded">
                      <p className="text-xs text-gray-400">フレーム数</p>
                      <p className="text-sm font-semibold text-gray-100">{eventStats.frameCount}</p>
                    </div>
                    <div className="bg-navy-700 p-2 rounded">
                      <p className="text-xs text-gray-400">Engagement</p>
                      <p className="text-sm font-semibold text-gold-300">{eventStats.engagement.mean.toFixed(2)}</p>
                    </div>
                    <div className="bg-navy-700 p-2 rounded">
                      <p className="text-xs text-gray-400">Valence</p>
                      <p className="text-sm font-semibold text-teal-300">{eventStats.valence.mean.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="bg-navy-700 p-2 rounded">
                    <p className="text-xs text-gray-400 mb-1">主要感情</p>
                    <div className="space-y-1">
                      {eventStats.dominantEmotions.map(([emotion, stats]) => (
                        <div key={emotion} className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">{EMOTION_LABELS_JA[emotion]}</span>
                          <span className="text-gray-400">{stats.mean.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Event Form */}
        {!showEventForm ? (
          <button
            onClick={() => setShowEventForm(true)}
            className="w-full py-2 px-3 bg-gold-900 hover:bg-gold-800 text-gold-100 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4" /> イベントを追加
          </button>
        ) : (
          <div className="bg-navy-700 p-3 rounded-lg space-y-2">
            <input
              type="text"
              placeholder="イベント名"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              className="w-full px-3 py-2 bg-navy-600 border border-navy-500 rounded text-gray-100 placeholder-gray-500"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="開始時間（秒）"
                value={newEventStart}
                onChange={(e) => setNewEventStart(e.target.value)}
                className="flex-1 px-3 py-2 bg-navy-600 border border-navy-500 rounded text-gray-100 placeholder-gray-500"
              />
              <input
                type="number"
                placeholder="終了時間（秒）"
                value={newEventEnd}
                onChange={(e) => setNewEventEnd(e.target.value)}
                className="flex-1 px-3 py-2 bg-navy-600 border border-navy-500 rounded text-gray-100 placeholder-gray-500"
              />
            </div>
            {eventFormError && <p className="text-sm text-red-400">{eventFormError}</p>}
            <div className="flex gap-2">
              <button
                onClick={addEvent}
                className="flex-1 py-2 bg-gold-700 hover:bg-gold-600 text-white rounded transition"
              >
                追加
              </button>
              <button
                onClick={() => setShowEventForm(false)}
                className="flex-1 py-2 bg-navy-600 hover:bg-navy-500 text-gray-300 rounded transition"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Time Range Presets & Controls ---- */}
      <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 space-y-3">
        <h3 className="text-lg font-semibold text-gray-100">時間範囲プリセット</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {TIME_PRESETS.map(([start, end, label]) => (
            <button
              key={label}
              onClick={() => setTimeRange([start, end])}
              className={`py-2 px-3 rounded-lg transition ${
                timeRange[0] === start && timeRange[1] === end
                  ? 'bg-teal-700 text-white'
                  : 'bg-navy-700 hover:bg-navy-600 text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Tab Selection ---- */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['overlay', 'sparklines', 'heatmap', 'stacked', 'dominant'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
              activeTab === tab
                ? 'bg-teal-700 text-white'
                : 'bg-navy-700 hover:bg-navy-600 text-gray-300'
            }`}
          >
            {tab === 'overlay' && 'オーバーレイ'}
            {tab === 'sparklines' && '個別波形'}
            {tab === 'heatmap' && 'ヒートマップ'}
            {tab === 'stacked' && 'スタック面'}
            {tab === 'dominant' && '支配感情'}
          </button>
        ))}
      </div>

      {/* ---- Tab Content ---- */}
      {activeTab === 'overlay' && (
        <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-100">感情スコア（オーバーレイ）</h3>
          <div className="flex flex-wrap gap-2">
            {NON_NEUTRAL_EMOTIONS.map(e => (
              <button
                key={e}
                onClick={() => setSelectedEmotions(
                  selectedEmotions.includes(e)
                    ? selectedEmotions.filter(x => x !== e)
                    : [...selectedEmotions, e]
                )}
                className={`px-3 py-1 rounded-full text-sm transition ${
                  selectedEmotions.includes(e)
                    ? 'text-white'
                    : 'bg-navy-700 text-gray-400 hover:text-gray-300'
                }`}
                style={selectedEmotions.includes(e) ? { backgroundColor: EMOTION_HEX[e] } : {}}
              >
                {EMOTION_LABELS_JA[e]}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={sampledData}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 250)" />
              <XAxis dataKey="time" stroke="oklch(0.6 0.04 250)" />
              <YAxis stroke="oklch(0.6 0.04 250)" />
              <Tooltip contentStyle={{ backgroundColor: 'oklch(0.18 0.02 250)', border: '1px solid oklch(0.4 0.04 250)' }} />
              <Legend />
              {selectedEmotions.map(e => (
                <Line key={e} type="monotone" dataKey={e} stroke={EMOTION_HEX[e]} dot={false} isAnimationActive={false} />
              ))}
              {showSpecial.map(s => (
                <Line key={s} type="monotone" dataKey={s} stroke={SPECIAL_COLORS[s]} dot={false} isAnimationActive={false} strokeDasharray="5 5" />
              ))}
              {events.map(event => (
                <ReferenceArea key={event.id} x1={event.startTime} x2={event.endTime} fill={event.color} fillOpacity={0.1} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'sparklines' && (
        <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-100">感情スコア（個別波形）</h3>
          <div className="space-y-4">
            {NON_NEUTRAL_EMOTIONS.map(e => {
              const emotionData = sampledData.map(d => ({ time: d.time, value: (d as any)[e] || 0 }));
              const values = emotionData.map(d => d.value);
              const max = Math.max(...values);
              const avg = values.reduce((a, b) => a + b) / values.length;
              return (
                <div key={e} className="bg-navy-700 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-100 font-medium">{EMOTION_LABELS_JA[e]}</span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-400">最大: <span className="text-gray-100 font-semibold">{max.toFixed(2)}</span></span>
                      <span className="text-gray-400">平均: <span className="text-gray-100 font-semibold">{avg.toFixed(2)}</span></span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={emotionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 250)" />
                      <XAxis dataKey="time" stroke="oklch(0.6 0.04 250)" tick={false} />
                      <YAxis stroke="oklch(0.6 0.04 250)" tick={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'oklch(0.18 0.02 250)', border: '1px solid oklch(0.4 0.04 250)' }} />
                      <Line type="monotone" dataKey="value" stroke={EMOTION_HEX[e]} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'heatmap' && (
        <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-100">感情ヒートマップ（5秒区間）</h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={heatmapData}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 250)" />
              <XAxis dataKey="time" stroke="oklch(0.6 0.04 250)" />
              <YAxis stroke="oklch(0.6 0.04 250)" />
              <Tooltip contentStyle={{ backgroundColor: 'oklch(0.18 0.02 250)', border: '1px solid oklch(0.4 0.04 250)' }} />
              <Legend />
              {NON_NEUTRAL_EMOTIONS.map(e => (
                <Area key={e} type="monotone" dataKey={e} stackId="1" stroke={EMOTION_HEX[e]} fill={EMOTION_HEX[e]} fillOpacity={0.6} />
              ))}
              {events.map(event => (
                <ReferenceArea key={event.id} x1={event.startTime} x2={event.endTime} fill={event.color} fillOpacity={0.05} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'stacked' && (
        <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-100">感情構成比（スタック面）</h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={stackedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 250)" />
              <XAxis dataKey="time" stroke="oklch(0.6 0.04 250)" />
              <YAxis stroke="oklch(0.6 0.04 250)" />
              <Tooltip contentStyle={{ backgroundColor: 'oklch(0.18 0.02 250)', border: '1px solid oklch(0.4 0.04 250)' }} />
              <Legend />
              {NON_NEUTRAL_EMOTIONS.map(e => (
                <Area key={e} type="monotone" dataKey={e} stackId="1" stroke={EMOTION_HEX[e]} fill={EMOTION_HEX[e]} fillOpacity={0.7} />
              ))}
              {events.map(event => (
                <ReferenceArea key={event.id} x1={event.startTime} x2={event.endTime} fill={event.color} fillOpacity={0.05} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'dominant' && (
        <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-100">支配感情タイムライン</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dominantTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 250)" />
              <XAxis dataKey="time" stroke="oklch(0.6 0.04 250)" />
              <YAxis stroke="oklch(0.6 0.04 250)" />
              <Tooltip contentStyle={{ backgroundColor: 'oklch(0.18 0.02 250)', border: '1px solid oklch(0.4 0.04 250)' }} />
              <Bar dataKey="score" radius={[4, 4, 0, 0]} fill="oklch(0.78 0.14 82)" activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
                {dominantTimeline.map((entry, index) => (
                  <Bar key={index} dataKey="score" fill={EMOTION_HEX[entry.dominant]} />
                ))}
              </Bar>
              {events.map(event => (
                <ReferenceArea key={event.id} x1={event.startTime} x2={event.endTime} fill={event.color} fillOpacity={0.05} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ---- 10s Summary Table ---- */}
      <div className="bg-navy-800 border border-navy-700 rounded-lg p-4 space-y-3">
        <h3 className="text-lg font-semibold text-gray-100">10秒区間サマリー</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-600">
                <th className="text-left py-2 px-3 text-gray-300">時間</th>
                {NON_NEUTRAL_EMOTIONS.map(e => (
                  <th key={e} className="text-right py-2 px-2 text-gray-400">{EMOTION_LABELS_JA[e]}</th>
                ))}
                <th className="text-right py-2 px-2 text-gray-400">Eng</th>
                <th className="text-right py-2 px-2 text-gray-400">Val</th>
                <th className="text-center py-2 px-2 text-gray-400">イベント</th>
              </tr>
            </thead>
            <tbody>
              {time_summary_10s
                .filter(d => {
                  const dTime = typeof d.time === 'number' ? d.time : parseFloat(String(d.time));
                  return dTime >= timeRange[0] && dTime <= timeRange[1];
                })
                .map((row, idx) => {
                  const rowTime = typeof row.time === 'number' ? row.time : parseFloat(String(row.time));
                  const rowEvents = events.filter(e => e.startTime <= rowTime && rowTime < e.endTime);
                  return (
                    <tr key={idx} className="border-b border-navy-700 hover:bg-navy-700 transition">
                      <td className="py-2 px-3 text-gray-300 font-medium">{rowTime.toFixed(1)}s</td>
                      {NON_NEUTRAL_EMOTIONS.map(e => (
                        <td key={e} className="text-right py-2 px-2 text-gray-400">{((row as any)[e] || 0).toFixed(2)}</td>
                      ))}
                      <td className="text-right py-2 px-2 text-gold-300">{((row as any).engagement || 0).toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-teal-300">{((row as any).valence || 0).toFixed(2)}</td>
                      <td className="text-center py-2 px-2">
                        {rowEvents.map(e => (
                          <span key={e.id} className="inline-block px-2 py-1 rounded text-xs text-white mr-1" style={{ backgroundColor: e.color }}>
                            {e.name}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
