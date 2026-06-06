/*
 * DESIGN: Neuro-Signal Interface
 * Multi-session comparison section — A vs B side-by-side analysis
 */

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import { welchTTest, mannWhitneyU } from '@/lib/statisticsUtils';
import type { TTestResult, MannWhitneyResult } from '@/lib/statisticsUtils';
import { formatScore } from '@/lib/utils';

// 統計検定の手法切替（パラメトリック / ノンパラメトリック）
type TestMethod = 'welch' | 'mannwhitney';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import { rechartsTooltip } from '@/lib/chartTooltip';
import CardHeader from '@/components/ui/CardHeader';

interface Props {
  dataA: DashboardData;
  dataB: DashboardData;
  labelA: string;
  labelB: string;
}

const COLOR_A = 'oklch(0.70 0.14 195)';  /* teal */
const COLOR_B = 'oklch(0.78 0.22 340)';  /* hot pink */

// タイムラインオーバーレイで選択できる指標（特殊指標3種＋非ニュートラル9感情）
const OVERLAY_METRICS: { key: string; label: string; color: string }[] = [
  { key: 'engagement', label: 'Engagement', color: 'oklch(0.78 0.14 82)' },
  { key: 'valence', label: 'Valence', color: 'oklch(0.70 0.14 195)' },
  { key: 'attention', label: 'Attention', color: 'oklch(0.60 0.25 15)' },
  ...NON_NEUTRAL_EMOTIONS.map(e => ({ key: e, label: EMOTION_LABELS_JA[e] || e, color: EMOTION_COLORS[e] })),
];

