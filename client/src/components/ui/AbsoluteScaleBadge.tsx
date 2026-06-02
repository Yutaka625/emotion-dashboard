/**
 * AbsoluteScaleBadge
 * ベースライン補正が有効なときだけ「この分析は絶対値（補正対象外）」を示す小バッジ。
 *
 * 用途:
 *   circumplex（象限分類）・UXスコア・高次統計など、絶対値スケールが前提で
 *   偏差/Zスコアに変換すると意味が壊れる指標のタブに置く。
 *   補正ON中に未補正の値が混在していることを研究者へ明示し、誤解を防ぐ。
 */

import { useBaseline } from '@/contexts/BaselineContext';

export default function AbsoluteScaleBadge() {
  const { isBaselineActive } = useBaseline();
  // 補正OFFのときは何も表示しない（通常時はこの注記は不要）
  if (!isBaselineActive) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{
        fontFamily: 'Roboto Mono, monospace',
        fontSize: '0.62rem',
        background: 'oklch(0.28 0.04 255)',
        border: '1px solid oklch(0.38 0.04 255)',
        color: 'oklch(0.80 0.01 250)',
      }}
      title="このセクションの指標は絶対値スケールが前提のため、ベースライン補正の対象外です（補正前の値を表示）"
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.68 0.015 255)' }} />
      絶対値表示（補正対象外）
    </span>
  );
}
