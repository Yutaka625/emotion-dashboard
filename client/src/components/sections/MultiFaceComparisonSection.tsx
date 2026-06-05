/*
 * MultiFaceComparisonSection
 * 複数 FaceID（顔）の比較セクション。マルチフェイス時のみ表示。
 *  1. 品質サマリ（検出数/除外数）＋「微小なIDも表示」トグル
 *  2. 顔の管理リスト（色・フレーム数・ラベル名編集・表示トグル）
 *  3. 感情オーバーレイグラフ（指標を1つ選び、各顔の時系列を時間正規化して重ね描画）
 */

import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Users } from 'lucide-react';
import { useFaceID } from '@/contexts/FaceIDContext';
import { NON_NEUTRAL_EMOTIONS, EMOTION_LABELS_JA } from '@/lib/types';
import { rechartsTooltip } from '@/lib/chartTooltip';

// オーバーレイで選べる指標（特殊指標3種＋非ニュートラル9感情）
const OVERLAY_METRICS: { key: string; label: string }[] = [
  { key: 'engagement', label: 'Engagement' },
  { key: 'valence', label: 'Valence' },
  { key: 'attention', label: 'Attention' },
  ...NON_NEUTRAL_EMOTIONS.map(e => ({ key: e, label: EMOTION_LABELS_JA[e] || e })),
];

