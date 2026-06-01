/**
 * BaselineBanner
 * ベースライン補正が設定されている間、画面上部に固定表示されるバナー。
 * ベースライン区間・オフセットが存在する間は常に表示（表示モードに依存しない）。
 *
 * 機能:
 *   - 補正区間の表示
 *   - 表示モードスイッチャー（どのタブからでも切替可能）
 *   - 解除ボタン
 */

import { X } from 'lucide-react';
import { useBaseline } from '@/contexts/BaselineContext';
import type { BaselineDisplayMode } from '@/lib/types';

// 表示モードのラベル（バナー用にコンパクトに）
const MODE_LABELS: Record<BaselineDisplayMode, string> = {
  absolute:  '絶対値',
  deviation: '偏差',
  lift:      '変化率',
  zscore:    'Zスコア',
};

const MODE_ORDER: BaselineDisplayMode[] = ['absolute', 'deviation', 'lift', 'zscore'];

export default function BaselineBanner() {
  const {
    isBaselineActive,
    baselineRange,
    baselineOffsets,
    displayMode,
    setDisplayMode,
    clearBaseline,
  } = useBaseline();

  // 区間・オフセットが存在する場合のみ表示（表示モードには依存しない）
  const hasBaseline = baselineRange !== null && baselineOffsets !== null;
  if (!hasBaseline || !baselineRange) return null;

  // 絶対値モードのときはバナーを薄く表示（補正が実質オフの状態を視覚的に区別）
  const isOff = !isBaselineActive; // displayMode === 'absolute' のとき

  return (
    <>
      {/* バナー本体: 画面上部に固定 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          background: isOff
            ? 'linear-gradient(90deg, rgba(100,110,130,0.14) 0%, rgba(100,110,130,0.06) 100%)'
            : 'linear-gradient(90deg, rgba(0,180,216,0.18) 0%, rgba(0,180,216,0.08) 100%)',
          borderBottom: `1px solid ${isOff ? 'rgba(100,110,130,0.3)' : 'rgba(0,180,216,0.4)'}`,
          padding: '5px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: "'Roboto Mono', monospace",
          fontSize: '11px',
        }}
      >
        {/* 点灯ドット（補正中インジケーター） */}
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: isOff ? 'oklch(0.55 0.01 250)' : 'oklch(0.70 0.14 195)',
            boxShadow: isOff ? 'none' : '0 0 6px oklch(0.70 0.14 195)',
            flexShrink: 0,
            display: 'inline-block',
          }}
        />

        {/* ラベル */}
        <span style={{ color: isOff ? 'oklch(0.60 0.01 250)' : 'oklch(0.70 0.14 195)', fontWeight: 600, flexShrink: 0 }}>
          ベースライン
        </span>

        <span style={{ color: 'rgba(140,160,190,0.45)', flexShrink: 0 }}>|</span>

        {/* 区間表示 */}
        <span style={{ color: 'rgba(180,195,220,0.65)', flexShrink: 0 }}>
          {baselineRange[0]}〜{baselineRange[1]}s
        </span>

        <span style={{ color: 'rgba(140,160,190,0.45)', flexShrink: 0 }}>|</span>

        {/* 表示モードスイッチャー — どのタブからでも切替可能 */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {MODE_ORDER.map(mode => {
            const active = displayMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setDisplayMode(mode)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontFamily: "'Roboto Mono', monospace",
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: active
                    ? (mode === 'absolute' ? 'rgba(120,130,150,0.3)' : 'rgba(0,180,216,0.25)')
                    : 'transparent',
                  border: `1px solid ${active
                    ? (mode === 'absolute' ? 'rgba(120,130,150,0.5)' : 'rgba(0,180,216,0.6)')
                    : 'rgba(120,130,155,0.25)'}`,
                  color: active
                    ? (mode === 'absolute' ? 'oklch(0.75 0.01 250)' : 'oklch(0.75 0.14 195)')
                    : 'rgba(160,175,200,0.55)',
                  fontWeight: active ? 600 : 400,
                }}
                title={mode === 'absolute' ? '補正なし（生スコア 0〜100）' : `表示モード: ${MODE_LABELS[mode]}`}
              >
                {MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>

        {/* 解除ボタン（右端） */}
        <button
          onClick={clearBaseline}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(100,110,130,0.18)',
            border: '1px solid rgba(100,120,150,0.35)',
            color: 'oklch(0.66 0.01 250)',
            padding: '2px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px',
            fontFamily: "'Roboto Mono', monospace",
            flexShrink: 0,
          }}
          title="ベースライン補正を解除する"
        >
          <X size={10} />
          解除
        </button>
      </div>

      {/* バナーの高さ分だけページコンテンツを押し下げるスペーサー */}
      <div style={{ height: '36px' }} />
    </>
  );
}
