/*
 * DESIGN: Neuro-Signal Interface
 * Multi-session comparison section — A vs B side-by-side analysis
 */

import { useMemo } from 'react';
import { Download } from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import { welchTTest } from '@/lib/statisticsUtils';
import type { TTestResult } from '@/lib/statisticsUtils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';

interface Props {
  dataA: DashboardData;
  dataB: DashboardData;
  labelA: string;
  labelB: string;
}

const COLOR_A = 'oklch(0.70 0.14 195)';  /* teal */
const COLOR_B = 'oklch(0.78 0.22 340)';  /* hot pink */

export default function ComparisonSection({ dataA, dataB, labelA, labelB }: Props) {
  // ---- セッション間 Welch t検定（全フレームを2標本として比較） ----
  const sessionComparison = useMemo(() => {
    const results: Record<string, TTestResult> = {};
    for (const e of NON_NEUTRAL_EMOTIONS) {
      const aVals = dataA.timeseries_full.map(p => (p as any)[e] as number).filter(v => !isNaN(v));
      const bVals = dataB.timeseries_full.map(p => (p as any)[e] as number).filter(v => !isNaN(v));
      results[e] = welchTTest(aVals, bVals);
    }
    return results;
  }, [dataA, dataB]);

  // ---- 比較統計結果の CSV エクスポート ----
  const exportComparisonCSV = () => {
    const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const headers = ['感情', `${labelA}_mean`, `${labelB}_mean`, 't値', 'df', 'p値', "Cohen's_d", '効果量', '有意性', 'nA', 'nB'];
    const rows = [headers.join(',')];
    for (const e of NON_NEUTRAL_EMOTIONS) {
      const r = sessionComparison[e];
      if (!r) continue;
      rows.push([q(EMOTION_LABELS_JA[e] || e), r.meanA, r.meanB, r.t, r.df, r.p, r.cohensD, q(r.effectSize), q(r.significance), r.nA, r.nB].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `comparison_statistics_${labelA}_vs_${labelB}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---- 感情統計バーチャート用データ ----
  const emotionBarData = NON_NEUTRAL_EMOTIONS.map(e => ({
    name: EMOTION_LABELS_JA[e] || e,
    A: +(dataA.emotion_stats[e]?.mean || 0).toFixed(4),
    B: +(dataB.emotion_stats[e]?.mean || 0).toFixed(4),
    color: EMOTION_COLORS[e],
  }));

  // ---- 差分テーブル（|B-A|の大きい順） ----
  const diffRows = NON_NEUTRAL_EMOTIONS.map(e => ({
    emotion: e,
    label: EMOTION_LABELS_JA[e] || e,
    meanA: dataA.emotion_stats[e]?.mean || 0,
    meanB: dataB.emotion_stats[e]?.mean || 0,
    diff: (dataB.emotion_stats[e]?.mean || 0) - (dataA.emotion_stats[e]?.mean || 0),
    color: EMOTION_COLORS[e],
  })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  // ---- 特殊指標比較 ----
  const specialKeys = ['engagement', 'valence', 'attention'] as const;
  const specialBarData = specialKeys.map(k => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    A: +(dataA.special_stats[k]?.mean || (dataA.emotion_stats[k]?.mean ?? 0)).toFixed(2),
    B: +(dataB.special_stats[k]?.mean || (dataB.emotion_stats[k]?.mean ?? 0)).toFixed(2),
  }));

  // ---- Affect Dynamics レーダーチャート ----
  const adKeys = ['anger', 'joy', 'fear', 'sadness', 'surprise', 'engagement'];
  const radarData = adKeys.map(k => ({
    key: EMOTION_LABELS_JA[k] || k,
    A: +(dataA.affect_dynamics[k]?.variability_sd || 0).toFixed(4),
    B: +(dataB.affect_dynamics[k]?.variability_sd || 0).toFixed(4),
  }));

  // ---- 時系列オーバーレイ（各データを0-1に正規化してから比較） ----
  const maxLen = 200;
  const stepA = Math.max(1, Math.floor(dataA.timeseries_full.length / maxLen));
  const stepB = Math.max(1, Math.floor(dataB.timeseries_full.length / maxLen));
  const tsA = dataA.timeseries_full.filter((_, i) => i % stepA === 0);
  const tsB = dataB.timeseries_full.filter((_, i) => i % stepB === 0);
  const maxTimeA = dataA.meta.duration_seconds;
  const maxTimeB = dataB.meta.duration_seconds;
  // 時刻を0-100%に正規化して重ねる
  const overlayData: { pct: number; engA: number; engB: number; valA: number; valB: number }[] = [];
  const len = Math.max(tsA.length, tsB.length);
  for (let i = 0; i < len; i++) {
    const pct = Math.round((i / (len - 1)) * 100);
    const idxA = Math.min(i, tsA.length - 1);
    const idxB = Math.min(i, tsB.length - 1);
    overlayData.push({
      pct,
      engA: tsA[idxA]?.engagement ?? 0,
      engB: tsB[idxB]?.engagement ?? 0,
      valA: tsA[idxA]?.valence ?? 0,
      valB: tsB[idxB]?.valence ?? 0,
    });
  }

  // ---- Circumplex象限比較 ----
  const cmpA = dataA.circumplex_summary;
  const cmpB = dataB.circumplex_summary;
  const totalA = Math.max(1, cmpA.high_arousal_positive + cmpA.high_arousal_negative + cmpA.low_arousal_positive + cmpA.low_arousal_negative);
  const totalB = Math.max(1, cmpB.high_arousal_positive + cmpB.high_arousal_negative + cmpB.low_arousal_positive + cmpB.low_arousal_negative);
  const quadrantData = [
    { name: '高覚醒×高Valence', A: +((cmpA.high_arousal_positive / totalA) * 100).toFixed(1), B: +((cmpB.high_arousal_positive / totalB) * 100).toFixed(1) },
    { name: '高覚醒×低Valence', A: +((cmpA.high_arousal_negative / totalA) * 100).toFixed(1), B: +((cmpB.high_arousal_negative / totalB) * 100).toFixed(1) },
    { name: '低覚醒×高Valence', A: +((cmpA.low_arousal_positive / totalA) * 100).toFixed(1), B: +((cmpB.low_arousal_positive / totalB) * 100).toFixed(1) },
    { name: '低覚醒×低Valence', A: +((cmpA.low_arousal_negative / totalA) * 100).toFixed(1), B: +((cmpB.low_arousal_negative / totalB) * 100).toFixed(1) },
  ];

  const tooltipStyle = {
    contentStyle: { fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', border: '1px solid oklch(0.30 0.04 255)', borderRadius: '6px', background: 'oklch(0.20 0.04 255)', color: 'oklch(0.88 0.005 250)' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-label mb-1">COMPARISON ANALYSIS</div>
        <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.88 0.005 250)' }}>
          セッション比較分析
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.68 0.015 255)', marginTop: '0.25rem' }}>
          2つのCSVセッションの感情反応を多角的に比較します
        </p>
        {/* Legend */}
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: COLOR_A }} />
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: COLOR_A }}>{labelA}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: COLOR_B }} />
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: COLOR_B }}>{labelB}</span>
          </div>
        </div>
      </div>

      {/* Meta comparison */}
      <div className="grid grid-cols-2 gap-4">
        {[{ label: labelA, meta: dataA.meta, color: COLOR_A }, { label: labelB, meta: dataB.meta, color: COLOR_B }].map(({ label, meta, color }) => (
          <div key={label} className="metric-card" style={{ borderLeft: `3px solid ${color}` }}>
            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color, letterSpacing: '0.06em', marginBottom: '8px' }}>{label}</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { k: '総フレーム', v: meta.total_frames.toLocaleString() },
                { k: '録画時間', v: `${meta.duration_seconds.toFixed(1)}s` },
                { k: '平均FPS', v: meta.fps_avg.toFixed(1) },
                { k: '顔検出率', v: `${meta.face_detection_rate.toFixed(1)}%` },
              ].map(({ k, v }) => (
                <div key={k}>
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.62 0.015 255)' }}>{k}</div>
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 700, fontSize: '0.85rem', color: 'oklch(0.88 0.005 250)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 感情平均値バーチャート */}
      <div className="metric-card">
        <div className="section-label mb-3">EMOTION MEANS</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          感情スコア平均値の比較
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={emotionBarData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
            <XAxis dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', fill: 'oklch(0.65 0.015 255)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
            <Tooltip {...tooltipStyle} />
            <Legend formatter={v => <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>{v}</span>} />
            <Bar dataKey="A" name={labelA} fill={COLOR_A} radius={[3, 3, 0, 0]} opacity={0.85} />
            <Bar dataKey="B" name={labelB} fill={COLOR_B} radius={[3, 3, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 特殊指標 + Circumplex 横並び */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card">
          <div className="section-label mb-3">SPECIAL METRICS</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
            Engagement / Valence / Attention
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={specialBarData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
              <XAxis dataKey="name" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.65 0.015 255)' }} />
              <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="A" name={labelA} fill={COLOR_A} radius={[3, 3, 0, 0]} opacity={0.85} />
              <Bar dataKey="B" name={labelB} fill={COLOR_B} radius={[3, 3, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card">
          <div className="section-label mb-3">CIRCUMPLEX MODEL</div>
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
            感情状態の象限分布（%）
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={quadrantData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" horizontal={false} />
              <XAxis type="number" unit="%" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
              <YAxis type="category" dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.62rem', fill: 'oklch(0.65 0.015 255)' }} width={98} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="A" name={labelA} fill={COLOR_A} radius={[0, 3, 3, 0]} opacity={0.85} />
              <Bar dataKey="B" name={labelB} fill={COLOR_B} radius={[0, 3, 3, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Affect Dynamics レーダー */}
      <div className="metric-card">
        <div className="section-label mb-3">AFFECT DYNAMICS — VARIABILITY</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '1rem' }}>
          感情変動性（SD）のレーダー比較
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="oklch(0.28 0.04 255)" />
            <PolarAngleAxis dataKey="key" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', fill: 'oklch(0.65 0.015 255)' }} />
            <Radar name={labelA} dataKey="A" stroke={COLOR_A} fill={COLOR_A} fillOpacity={0.2} strokeWidth={2} />
            <Radar name={labelB} dataKey="B" stroke={COLOR_B} fill={COLOR_B} fillOpacity={0.15} strokeWidth={2} strokeDasharray="4 2" />
            <Legend formatter={v => <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>{v}</span>} />
            <Tooltip {...tooltipStyle} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Engagement 時系列オーバーレイ */}
      <div className="metric-card">
        <div className="section-label mb-3">ENGAGEMENT TIMELINE OVERLAY</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '4px' }}>
          Engagement 時系列の重ね合わせ（時間正規化）
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
          各セッションの時間を0-100%に正規化して比較。Bは破線で表示。
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={overlayData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
            <XAxis dataKey="pct" unit="%" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
            <Tooltip {...tooltipStyle} labelFormatter={v => `進行率 ${v}%`} />
            <Legend formatter={v => <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>{v}</span>} />
            <Line type="monotone" dataKey="engA" name={`Eng ${labelA}`} stroke={COLOR_A} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="engB" name={`Eng ${labelB}`} stroke={COLOR_B} strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 差分テーブル */}
      <div className="metric-card">
        <div className="section-label mb-3">DIFFERENCE TABLE</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
          感情差分ランキング（|B − A|の大きい順）
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
          正の差（B &gt; A）はB優勢、負の差（A &gt; B）はA優勢を示します。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '2px solid oklch(0.28 0.04 255)' }}>
                {['感情', `${labelA} 平均`, `${labelB} 平均`, '差分 (B−A)', 'バー'].map(h => (
                  <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.68 0.015 255)', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {diffRows.map((row, i) => {
                const maxDiff = Math.max(...diffRows.map(r => Math.abs(r.diff)));
                const barWidth = maxDiff > 0 ? Math.abs(row.diff) / maxDiff * 100 : 0;
                const isPositive = row.diff >= 0;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid oklch(0.20 0.04 255)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'oklch(0.22 0.04 255)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded text-xs" style={{ background: row.color + '20', color: row.color, fontFamily: 'Noto Sans JP, sans-serif' }}>
                        {row.label}
                      </span>
                    </td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: COLOR_A }}>{row.meanA.toFixed(4)}</td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: COLOR_B }}>{row.meanB.toFixed(4)}</td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', fontWeight: 700, color: isPositive ? COLOR_B : COLOR_A }}>
                      {row.diff > 0 ? '+' : ''}{row.diff.toFixed(4)}
                    </td>
                    <td className="py-2 pr-4" style={{ minWidth: '80px' }}>
                      <div className="h-2 rounded-full" style={{ background: 'oklch(0.22 0.04 255)' }}>
                        <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: isPositive ? COLOR_B : COLOR_A }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- セッション間統計的検定 ---- */}
      <div className="metric-card">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="section-label mb-1" style={{ color: 'oklch(0.65 0.20 270)' }}>STATISTICAL COMPARISON — SESSION LEVEL</div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)' }}>
              セッション間 統計的検定
            </div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)', marginTop: '2px' }}>
              両セッションの全フレームを標本としてWelchのt検定を実施。Cohen's dで効果量を評価します。
            </p>
          </div>
          {/* CSV エクスポートボタン */}
          <button
            onClick={exportComparisonCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all flex-shrink-0"
            style={{ fontFamily: 'Noto Sans JP, sans-serif', background: 'oklch(0.32 0.12 160)', color: 'white', border: '1px solid oklch(0.52 0.18 160)' }}
            title="統計検定結果をCSVでダウンロード"
          >
            <Download size={13} />
            CSV出力
          </button>
        </div>

        {/* 凡例 */}
        <div className="flex gap-4 mb-3 text-xs" style={{ fontFamily: 'Roboto Mono, monospace', color: 'oklch(0.66 0.015 255)', marginTop: '12px' }}>
          <span>*** p&lt;0.001</span>
          <span>** p&lt;0.01</span>
          <span>* p&lt;0.05</span>
          <span>n.s. p≥0.05</span>
          <span style={{ marginLeft: '8px' }}>効果量: 大(|d|≥0.8) / 中(≥0.5) / 小(≥0.2) / 極小</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'oklch(0.185 0.04 255)', borderBottom: '1px solid oklch(0.26 0.04 255)' }}>
                {['感情', `${labelA} 平均`, `${labelB} 平均`, 't値', 'df', 'p値', "Cohen's d", '効果量', '有意性'].map(h => (
                  <th key={h} style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.62 0.015 255)', padding: '6px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NON_NEUTRAL_EMOTIONS.map(emotion => {
                const r = sessionComparison[emotion];
                if (!r) return null;
                const isSig = r.significance !== 'n.s.';
                return (
                  <tr key={emotion} style={{ borderBottom: '1px solid oklch(0.22 0.04 255)', background: isSig ? 'oklch(0.22 0.06 270 / 0.4)' : 'transparent' }}>
                    <td style={{ padding: '5px 10px' }}>
                      <span className="px-2 py-0.5 rounded text-xs" style={{ background: EMOTION_COLORS[emotion] + '20', color: EMOTION_COLORS[emotion], fontFamily: 'Noto Sans JP, sans-serif' }}>
                        {EMOTION_LABELS_JA[emotion] || emotion}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: COLOR_A, fontSize: '0.72rem' }}>{r.meanA.toFixed(3)}</td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: COLOR_B, fontSize: '0.72rem' }}>{r.meanB.toFixed(3)}</td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: 'oklch(0.75 0.008 250)', fontSize: '0.72rem' }}>{r.t.toFixed(3)}</td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: 'oklch(0.66 0.015 255)', fontSize: '0.72rem' }}>{r.df.toFixed(1)}</td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: isSig ? 'oklch(0.78 0.20 140)' : 'oklch(0.66 0.015 255)', fontSize: '0.72rem' }}>{r.p.toFixed(4)}</td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: 'oklch(0.75 0.008 250)', fontSize: '0.72rem' }}>{r.cohensD.toFixed(3)}</td>
                    <td style={{ fontFamily: 'Noto Sans JP, sans-serif', padding: '5px 10px', color: 'oklch(0.65 0.015 255)', fontSize: '0.72rem' }}>{r.effectSize}</td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', fontSize: '0.85rem', fontWeight: 700, color: isSig ? 'oklch(0.85 0.22 95)' : 'oklch(0.62 0.015 255)' }}>{r.significance}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* サンプルサイズの注記 */}
        <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.55 0.015 255)', marginTop: '8px' }}>
          nA = {dataA.timeseries_full.length} frames ({labelA}) &nbsp;|&nbsp; nB = {dataB.timeseries_full.length} frames ({labelB})
        </p>
      </div>
    </div>
  );
}
