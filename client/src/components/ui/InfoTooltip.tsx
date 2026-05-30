/**
 * InfoTooltip
 * ⓘ アイコンにマウスを乗せると説明文をポップアップ表示する小さな部品。
 * カードの説明文をレイアウトから追い出し、必要なときだけ見せるために使う。
 *
 * 既存の Radix ベース Tooltip（ui/tooltip.tsx）をラップしているため、
 * キーボード操作（Tabでフォーカス→説明表示）にも対応している。
 */

import { Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface Props {
  /** ツールチップに表示する説明文 */
  text: string;
  /** アイコンサイズ（px）。省略時は 13 */
  size?: number;
}

export default function InfoTooltip({ text, size = 13 }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* ボタンにしてキーボードフォーカス可能にする。type="button" でフォーム送信を防ぐ */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full transition-colors"
          style={{ color: 'oklch(0.66 0.015 255)', cursor: 'help' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'oklch(0.75 0.10 255)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'oklch(0.66 0.015 255)')}
          aria-label="説明を表示"
        >
          <Info size={size} />
        </button>
      </TooltipTrigger>
      {/* 既定配色（明るいバブル＋濃い文字）。矢印と色が揃い高コントラストで読みやすい */}
      <TooltipContent
        side="top"
        className="max-w-xs"
        style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', lineHeight: 1.6 }}
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
