/**
 * BaselineSettingsCard
 * ベースライン補正の設定UI（区間設定・自動検出・補正方式・解除）
 *
 * 表示モード（偏差/変化率/Zスコア等）の切替は画面上部の
 * ベースラインバナーから行えます（全タブ共通）。
 */

import { useMemo } from 'react';
import type { TimeseriesPoint } from '@/lib/types';
import { EMOTION_COLORS, EMOTION_LABELS_JA, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import { Wand2, AlertTriangle, Download } from 'lucide-react';
import { useBaseline } from '@/contexts/BaselineContext';
import { detectBaselineWindow, applyBaselineCorrection } from '@/lib/csvAnalyzer';
import { toast } from 'sonner';
import CollapsibleCard from '@/components/ui/CollapsibleCard';
import SettingBox from '@/components/ui/SettingBox';
import SettingSubLabel from '@/components/ui/SettingSubLabel';

import type { BaselineCenter } from '@/lib/types';

interface Props {
  /** ベースライン自動検出・適用に使う全フレームデータ */
  timeseriesFull: TimeseriesPoint[];
}

// 補正方式（中心値）の選択肢
const CENTER_OPTIONS: { value: BaselineCenter; label: string; note: string }[] = [
  { value: 'mean',   label: '平均',   note: '標準' },
  { value: 'median', label: '中央値', note: '外れ値に頑健' },
];

export default function BaselineSettingsCard({ timeseriesFull }: Props) {
  const {
    baselineRange,
    baselineOffsets,
    isBaselineActive,
    setBaseline,
    clearBaseline,
    centerMethod,
    setCenterMethod,
    displayMode,
  } = useBaseline();

  // ---- 補正後データの CSV エクスポート ----
  // ベースライン補正を適用した全フレームの感情・特殊指標を、メタデータ行つきで出力する。
  // AU列は補正対象外のため含めない（感情＋engagement/valence/attention に絞る）。
  const exportCorrectedCSV = () => {
    if (!baselineOffsets || !baselineRange) return;
    const corrected = applyBaselineCorrection(timeseriesFull, baselineOffsets, displayMode);
    const cols = [...NON_NEUTRAL_EMOTIONS, 'engagement', 'valence', 'attention'];
    const num = (v: number) => (Number.isNaN(v) ? '' : v.toFixed(3)); // NaN（lift/zscoreの「—」相当）は空欄
    const rows: string[] = [];

    // メタデータ
    rows.push('## BASELINE CORRECTION METADATA');
    rows.push('項目,値');
    rows.push(`補正対象区間(秒),${baselineRange[0]}-${baselineRange[1]}`);
    rows.push(`ベースライン中心,${centerMethod === 'mean' ? '平均' : '中央値'}`);
    rows.push(`表示モード,${displayMode}`);
    rows.push(`出力日時,${new Date().toISOString()}`);
    rows.push('');
    // 各指標のオフセット・SD
    rows.push('## BASELINE OFFSETS');
    rows.push('指標,offset,sd');
    for (const c of cols) {
      const o = baselineOffsets[c];
      if (!o) continue;
      rows.push(`${EMOTION_LABELS_JA[c] || c},${o.offset.toFixed(4)},${o.sd.toFixed(4)}`);
    }
    rows.push('');
    // 補正後データ本体
    rows.push('## CORRECTED TIMESERIES');
    rows.push(['time', ...cols].join(','));
    for (const p of corrected) {
      rows.push([p.time.toFixed(3), ...cols.map(c => num((p as any)[c] as number))].join(','));
    }

    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/(\d{8})(\d{4})/, '$1-$2');
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `ksdv_corrected_${centerMethod}_${displayMode}_${baselineRange[0]}-${baselineRange[1]}s_${stamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // ベースライン区間の品質指標（区間長・フレーム数・安定性の警告）を算出する。
  // 研究妥当性のため「短すぎる区間」「ばらつきが大きい（無表情として不安定な）区間」を可視化する。
  const quality = useMemo(() => {
    if (!baselineRange) return null;
    const [s, e] = baselineRange;
    const windowSec = e - s;
    const frames = timeseriesFull.filter(p => p.time >= s && p.time <= e).length;
    // 非ニュートラル感情のSDの最大値（0-100スケール）。無表情区間なら小さいはず。
    const maxSd = baselineOffsets
      ? Math.max(0, ...NON_NEUTRAL_EMOTIONS.map(em => baselineOffsets[em]?.sd ?? 0))
      : 0;
    return {
      windowSec,
      frames,
      maxSd,
      shortWindow: windowSec < 10,      // 10秒未満は短すぎて代表性が低い
      highVariance: maxSd > 5,          // SD>5（0-100）は無表情区間としてやや不安定
    };
  }, [baselineRange, baselineOffsets, timeseriesFull]);

  return (
    <CollapsibleCard
      label="BASELINE SETTINGS"
      labelColor="oklch(0.70 0.14 195)"
      title="ベースライン補正設定"
      info="セッション冒頭の無表情区間を差し引いて、感情変化を相対値で比較します"
      borderLeftColor="oklch(0.70 0.14 195)"
      storageKey="ksdv.collapse.baseline"
      badge={isBaselineActive ? (
        <span style={{
          fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem',
          background: 'rgba(0,180,216,0.15)', border: '1px solid rgba(0,180,216,0.4)',
          color: 'oklch(0.70 0.14 195)', padding: '3px 10px', borderRadius: '4px',
        }}>
          ⚡ 補正適用中
        </span>
      ) : null}
    >
      {/* STEP 1: ベースライン区間の状態表示 */}
      <SettingBox className="mb-4">
        <SettingSubLabel
          color="oklch(0.70 0.14 195)"
          action={
            /* 自動検出ボタン */
            <button
              onClick={() => {
                const detected = detectBaselineWindow(timeseriesFull, 30);
                setBaseline(detected, timeseriesFull);
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
          }
        >
          STEP 1 — ベースライン区間
        </SettingSubLabel>
        {baselineRange ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div style={{
              fontFamily: 'Roboto Mono, monospace', fontSize: '0.88rem', fontWeight: 700,
              color: isBaselineActive ? 'oklch(0.70 0.14 195)' : 'oklch(0.75 0.008 250)',
            }}>
              {baselineRange[0]}s 〜 {baselineRange[1]}s
            </div>
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)' }}>
              （{(baselineRange[1] - baselineRange[0]).toFixed(1)}秒区間{quality ? ` ・ ${quality.frames.toLocaleString()}フレーム` : ''}）
            </span>
          </div>
        ) : (
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)' }}>
            未設定 — TIME RANGE FILTERで無表情区間を選択し、「ベースラインとして設定」を押してください
          </p>
        )}

        {/* 品質警告: 区間が短い / ばらつきが大きい場合に注意喚起（研究妥当性の担保） */}
        {quality && (quality.shortWindow || quality.highVariance) && (
          <div className="mt-2 flex flex-col gap-1">
            {quality.shortWindow && (
              <div className="flex items-center gap-1.5" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.78 0.14 70)' }}>
                <AlertTriangle size={12} />
                区間が短い（{quality.windowSec.toFixed(1)}秒）。10秒以上を推奨します。
              </div>
            )}
            {quality.highVariance && (
              <div className="flex items-center gap-1.5" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.78 0.14 70)' }}>
                <AlertTriangle size={12} />
                区間内のばらつきが大きい（最大SD {quality.maxSd.toFixed(1)}）。より落ち着いた区間を選ぶと補正が安定します。
              </div>
            )}
          </div>
        )}
      </SettingBox>

      {/* STEP 2: 補正プレビュー（区間設定済みの場合のみ表示） */}
      {baselineOffsets && (
        <SettingBox className="mb-4">
          <SettingSubLabel color="oklch(0.70 0.14 195)">
            STEP 2 — オフセット値（ベースライン{centerMethod === 'median' ? '中央値' : '平均'} ± SD）
          </SettingSubLabel>
          <div className="flex flex-wrap gap-2">
            {NON_NEUTRAL_EMOTIONS
              .map(e => ({ emotion: e, offset: baselineOffsets[e]?.offset ?? 0, sd: baselineOffsets[e]?.sd ?? 0 }))
              .sort((a, b) => b.offset - a.offset)
              .map(({ emotion, offset, sd }) => (
                <div key={emotion} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: EMOTION_COLORS[emotion] + '18', border: `1px solid ${EMOTION_COLORS[emotion]}40` }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: EMOTION_COLORS[emotion] }} />
                  <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.75 0.008 250)' }}>
                    {EMOTION_LABELS_JA[emotion]}
                  </span>
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', color: EMOTION_COLORS[emotion] }}>
                    {offset.toFixed(2)}
                    <span style={{ color: 'oklch(0.62 0.015 255)' }}> ±{sd.toFixed(2)}</span>
                  </span>
                </div>
              ))}
          </div>
        </SettingBox>
      )}

      {/* STEP 3: 補正方式（中心値）の選択（区間設定済みのみ表示） */}
      {baselineRange && (
        <SettingBox className="mt-4">
          {/* 補正方式（中心値） */}
          <SettingSubLabel color="oklch(0.70 0.14 195)">
            STEP 3 — 補正方式（中心値）
          </SettingSubLabel>
          <div className="flex gap-2">
            {CENTER_OPTIONS.map(opt => {
              const active = centerMethod === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setCenterMethod(opt.value)}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    fontFamily: 'Noto Sans JP, sans-serif',
                    background: active ? 'rgba(0,180,216,0.2)' : 'oklch(0.20 0.04 255)',
                    color: active ? 'oklch(0.70 0.14 195)' : 'oklch(0.66 0.015 255)',
                    border: `1px solid ${active ? 'rgba(0,180,216,0.5)' : 'oklch(0.30 0.04 255)'}`,
                  }}
                >
                  {active ? '✓ ' : ''}{opt.label}
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', marginTop: '2px', opacity: 0.7 }}>
                    {opt.note}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 解除 */}
          <div className="flex items-center gap-3 mt-4">
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
              ベースライン設定を解除する
            </button>
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)', fontStyle: 'italic' }}>
              元データは常に保持されます。上部バナーからも解除できます。
            </span>
          </div>

          {/* 補正後データの出力（補正が計算済みのときのみ） */}
          {baselineOffsets && (
            <div className="flex items-center gap-3 mt-4 pt-4" style={{ borderTop: '1px solid oklch(0.26 0.04 255)' }}>
              <button
                onClick={exportCorrectedCSV}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  fontFamily: 'Noto Sans JP, sans-serif',
                  background: 'oklch(0.32 0.12 160)',
                  color: 'white',
                  border: '1px solid oklch(0.52 0.18 160)',
                }}
                title="補正後の全フレームデータを、補正区間・方式・モード・日時のメタデータ付きでCSV出力します"
              >
                <Download size={14} />
                補正後データを出力
              </button>
              <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)', fontStyle: 'italic' }}>
                現在の表示モード（{displayMode}）で補正した値を出力します。
              </span>
            </div>
          )}
        </SettingBox>
      )}
    </CollapsibleCard>
  );
}
