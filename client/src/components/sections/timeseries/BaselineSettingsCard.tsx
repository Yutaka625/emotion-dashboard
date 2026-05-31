/**
 * BaselineSettingsCard
 * ベースライン補正の設定UI（区間設定・自動検出・適用/解除）
 */

import type { TimeseriesPoint } from '@/lib/types';
import { EMOTION_COLORS, EMOTION_LABELS_JA, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import { Wand2 } from 'lucide-react';
import { useBaseline } from '@/contexts/BaselineContext';
import { detectBaselineWindow } from '@/lib/csvAnalyzer';
import { toast } from 'sonner';
import CollapsibleCard from '@/components/ui/CollapsibleCard';

import type { BaselineCenter, BaselineDisplayMode } from '@/lib/types';

interface Props {
  /** ベースライン自動検出・適用に使う全フレームデータ */
  timeseriesFull: TimeseriesPoint[];
}

// 補正方式（中心値）の選択肢
const CENTER_OPTIONS: { value: BaselineCenter; label: string; note: string }[] = [
  { value: 'mean',   label: '平均',   note: '標準' },
  { value: 'median', label: '中央値', note: '外れ値に頑健' },
];

// 表示モードの選択肢（絶対値＝補正なし、それ以外は補正後の見せ方）
const DISPLAY_MODE_OPTIONS: { value: BaselineDisplayMode; label: string; note: string }[] = [
  { value: 'absolute',  label: '絶対値',  note: '補正なし 0〜100' },
  { value: 'deviation', label: '偏差',    note: 'x − 平常時' },
  { value: 'lift',      label: '変化率',  note: '平常時比 %' },
  { value: 'zscore',    label: 'Zスコア', note: '標準化 SD' },
];

// 表示モード選択時の補足説明（モード別）
const MODE_DESCRIPTIONS: Record<BaselineDisplayMode, string> = {
  absolute:  '補正を適用せず、生の感情スコア（0〜100）をそのまま表示します。',
  deviation: 'マイナス＝平常時より感情が抑制された状態を示します（符号付き偏差）。',
  lift:      '平常時を基準とした増減率（%）です。平常時の値が極めて小さい感情は算出されません。',
  zscore:    '平常時のばらつき（SD）を1単位とした標準化スコアです。被験者間の比較に向きます。',
};

export default function BaselineSettingsCard({ timeseriesFull }: Props) {
  const { baselineRange, baselineOffsets, isBaselineActive, setBaseline, clearBaseline, centerMethod, setCenterMethod, displayMode, setDisplayMode } = useBaseline();

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
      <div className="mb-4 p-3 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.28 0.04 255)' }}>
        <div className="flex items-center justify-between mb-2">
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.70 0.14 195)', letterSpacing: '0.08em' }}>
            STEP 1 — ベースライン区間
          </div>
          {/* 自動検出ボタン */}
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
        </div>
        {baselineRange ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div style={{
              fontFamily: 'Roboto Mono, monospace', fontSize: '0.88rem', fontWeight: 700,
              color: isBaselineActive ? 'oklch(0.70 0.14 195)' : 'oklch(0.75 0.008 250)',
            }}>
              {baselineRange[0]}s 〜 {baselineRange[1]}s
            </div>
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)' }}>
              （{(baselineRange[1] - baselineRange[0]).toFixed(1)}秒区間）
            </span>
          </div>
        ) : (
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)' }}>
            未設定 — TIME RANGE FILTERで無表情区間を選択し、「ベースラインとして設定」を押してください
          </p>
        )}
      </div>

      {/* STEP 2: 補正プレビュー（区間設定済みの場合のみ表示） */}
      {baselineOffsets && (
        <div className="mb-4 p-3 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.28 0.04 255)' }}>
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.70 0.14 195)', letterSpacing: '0.08em', marginBottom: '8px' }}>
            STEP 2 — オフセット値（ベースライン{centerMethod === 'median' ? '中央値' : '平均'}）
          </div>
          <div className="flex flex-wrap gap-2">
            {NON_NEUTRAL_EMOTIONS
              .map(e => ({ emotion: e, offset: baselineOffsets[e]?.offset ?? 0 }))
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

      {/* STEP 3: 補正方式（中心値）・表示モードの選択（区間設定済みのみ表示） */}
      {baselineRange && (
        <div className="mt-4 p-3 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.28 0.04 255)' }}>
          {/* 補正方式（中心値） */}
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.70 0.14 195)', letterSpacing: '0.08em', marginBottom: '8px' }}>
            STEP 3 — 補正方式（中心値）
          </div>
          <div className="flex gap-2 mb-4">
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

          {/* 表示モード */}
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.70 0.14 195)', letterSpacing: '0.08em', marginBottom: '8px' }}>
            表示モード
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {DISPLAY_MODE_OPTIONS.map(opt => {
              const active = displayMode === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setDisplayMode(opt.value)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
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

          {/* 選択中モードの補足説明 */}
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.12 195)', marginTop: '10px' }}>
            ℹ {MODE_DESCRIPTIONS[displayMode]}
          </p>

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
              「絶対値」で補正なし表示に戻せます。元データは常に保持されます。
            </span>
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
}