export default function MultiFaceComparisonSection() {
  const {
    availableFaceIds, selectedFaceIds, isMultiFace, quality, showMinor, setShowMinor,
    minFraction, minSeconds, setThreshold, resetThreshold,
    toggleFaceId, displayName, labelOf, setFaceLabel, faceColor, getFaceData, faceFrameCount,
  } = useFaceID();

  const [metric, setMetric] = useState<string>('engagement');
  const metricLabel = OVERLAY_METRICS.find(m => m.key === metric)?.label ?? metric;
  const minorIds = useMemo(() => new Set(quality.minor.map(m => m.id)), [quality]);

  // 選択中の各顔の時系列を 0-100% に時間正規化して重ねる
  const overlayData = useMemo(() => {
    const sampled = selectedFaceIds
      .map(id => {
        const ts = getFaceData(id)?.timeseries_full ?? [];
        const step = Math.max(1, Math.floor(ts.length / 200));
        return { id, pts: ts.filter((_, i) => i % step === 0) };
      })
      .filter(s => s.pts.length > 0);
    const len = Math.max(1, ...sampled.map(s => s.pts.length));
    const rows: Record<string, number>[] = [];
    for (let i = 0; i < len; i++) {
      const row: Record<string, number> = { pct: Math.round((i / Math.max(1, len - 1)) * 100) };
      for (const s of sampled) {
        const idx = Math.min(i, s.pts.length - 1);
        row[s.id] = (s.pts[idx] as any)?.[metric] ?? 0;
      }
      rows.push(row);
    }
    return rows;
  }, [selectedFaceIds, metric, getFaceData]);

  if (!isMultiFace) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <div className="text-center px-8 py-10 rounded-2xl" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.32 0.04 255)', maxWidth: '440px' }}>
          <Users size={26} style={{ color: 'oklch(0.68 0.015 255)', margin: '0 auto 0.75rem' }} />
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.72 0.012 250)', lineHeight: 1.7 }}>
            このデータには複数の顔（FaceID）が含まれていないため、顔ごとの比較は表示できません。
          </p>
        </div>
      </div>
    );
  }

  const excluded = quality.minor.length;
  const detected = quality.kept.length + excluded;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="section-label mb-1">MULTI-FACE COMPARISON</div>
        <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.88 0.005 250)' }}>
          顔ごとの比較
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.68 0.015 255)', marginTop: '0.25rem' }}>
          複数の顔（FaceID）の感情反応を並べて比較します
        </p>
      </div>

      {/* 品質サマリ + 微小ID表示トグル */}
      <div className="metric-card">
        <div className="section-label mb-3">DATA QUALITY</div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.82rem', color: 'oklch(0.78 0.012 250)', lineHeight: 1.7 }}>
            FaceID を <strong style={{ color: 'oklch(0.88 0.005 250)' }}>{detected}</strong> 個検出。
            {excluded > 0 ? (
              <>うち <strong style={{ color: 'oklch(0.82 0.15 70)' }}>{excluded}</strong> 個は少フレーム（総フレームの5%未満または約3秒未満）のため、検出が不安定な可能性があり既定で解析対象から除外しています。</>
            ) : (
              <>すべて十分なフレーム数のため、全て解析対象です。</>
            )}
          </p>
          {excluded > 0 && (
            <label className="flex items-center gap-2 cursor-pointer" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.72 0.012 250)', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={showMinor} onChange={e => setShowMinor(e.target.checked)} />
              微小なIDも表示
            </label>
          )}
        </div>

        {/* 除外しきい値の調整 */}
        <div className="flex items-center flex-wrap gap-2 mt-4 pt-3" style={{ borderTop: '1px solid oklch(0.26 0.04 255)' }}>
          <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)' }}>
            除外しきい値：総フレームの
          </span>
          <input
            type="number" min={0} max={100} step={1}
            value={Math.round(minFraction * 100)}
            onChange={e => setThreshold((Number(e.target.value) || 0) / 100, minSeconds)}
            className="px-2 py-1 rounded outline-none"
            style={{ width: '64px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', background: 'oklch(0.24 0.04 255)', border: '1px solid oklch(0.30 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
          />
          <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)' }}>%未満、または</span>
          <input
            type="number" min={0} step={0.5}
            value={minSeconds}
            onChange={e => setThreshold(minFraction, Number(e.target.value) || 0)}
            className="px-2 py-1 rounded outline-none"
            style={{ width: '64px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', background: 'oklch(0.24 0.04 255)', border: '1px solid oklch(0.30 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
          />
          <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)' }}>秒未満を除外</span>
          <button
            onClick={resetThreshold}
            className="px-2.5 py-1 rounded-lg text-xs transition-colors"
            style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', background: 'oklch(0.24 0.04 255)', border: '1px solid oklch(0.32 0.04 255)', color: 'oklch(0.70 0.015 255)' }}
          >
            既定に戻す
          </button>
        </div>
      </div>

      {/* 顔の管理リスト（色・フレーム数・ラベル編集・表示トグル） */}
      <div className="metric-card">
        <div className="section-label mb-3">FACES</div>
        <div className="space-y-2">
          {availableFaceIds.map(id => {
            const isSel = selectedFaceIds.includes(id);
            const isMinor = minorIds.has(id);
            return (
              <div key={id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'oklch(0.20 0.04 255)', border: '1px solid oklch(0.28 0.04 255)' }}>
                {/* 色スウォッチ */}
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: faceColor(id), flexShrink: 0 }} />
                {/* FaceID */}
                <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'oklch(0.75 0.008 250)', minWidth: '54px' }}>Face {id}</span>
                {/* ラベル名入力 */}
                <input
                  type="text"
                  defaultValue={labelOf(id)}
                  placeholder={`Face ${id}`}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  onBlur={e => setFaceLabel(id, e.target.value.trim())}
                  className="flex-1 px-2 py-1 rounded outline-none"
                  style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', minWidth: '120px', background: 'oklch(0.24 0.04 255)', border: '1px solid oklch(0.30 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
                />
                {/* フレーム数 */}
                <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', color: 'oklch(0.62 0.015 255)', whiteSpace: 'nowrap' }}>
                  {faceFrameCount(id).toLocaleString()} f
                </span>
                {/* minor バッジ */}
                {isMinor && (
                  <span className="px-1.5 py-0.5 rounded" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.6rem', background: 'oklch(0.75 0.16 70 / 0.15)', color: 'oklch(0.82 0.15 70)', border: '1px solid oklch(0.75 0.16 70 / 0.4)', whiteSpace: 'nowrap' }}>
                    少フレーム
                  </span>
                )}
                {/* 表示トグル */}
                <button
                  onClick={() => toggleFaceId(id)}
                  className="px-2.5 py-1 rounded-full text-xs transition-colors"
                  style={{
                    fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', whiteSpace: 'nowrap',
                    background: isSel ? faceColor(id) : 'transparent',
                    color: isSel ? 'oklch(0.16 0.02 250)' : 'oklch(0.66 0.015 255)',
                    border: `1px solid ${isSel ? faceColor(id) : 'oklch(0.35 0.03 255)'}`,
                    fontWeight: isSel ? 700 : 400,
                  }}
                >
                  {isSel ? '表示中' : '非表示'}
                </button>
              </div>
            );
          })}
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', color: 'oklch(0.58 0.015 255)', marginTop: '0.75rem' }}>
          ラベル名は Enter または入力欄からフォーカスを外すと保存され、ブラウザに記憶されます（同一ファイル名で復元）。
        </p>
      </div>

      {/* 感情オーバーレイグラフ */}
      <div className="metric-card">
        <div className="section-label mb-3">EMOTION OVERLAY</div>
        <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '4px' }}>
          {metricLabel} 時系列の重ね合わせ（時間正規化）
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)', marginBottom: '0.75rem' }}>
          指標を選んで、表示中の各顔を重ねて比較します。各顔の時間を0-100%に正規化しています。
        </p>

        {/* 指標選択ピル */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {OVERLAY_METRICS.map(m => {
            const on = metric === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className="px-2.5 py-0.5 rounded-full text-xs transition-all"
                style={{
                  fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem',
                  background: on ? 'oklch(0.70 0.14 195)' : 'oklch(0.20 0.04 255)',
                  color: on ? 'oklch(0.16 0.02 250)' : 'oklch(0.68 0.015 250)',
                  border: `1px solid ${on ? 'oklch(0.70 0.14 195)' : 'oklch(0.28 0.04 255)'}`,
                  fontWeight: on ? 700 : 400,
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={overlayData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
            <XAxis dataKey="pct" unit="%" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
            <Tooltip {...rechartsTooltip} labelFormatter={v => `進行率 ${v}%`} />
            <Legend formatter={v => <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem' }}>{v}</span>} />
            {selectedFaceIds.map(id => (
              <Line key={id} type="monotone" dataKey={id} name={displayName(id)} stroke={faceColor(id)} strokeWidth={1.5} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
