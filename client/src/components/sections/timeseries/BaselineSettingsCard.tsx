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

interface Props {
  /** ベースライン自動検出・適用に使う全フレームデータ */
  timeseriesFull: TimeseriesPoint[];
}

export default function BaselineSettingsCard({ timeseriesFull }: Props) {
  const { baselineRange, baselineOffsets, isBaselineActive, setBaseline, clearBaseline, clampNegatives, setClampNegatives } = useBaseline();

  return (
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
              onClick={() => setBaseline(baselineRange, timeseriesFull)}
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

      {/* BASELINE CORRECTION MODE トグル（補正適用中のみ表示） */}
      {isBaselineActive && (
        <div className="mt-4 p-3 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.28 0.04 255)' }}>
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.70 0.14 195)', letterSpacing: '0.08em', marginBottom: '8px' }}>
            BASELINE CORRECTION MODE
          </div>
          <div className="flex gap-2">
            {/* 0に丸めるボタン（一般向け・デフォルト） */}
            <button
              onClick={() => setClampNegatives(true)}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                fontFamily: 'Noto Sans JP, sans-serif',
                background: clampNegatives ? 'rgba(0,180,216,0.2)' : 'oklch(0.20 0.04 255)',
                color: clampNegatives ? 'oklch(0.70 0.14 195)' : 'oklch(0.55 0.015 255)',
                border: `1px solid ${clampNegatives ? 'rgba(0,180,216,0.5)' : 'oklch(0.30 0.04 255)'}`,
              }}
            >
              {clampNegatives ? '✓ ' : ''}0に丸める（一般）
              <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', marginTop: '2px', opacity: 0.7 }}>
                値域: 0〜100
              </div>
            </button>
            {/* マイナスも表示ボタン（研究者向け） */}
            <button
              onClick={() => setClampNegatives(false)}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                fontFamily: 'Noto Sans JP, sans-serif',
                background: !clampNegatives ? 'rgba(0,180,216,0.2)' : 'oklch(0.20 0.04 255)',
                color: !clampNegatives ? 'oklch(0.70 0.14 195)' : 'oklch(0.55 0.015 255)',
                border: `1px solid ${!clampNegatives ? 'rgba(0,180,216,0.5)' : 'oklch(0.30 0.04 255)'}`,
              }}
            >
              {!clampNegatives ? '✓ ' : ''}マイナスも表示
              <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', marginTop: '2px', opacity: 0.7 }}>
                研究者向け
              </div>
            </button>
          </div>
          {/* signed モード選択時の補足説明 */}
          {!clampNegatives && (
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.12 195)', marginTop: '8px' }}>
              ℹ マイナス＝平常時より感情が抑制された状態を示します
            </p>
          )}
        </div>
      )}
    </div>
  );
}
