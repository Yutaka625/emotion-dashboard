/**
 * DESIGN: Neuro-Signal Interface
 * Time series visualization — リファクタリング済み
 *
 * 子コンポーネント構成:
 *   BaselineSettingsCard  — ベースライン補正設定
 *   SmoothingSettingsCard — スムージング設定
 *   EmotionChartsCard     — 感情時系列グラフ（タブ切り替え）+ 特殊指標
 *   EventAnnotationsCard  — イベント登録・統計・区間比較
 */

import { useState, useMemo } from 'react';
import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import { Target, Download, RotateCcw } from 'lucide-react';
import { useBaseline } from '@/contexts/BaselineContext';
import { useEvents } from '@/contexts/EventsContext';
import { applyBaselineCorrection } from '@/lib/csvAnalyzer';
import { applySmoothing, type SmoothingMethod } from '@/lib/smoothingUtils';

import CollapsibleCard       from '@/components/ui/CollapsibleCard';
import BaselineSettingsCard  from './timeseries/BaselineSettingsCard';
import SmoothingSettingsCard from './timeseries/SmoothingSettingsCard';
import EmotionChartsCard     from './timeseries/EmotionChartsCard';
import EventAnnotationsCard  from './timeseries/EventAnnotationsCard';

interface Props {
  data: DashboardData;
}

type TabId = 'overlay' | 'sparklines' | 'heatmap' | 'stacked' | 'dominant';

const EMOTION_HEX = EMOTION_COLORS;

