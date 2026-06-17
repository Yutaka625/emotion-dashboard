/**
 * TierBadge
 * 料金ティア（Pro / Biz）を示す小さなピル型バッジ。
 *
 * お試し期間中は全機能無償だが、将来有料になり得る機能をカードヘッダーで予告するために使う。
 * - Pro=紫＋王冠（解釈指標・状態・比較・レポート出力）
 * - Biz=オレンジ＋ロボット（AIによる予測・インサイト・まとめ）
 * - Core はバッジなし（無印）なので、このコンポーネントは描画しない。
 *
 * ピル全体を Radix Tooltip でラップし、ホバー／フォーカスで「お試し中は無料・将来有料の可能性」を伝える
 * （InfoTooltip と同じ流儀でキーボード操作にも対応）。
 */

import type { CSSProperties } from 'react';
import { Crown, Bot } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { TIER_COLORS } from '@/lib/types';

export type Tier = 'pro' | 'biz';

const TIER_META: Record<Tier, { label: string; icon: typeof Crown; tooltip: string }> = {
  pro: {
    label: 'Pro',
    icon: Crown,
    // 文言はユーザーガイド「カードのプランバッジ」凡例・技術資料1.4と整合させること。
    tooltip:
      'お試し期間中は無料でご利用いただけます。「解釈された指標・独自の状態・データ比較・レポート出力・研究用途の記録機能（セッションメタデータ等）」は、将来「Pro」プランの対象になる可能性があります（有料化の時期・内容・価格は未定）。',
  },
  biz: {
    label: 'Biz',
    icon: Bot,
    // 文言はユーザーガイド「カードのプランバッジ」凡例・技術資料1.4と整合させること。
    tooltip:
      'お試し期間中は無料でご利用いただけます。「AIによる予測・インサイト・まとめ」は、将来「Biz」プランの対象になる可能性があります（有料化の時期・内容・価格は未定）。',
  },
};

interface Props {
  tier: Tier;
  /** アイコン／文字サイズの基準（px）。省略時は 13 */
  size?: number;
}

export default function TierBadge({ tier, size = 13 }: Props) {
  const meta = TIER_META[tier];
  const Icon = meta.icon;
  const color = TIER_COLORS[tier];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full"
          style={{
            background: color,
            color: 'oklch(0.99 0 0)',
            padding: '5px 9px',
            fontFamily: 'Noto Sans JP, sans-serif',
            fontWeight: 600,
            fontSize: `${size * 0.85}px`,
            lineHeight: 1.1,
            cursor: 'help',
            whiteSpace: 'nowrap',
          } as CSSProperties}
          aria-label={`${meta.label}プラン: ${meta.tooltip}`}
        >
          <Icon size={size} strokeWidth={2.25} aria-hidden="true" />
          {meta.label}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs"
        style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', lineHeight: 1.6 }}
      >
        {meta.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
