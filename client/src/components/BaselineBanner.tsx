/**
 * BaselineBanner
 * ベースライン補正が有効な間、画面上部に固定表示されるバナー。
 * 補正が無効（isBaselineActive === false）のときは何も描画しない。
 */

import { X } from 'lucide-react';
import { useBaseline } from '@/contexts/BaselineContext';

export default function BaselineBanner() {
  const { isBaselineActive, baselineRange, clearBaseline } = useBaseline();

  // 補正が無効なら何も表示しない
  if (!isBaselineActive || !baselineRange) return null;

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
          background: 'linear-gradient(90deg, rgba(0,180,216,0.18) 0%, rgba(0,180,216,0.08) 100%)',
          borderBottom: '1px solid rgba(0,180,216,0.4)',
          padding: '7px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontFamily: "'Roboto Mono', monospace",
          fontSize: '12px',
        }}
      >
        {/* 点灯ドット（補正中インジケーター） */}
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: 'oklch(0.70 0.14 195)',
            boxShadow: '0 0 6px oklch(0.70 0.14 195)',
            flexShrink: 0,
            display: 'inline-block',
          }}
        />

        <span style={{ color: 'oklch(0.70 0.14 195)', fontWeight: 600 }}>
          ベースライン補正 ON
        </span>

        <span style={{ color: 'rgba(140,160,190,0.55)' }}>|</span>

        <span style={{ color: 'rgba(180,195,220,0.70)' }}>
          区間: {baselineRange[0]}〜{baselineRange[1]}秒
        </span>

        <span style={{ color: 'rgba(140,160,190,0.55)' }}>|</span>

        <span style={{ color: 'rgba(180,195,220,0.70)' }}>オフセット補正</span>

        {/* 解除ボタン（右端） */}
        <button
          onClick={clearBaseline}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(0,180,216,0.15)',
            border: '1px solid rgba(0,180,216,0.4)',
            color: 'oklch(0.70 0.14 195)',
            padding: '3px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontFamily: "'Roboto Mono', monospace",
          }}
          title="ベースライン補正を解除する"
        >
          <X size={11} />
          解除
        </button>
      </div>

      {/* バナーの高さ分だけページコンテンツを押し下げるスペーサー */}
      <div style={{ height: '36px' }} />
    </>
  );
}