export default function TimeseriesSection({ data }: Props) {
  // ---- 感情グラフ選択 state ----
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(['anger', 'sadness', 'surprise', 'disgust', 'fear', 'joy']);
  const [showSpecial, setShowSpecial]           = useState<string[]>(['engagement', 'valence', 'attention']);
  const [activeTab, setActiveTab]               = useState<TabId>('overlay');

  // ---- 時間範囲フィルタ state ----
  const [timeRange, setTimeRange] = useState<[number, number]>([0, Math.ceil(data.meta.duration_seconds)]);
  const maxTime = Math.ceil(data.meta.duration_seconds);

  // ---- スムージング state ----
  const [smoothingMethod, setSmoothingMethod]   = useState<SmoothingMethod>('none');
  const [smoothingWindow, setSmoothingWindow]   = useState(15);
  const [smoothingAlpha, setSmoothingAlpha]     = useState(0.25);

  // ---- 変化点 state ----
  const [showChangePoints, _setShowChangePoints] = useState(false);

  const { events } = useEvents();
  const { baselineOffsets, isBaselineActive } = useBaseline();
  const { timeseries_full, time_summary_10s } = data;

  const TIME_PRESETS: [number, number, string][] = useMemo(() => [
    [0, maxTime, '全体'],
    [0, 60,      '0-60s'],
    [60, 120,    '60-120s'],
    [120, 180,   '120-180s'],
    [180, maxTime, `180-${maxTime}s`],
  ], [maxTime]);

  // フィルタリング＆サンプリング（最大600点）
  const sampledData = useMemo(() => {
    const filtered = timeseries_full.filter(d => d.time >= timeRange[0] && d.time <= timeRange[1]);
    const step = Math.max(1, Math.floor(filtered.length / 600));
    return filtered.filter((_, i) => i % step === 0);
  }, [timeseries_full, timeRange]);

  // ベースライン補正 → スムージング の順で処理
  const displayData = useMemo(() => {
    const corrected = isBaselineActive && baselineOffsets
      ? applyBaselineCorrection(sampledData, baselineOffsets)
      : sampledData;
    const smoothParam = smoothingMethod === 'ema' ? smoothingAlpha : smoothingWindow;
    return applySmoothing(corrected, smoothingMethod, smoothParam);
  }, [sampledData, isBaselineActive, baselineOffsets, smoothingMethod, smoothingWindow, smoothingAlpha]);

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

  // ヒートマップの最大値（困惑を除いた相対スケール）
  const heatmapMax = useMemo(() => {
    let max = 0;
    for (const row of heatmapData) {
      for (const e of NON_NEUTRAL_EMOTIONS) {
        if (e !== 'confusion' && (row[e] as number) > max) max = row[e] as number;
      }
    }
    return max || 1;
  }, [heatmapData]);

  // イベント区間ごとの感情統計
  const eventStats = useMemo(() => {
    return events.map(ev => {
      const frames = displayTimeseriesFull.filter(f => f.time >= ev.startTime && f.time <= ev.endTime);
      if (frames.length === 0) return { id: ev.id, frameCount: 0, stats: {} as Record<string, { mean: number; max: number }>, dominantEmotion: 'confusion' };
      const stats: Record<string, { mean: number; max: number }> = {};
      const allCols = [...NON_NEUTRAL_EMOTIONS, 'engagement', 'valence', 'attention'];
      for (const col of allCols) {
        const vals = frames.map(f => (f as any)[col] as number || 0);
        stats[col] = { mean: vals.reduce((a, b) => a + b, 0) / vals.length, max: Math.max(...vals) };
      }
      let domEmo = 'confusion';
      let domVal = -Infinity;
      for (const e of NON_NEUTRAL_EMOTIONS) {
        if (stats[e].mean > domVal) { domVal = stats[e].mean; domEmo = e; }
      }
      return { id: ev.id, frameCount: frames.length, stats, dominantEmotion: domEmo };
    });
  }, [events, displayTimeseriesFull]);

  // 現在の時間範囲内の変化点
  const visibleChangePoints = useMemo(() =>
    (data.change_points || []).filter(cp => cp.time >= timeRange[0] && cp.time <= timeRange[1]),
    [data.change_points, timeRange]
  );

  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions(prev => prev.includes(emotion) ? prev.filter(e => e !== emotion) : [...prev, emotion]);
  };

  const toggleSpecial = (key: string) => {
    setShowSpecial(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // CSV エクスポート（現在の表示範囲）
  const exportFilteredDataToCSV = () => {
    const filteredData = timeseries_full.filter(d => d.time >= timeRange[0] && d.time <= timeRange[1]);
    if (filteredData.length === 0) { alert('フィルタリング範囲にデータがありません'); return; }
    const headers = ['time', ...NON_NEUTRAL_EMOTIONS, 'engagement', 'valence', 'attention'];
    for (let i = 1; i <= 45; i++) headers.push(`AU${String(i).padStart(2, '0')}`);
    const rows = filteredData.map(row => {
      const values: (string | number)[] = [row.time, ...NON_NEUTRAL_EMOTIONS.map(e => (row as any)[e] ?? 0), row.engagement ?? 0, row.valence ?? 0, row.attention ?? 0];
      for (let i = 1; i <= 45; i++) values.push((row as any)[`AU${String(i).padStart(2, '0')}`] ?? 0);
      return values;
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => typeof v === 'number' ? v.toFixed(3) : v).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `emotion_data_${timeRange[0]}-${timeRange[1]}s.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { setBaseline, isBaselineActive: _isActive } = useBaseline();

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

      {/* ---- TIME RANGE FILTER ---- */}
      <CollapsibleCard
        label="TIME RANGE FILTER"
        title="表示範囲フィルタ"
        info="つまみで分析対象の時間範囲を絞り込みます。左つまみ＝開始・右つまみ＝終了（0.1秒単位）。"
        storageKey="ksdv.collapse.timerange"
        badge={
          /* リセット: 全範囲 [0, 録画長] に戻す。範囲が初期状態のときは無効化 */
          <button
            onClick={() => setTimeRange([0, maxTime])}
            disabled={timeRange[0] === 0 && timeRange[1] === maxTime}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontFamily: 'Noto Sans JP, sans-serif', background: 'oklch(0.22 0.04 255)', color: 'oklch(0.72 0.008 250)', border: '1px solid oklch(0.32 0.04 255)' }}
            title="表示範囲を全区間にリセットする"
          >
            <RotateCcw size={12} />
            リセット
          </button>
        }
      >
        <div className="flex items-center gap-3 mb-2">
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'oklch(0.45 0.015 250)', minWidth: '32px' }}>
            {timeRange[0].toFixed(1)}s
          </span>
          <div className="flex-1 relative h-6 flex items-center">
            <div className="absolute w-full h-1 rounded-full" style={{ background: 'oklch(0.28 0.04 255)' }} />
            <div className="absolute h-1 rounded-full" style={{ left: `${(timeRange[0] / maxTime) * 100}%`, right: `${100 - (timeRange[1] / maxTime) * 100}%`, background: 'oklch(0.62 0.18 160)' }} />
            {/* 開始ハンドル: つまみ（左）をドラッグすると開始時間が変わる。
                開始つまみが中央より右にあるときは終了ハンドルより前面に出し、重なっても掴めるようにする */}
            <input type="range" min={0} max={maxTime} step={0.1} value={timeRange[0]}
              onChange={e => {
                // 0.1秒刻み。終了との最小間隔は0.1秒。小数1桁に丸めて浮動小数の誤差を防ぐ
                const v = Math.round(Math.min(Number(e.target.value), timeRange[1] - 0.1) * 10) / 10;
                setTimeRange([v, timeRange[1]]);
              }}
              className="range-thumb absolute w-full h-6"
              style={{ zIndex: timeRange[0] > maxTime / 2 ? 4 : 2 }}
              aria-label="開始時間"
            />
            {/* 終了ハンドル: つまみ（右）をドラッグすると終了時間が変わる */}
            <input type="range" min={0} max={maxTime} step={0.1} value={timeRange[1]}
              onChange={e => {
                // 0.1秒刻み。開始との最小間隔は0.1秒。小数1桁に丸めて浮動小数の誤差を防ぐ
                const v = Math.round(Math.max(Number(e.target.value), timeRange[0] + 0.1) * 10) / 10;
                setTimeRange([timeRange[0], v]);
              }}
              className="range-thumb absolute w-full h-6"
              style={{ zIndex: 3 }}
              aria-label="終了時間"
            />
          </div>
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'oklch(0.45 0.015 250)', minWidth: '32px', textAlign: 'right' }}>
            {timeRange[1].toFixed(1)}s
          </span>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* 数値入力 */}
          {(['開始', '終了'] as const).map((label, idx) => (
            <div key={label} className="flex gap-2 items-center">
              <label style={{ fontSize: '0.75rem', color: 'oklch(0.45 0.015 250)' }}>{label}:</label>
              <input
                type="number" min={0} max={maxTime} step={0.1}
                value={timeRange[idx]}
                onChange={e => {
                  const v = Number(e.target.value);
                  if (idx === 0) setTimeRange([Math.min(v, timeRange[1] - 0.1), timeRange[1]]);
                  else           setTimeRange([timeRange[0], Math.max(v, timeRange[0] + 0.1)]);
                }}
                className="w-16 px-2 py-1 rounded text-xs"
                style={{ fontFamily: 'Roboto Mono, monospace', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.85 0.005 65)', border: '1px solid oklch(0.28 0.04 255)' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'oklch(0.45 0.015 250)' }}>秒</span>
            </div>
          ))}

          {/* イベントズームボタン */}
          {events.map(ev => (
            <button key={ev.id}
              onClick={() => setTimeRange([Math.max(0, ev.startTime - 5), Math.min(maxTime, ev.endTime + 5)])}
              className="px-2.5 py-1 rounded text-xs transition-all flex items-center gap-1"
              style={{ fontFamily: 'Noto Sans JP, sans-serif', background: ev.color + '18', color: ev.color, border: `1px solid ${ev.color}50` }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: ev.color }} />
              {ev.name}
            </button>
          ))}

          {/* ベースラインとして設定 */}
          <button
            onClick={() => setBaseline(timeRange, data.timeseries_full)}
            className="px-3 py-1 rounded text-xs transition-all flex items-center gap-1"
            style={{ fontFamily: 'Noto Sans JP, sans-serif', background: isBaselineActive ? 'rgba(0,180,216,0.20)' : 'oklch(0.22 0.04 255)', color: isBaselineActive ? 'oklch(0.70 0.14 195)' : 'oklch(0.72 0.008 250)', border: `1px solid ${isBaselineActive ? 'rgba(0,180,216,0.5)' : 'oklch(0.32 0.04 255)'}` }}
            title="現在の表示範囲をベースライン区間として設定する"
          >
            <Target size={14} />
            ベースラインとして設定
          </button>

          {/* CSV エクスポート */}
          <button onClick={exportFilteredDataToCSV}
            className="px-3 py-1 rounded text-xs transition-all flex items-center gap-1 ml-auto"
            style={{ fontFamily: 'Noto Sans JP, sans-serif', background: 'oklch(0.32 0.12 160)', color: 'white', border: '1px solid oklch(0.52 0.18 160)' }}
            title="フィルタリング範囲のデータをCSVでダウンロード"
          >
            <Download size={14} />
            CSV出力
          </button>
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.58 0.015 255)', alignSelf: 'center', marginLeft: '4px' }}>
            {sampledData.length} pts表示中
          </span>
        </div>
      </CollapsibleCard>

      {/* ---- BASELINE SETTINGS カード ---- */}
      <BaselineSettingsCard timeseriesFull={data.timeseries_full} />

      {/* ---- SMOOTHING SETTINGS カード ---- */}
      <SmoothingSettingsCard
        smoothingMethod={smoothingMethod} setSmoothingMethod={setSmoothingMethod}
        smoothingWindow={smoothingWindow} setSmoothingWindow={setSmoothingWindow}
        smoothingAlpha={smoothingAlpha}   setSmoothingAlpha={setSmoothingAlpha}
        fpsAvg={data.meta.fps_avg}
      />

      {/* ---- EMOTION CHARTS + SPECIAL METRICS カード ---- */}
      <EmotionChartsCard
        displayData={displayData}
        heatmapData={heatmapData}
        stackedData={stackedData}
        dominantTimeline={dominantTimeline}
        heatmapMax={heatmapMax}
        sampledLength={sampledData.length}
        visibleChangePoints={visibleChangePoints}
        maxTime={maxTime}
        durationSeconds={data.meta.duration_seconds}
        selectedEmotions={selectedEmotions}
        toggleEmotion={toggleEmotion}
        showSpecial={showSpecial}
        toggleSpecial={toggleSpecial}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* ---- EVENT ANNOTATIONS カード ---- */}
      <EventAnnotationsCard
        eventStats={eventStats}
        maxTime={maxTime}
        displayTimeseriesFull={displayTimeseriesFull}
        onZoomEvent={(start, end) => setTimeRange([Math.max(0, start - 5), Math.min(maxTime, end + 5)])}
      />

      {/* ---- 10秒区間サマリーテーブル ---- */}
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
                const rowEvents = events.filter(ev => ev.startTime < row.time_end && ev.endTime > row.time_start);
                return (
                  <tr key={i}
                    style={{ borderBottom: '1px solid oklch(0.20 0.04 255)', background: rowEvents.length > 0 ? `${rowEvents[0].color}08` : 'transparent' }}
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
                    {['anger_mean', 'contempt_mean', 'disgust_mean', 'fear_mean', 'joy_mean', 'sadness_mean', 'surprise_mean', 'sentimentality_mean', 'confusion_mean'].map(key => {
                      const val = (row as any)[key] || 0;
                      const emotionKey = key.replace('_mean', '');
                      return (
                        <td key={key} className="py-1.5 pr-2">
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', color: val > 5 ? EMOTION_HEX[emotionKey] : 'oklch(0.58 0.015 255)', fontWeight: val > 5 ? 600 : 400 }}>
                            {val.toFixed(1)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-1.5">
                      <span className="px-1.5 py-0.5 rounded-full" style={{ background: EMOTION_HEX[row.dominant_emotion] + '25', color: EMOTION_HEX[row.dominant_emotion], fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
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