export default function ComparisonSection({ dataA, dataB, labelA, labelB }: Props) {
  // ---- 統計検定の手法切替（Welch t検定 / Mann-Whitney U） ----
  const [testMethod, setTestMethod] = useState<TestMethod>('welch');

  // ---- タイムラインオーバーレイで表示する指標（既定: Engagement） ----
  const [overlayMetric, setOverlayMetric] = useState<string>('engagement');

  // 各感情について、両セッションの全フレームを2標本として抽出する
  const emotionSamples = useMemo(() => {
    const out: Record<string, { a: number[]; b: number[] }> = {};
    for (const e of NON_NEUTRAL_EMOTIONS) {
      out[e] = {
        a: dataA.timeseries_full.map(p => (p as any)[e] as number).filter(v => !isNaN(v)),
        b: dataB.timeseries_full.map(p => (p as any)[e] as number).filter(v => !isNaN(v)),
      };
    }
    return out;
  }, [dataA, dataB]);

  // ---- セッション間 Welch t検定（パラメトリック） ----
  const sessionComparison = useMemo(() => {
    const results: Record<string, TTestResult> = {};
    for (const e of NON_NEUTRAL_EMOTIONS) {
      results[e] = welchTTest(emotionSamples[e].a, emotionSamples[e].b);
    }
    return results;
  }, [emotionSamples]);

  // ---- セッション間 Mann-Whitney U検定（ノンパラメトリック） ----
  const sessionComparisonMW = useMemo(() => {
    const results: Record<string, MannWhitneyResult> = {};
    for (const e of NON_NEUTRAL_EMOTIONS) {
      results[e] = mannWhitneyU(emotionSamples[e].a, emotionSamples[e].b);
    }
    return results;
  }, [emotionSamples]);

  // ---- 統計サマリーの CSV エクスポート（記述統計＋Welch＋Mann-Whitney を1ファイルに） ----
  const exportComparisonCSV = () => {
    const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const rows: string[] = [];

    // メタデータ
    rows.push('## COMPARISON META');
    rows.push('項目,値');
    rows.push(`セッションA,${q(labelA)}`);
    rows.push(`セッションB,${q(labelB)}`);
    rows.push(`出力日時,${q(new Date().toISOString())}`);
    rows.push('');

    // 記述統計
    rows.push('## DESCRIPTIVE STATISTICS');
    rows.push('感情,meanA,meanB,medianA,medianB,sdA,sdB,nA,nB');
    for (const e of NON_NEUTRAL_EMOTIONS) {
      const t = sessionComparison[e];
      const m = sessionComparisonMW[e];
      if (!t || !m) continue;
      rows.push([q(EMOTION_LABELS_JA[e] || e), t.meanA, t.meanB, m.medianA, m.medianB, t.stdA, t.stdB, t.nA, t.nB].join(','));
    }
    rows.push('');

    // Welch t検定
    rows.push('## WELCH T-TEST (parametric)');
    rows.push("感情,t値,df,p値,Cohen's_d,効果量,有意性");
    for (const e of NON_NEUTRAL_EMOTIONS) {
      const r = sessionComparison[e];
      if (!r) continue;
      rows.push([q(EMOTION_LABELS_JA[e] || e), r.t, r.df, r.p, r.cohensD, q(r.effectSize), q(r.significance)].join(','));
    }
    rows.push('');

    // Mann-Whitney U検定
    rows.push('## MANN-WHITNEY U TEST (non-parametric)');
    rows.push('感情,U,z,p値,効果量r,効果量,有意性');
    for (const e of NON_NEUTRAL_EMOTIONS) {
      const r = sessionComparisonMW[e];
      if (!r) continue;
      rows.push([q(EMOTION_LABELS_JA[e] || e), r.U, r.z, r.p, r.rankBiserial, q(r.effectSize), q(r.significance)].join(','));
    }

    // BOM 付きで出力（Excel 文字化け対策。他エクスポートと統一）
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/(\d{8})(\d{4})/, '$1-$2');
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `comparison_statistics_${labelA}_vs_${labelB}_${stamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
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

  // ---- 時系列オーバーレイ（時間を0-100%に正規化し、選択指標をA/Bで重ねる） ----
  const overlayMeta = OVERLAY_METRICS.find(m => m.key === overlayMetric) ?? OVERLAY_METRICS[0];
  const overlayData = useMemo(() => {
    const maxLen = 200;
    const stepA = Math.max(1, Math.floor(dataA.timeseries_full.length / maxLen));
    const stepB = Math.max(1, Math.floor(dataB.timeseries_full.length / maxLen));
    const tsA = dataA.timeseries_full.filter((_, i) => i % stepA === 0);
    const tsB = dataB.timeseries_full.filter((_, i) => i % stepB === 0);
    const len = Math.max(tsA.length, tsB.length);
    const out: { pct: number; A: number; B: number }[] = [];
    for (let i = 0; i < len; i++) {
      const idxA = Math.min(i, tsA.length - 1);
      const idxB = Math.min(i, tsB.length - 1);
      out.push({
        pct: Math.round((i / Math.max(1, len - 1)) * 100),
        A: (tsA[idxA] as any)?.[overlayMetric] ?? 0,
        B: (tsB[idxB] as any)?.[overlayMetric] ?? 0,
      });
    }
    return out;
  }, [dataA, dataB, overlayMetric]);

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

  // 共通ツールチップスタイル（項目テキストを明るい色に固定し可読性を確保）
  const tooltipStyle = rechartsTooltip;

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

      {/* Row1: 感情スコア平均値 + 特殊指標（Engagement/Valence/Attention）を横並び */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 感情平均値バーチャート */}
        <div className="metric-card">
          <CardHeader
            label="EMOTION MEANS"
            title="感情スコア平均値の比較"
            info="2つのセッション（A/B）について、各感情の平均スコアを並べて比較します。どの感情がどちらのセッションで強く出たかを把握できます。"
          />
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

        {/* 特殊指標 */}
        <div className="metric-card">
          <CardHeader
            label="SPECIAL METRICS"
            title="Engagement / Valence / Attention"
            info="特殊指標3種（Engagement=関与度、Valence=感情価、Attention=注視度）の平均値を、A/B 2セッションで比較します。"
          />
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
      </div>

      {/* Row2: 象限分布 + 感情変動性レーダー を横並び */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Circumplex 象限分布 */}
        <div className="metric-card">
          <CardHeader
            label="CIRCUMPLEX MODEL"
            title="感情状態の象限分布（%）"
            info="円環モデルの4象限（覚醒度×感情価）に各フレームを分類し、その割合（%）を A/B で比較します。分割は固定中立点（Engagement=50／Valence=0）です。"
          />
          <ResponsiveContainer width="100%" height={240}>
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

        {/* Affect Dynamics レーダー */}
        <div className="metric-card">
          <CardHeader
            label="AFFECT DYNAMICS — VARIABILITY"
            title="感情変動性（SD）のレーダー比較"
            info="主要な感情・指標の変動性（標準偏差＝時間的な揺れ幅）を、A/B 2セッションでレーダーチャートに重ねて比較します。外側ほど揺れが大きいことを示します。"
          />
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
      </div>

      {/* 時系列オーバーレイ（指標を選択してA/B重ね合わせ） */}
      <div className="metric-card">
        <CardHeader
          label="TIMELINE OVERLAY"
          title={`${overlayMeta.label} 時系列の重ね合わせ（時間正規化）`}
          info="下のピルで選んだ1指標の時系列を、A/B 2セッションで重ねて比較します。各セッションの時間を0〜100%（進行率）に正規化し、Aは実線・Bは破線で表示します。録画長が違っても波形の形を比べられます。"
        />

        {/* 指標選択ピル */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {OVERLAY_METRICS.map(m => {
            const on = overlayMetric === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setOverlayMetric(m.key)}
                className="px-2.5 py-0.5 rounded-full text-xs transition-all"
                style={{
                  fontFamily: 'Noto Sans JP, sans-serif',
                  fontSize: '0.72rem',
                  background: on ? m.color : 'oklch(0.20 0.04 255)',
                  color: on ? 'oklch(0.16 0.02 250)' : 'oklch(0.68 0.015 250)',
                  border: `1px solid ${on ? m.color : 'oklch(0.28 0.04 255)'}`,
                  fontWeight: on ? 700 : 400,
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={overlayData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
            <XAxis dataKey="pct" unit="%" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
            <Tooltip {...tooltipStyle} labelFormatter={v => `進行率 ${v}%`} />
            <Legend formatter={v => <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>{v}</span>} />
            <Line type="monotone" dataKey="A" name={`${overlayMeta.label} ${labelA}`} stroke={COLOR_A} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="B" name={`${overlayMeta.label} ${labelB}`} stroke={COLOR_B} strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 差分テーブル */}
      <div className="metric-card">
        <CardHeader
          label="DIFFERENCE TABLE"
          title="感情差分ランキング（|B − A|の大きい順）"
          info="各感情の平均スコアについて B − A の差を計算し、差の大きい順に並べます。正の差（B＞A）はB優勢、負の差（A＞B）はA優勢を示します。2セッションで最も違いが出た感情がひと目で分かります。"
        />
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
                  <tr key={i} className="row-hover" style={{ borderBottom: '1px solid oklch(0.20 0.04 255)' }}>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded text-xs" style={{ background: row.color + '20', color: row.color, fontFamily: 'Noto Sans JP, sans-serif' }}>
                        {row.label}
                      </span>
                    </td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: COLOR_A }}>{formatScore(row.meanA)}</td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: COLOR_B }}>{formatScore(row.meanB)}</td>
                    <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', fontWeight: 700, color: isPositive ? COLOR_B : COLOR_A }}>
                      {row.diff > 0 ? '+' : ''}{formatScore(row.diff)}
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
        <CardHeader
          label="STATISTICAL COMPARISON — SESSION LEVEL"
          labelColor="oklch(0.65 0.20 270)"
          title="セッション間 統計的検定"
          info={testMethod === 'welch'
            ? '両セッションの全フレームを標本としてWelchのt検定を実施し、感情ごとに差が統計的に有意かを判定します。効果量はCohen\'s dで評価。下のトグルでMann-Whitney U検定にも切り替えられます。'
            : '両セッションの全フレームを標本としてMann-Whitney U検定（ノンパラメトリック）を実施します。正規性を仮定せず、効果量はランク二列相関 r で評価。下のトグルでWelch t検定にも切り替えられます。'}
          right={(
            <button
              onClick={exportComparisonCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all flex-shrink-0"
              style={{ fontFamily: 'Noto Sans JP, sans-serif', background: 'oklch(0.32 0.12 160)', color: 'white', border: '1px solid oklch(0.52 0.18 160)' }}
              title="記述統計＋Welch＋Mann-Whitneyの統計サマリーをCSVでダウンロード"
            >
              <Download size={13} />
              CSV出力
            </button>
          )}
        />

        {/* 検定手法トグル（パラメトリック / ノンパラメトリック） */}
        <div className="flex gap-2 mt-3 mb-3">
          {([
            { id: 'welch', label: 'Welch t検定', desc: 'パラメトリック' },
            { id: 'mannwhitney', label: 'Mann-Whitney U', desc: 'ノンパラメトリック' },
          ] as const).map(opt => {
            const on = testMethod === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setTestMethod(opt.id)}
                title={opt.desc}
                className="px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  fontFamily: 'Noto Sans JP, sans-serif',
                  fontWeight: on ? 700 : 400,
                  background: on ? 'oklch(0.30 0.10 270)' : 'oklch(0.22 0.04 255)',
                  color: on ? 'oklch(0.85 0.18 285)' : 'oklch(0.66 0.015 255)',
                  border: `1px solid ${on ? 'oklch(0.55 0.18 285)' : 'oklch(0.30 0.04 255)'}`,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* 凡例 */}
        <div className="flex gap-4 mb-3 text-xs flex-wrap" style={{ fontFamily: 'Roboto Mono, monospace', color: 'oklch(0.66 0.015 255)' }}>
          <span>*** p&lt;0.001</span>
          <span>** p&lt;0.01</span>
          <span>* p&lt;0.05</span>
          <span>n.s. p≥0.05</span>
          <span style={{ marginLeft: '8px' }}>
            {testMethod === 'welch'
              ? '効果量(Cohen\'s d): 大(|d|≥0.8) / 中(≥0.5) / 小(≥0.2) / 極小'
              : '効果量(r): 大(|r|≥0.5) / 中(≥0.3) / 小(≥0.1) / 極小'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'oklch(0.185 0.04 255)', borderBottom: '1px solid oklch(0.26 0.04 255)' }}>
                {(testMethod === 'welch'
                  ? ['感情', `${labelA} 平均`, `${labelB} 平均`, 't値', 'df', 'p値', "Cohen's d", '効果量', '有意性']
                  : ['感情', `${labelA} 中央値`, `${labelB} 中央値`, 'U', 'z', 'p値', '効果量r', '効果量', '有意性']
                ).map(h => (
                  <th key={h} style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.62 0.015 255)', padding: '6px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NON_NEUTRAL_EMOTIONS.map(emotion => {
                // 選択中の検定に応じて表示する統計量を切り替える
                const r = sessionComparison[emotion];
                const m = sessionComparisonMW[emotion];
                if (!r || !m) return null;
                const isSig = (testMethod === 'welch' ? r.significance : m.significance) !== 'n.s.';
                const significance = testMethod === 'welch' ? r.significance : m.significance;
                const effectSize = testMethod === 'welch' ? r.effectSize : m.effectSize;
                // 3〜6列目（検定統計量）の値
                const cols = testMethod === 'welch'
                  ? [formatScore(r.meanA), formatScore(r.meanB), r.t.toFixed(3), r.df.toFixed(1), r.p.toFixed(4), r.cohensD.toFixed(3)]
                  : [formatScore(m.medianA), formatScore(m.medianB), m.U.toFixed(1), m.z.toFixed(3), m.p.toFixed(4), m.rankBiserial.toFixed(3)];
                return (
                  <tr key={emotion} style={{ borderBottom: '1px solid oklch(0.22 0.04 255)', background: isSig ? 'oklch(0.22 0.06 270 / 0.4)' : 'transparent' }}>
                    <td style={{ padding: '5px 10px' }}>
                      <span className="px-2 py-0.5 rounded text-xs" style={{ background: EMOTION_COLORS[emotion] + '20', color: EMOTION_COLORS[emotion], fontFamily: 'Noto Sans JP, sans-serif' }}>
                        {EMOTION_LABELS_JA[emotion] || emotion}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: COLOR_A, fontSize: '0.72rem' }}>{cols[0]}</td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: COLOR_B, fontSize: '0.72rem' }}>{cols[1]}</td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: 'oklch(0.75 0.008 250)', fontSize: '0.72rem' }}>{cols[2]}</td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: 'oklch(0.66 0.015 255)', fontSize: '0.72rem' }}>{cols[3]}</td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: isSig ? 'oklch(0.78 0.20 140)' : 'oklch(0.66 0.015 255)', fontSize: '0.72rem' }}>{cols[4]}</td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: 'oklch(0.75 0.008 250)', fontSize: '0.72rem' }}>{cols[5]}</td>
                    <td style={{ fontFamily: 'Noto Sans JP, sans-serif', padding: '5px 10px', color: 'oklch(0.65 0.015 255)', fontSize: '0.72rem' }}>{effectSize}</td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', fontSize: '0.85rem', fontWeight: 700, color: isSig ? 'oklch(0.85 0.22 95)' : 'oklch(0.62 0.015 255)' }}>{significance}</td>
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
