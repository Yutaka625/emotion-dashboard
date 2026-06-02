/**
 * AbsoluteScaleBadge
 * ベースライン補正が有効なときだけ「この分析は絶対値（補正対象外）」を示す小バッジ。
 *
 * 用途:
 *   circumplex（象限分類）・UXスコア・高次統計など、絶対値スケールが前提で
 *   偏差/Zスコアに変換すると意味が壊れる指標のタブに置く。
 *   補正ON中に未補正の値が混在していることを研究者へ明示し、誤解を防ぐ。
 */

import { AlertTriangle } from 'lucide-react';
import { useBaseline } from '@/contexts/BaselineContext';

export default function AbsoluteScaleBadge() {
  const { isBaselineActive } = useBaseline();
  // 補正OFFのときは何も表示しない（通常時はこの注記は不要）
  if (!isBaselineActive) return null;

  // 補正ON中に「ここは未補正」と一目で気づけるよう、アンバーの警告スタイルで強調する
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg"
      style={{
        fontFamily: 'Noto Sans JP, sans-serif',
        fontSize: '0.75rem',
        fontWeight: 700,
        background: 'oklch(0.75 0.16 70 / 0.15)',
        border: '1px solid oklch(0.75 0.16 70 / 0.55)',
        color: 'oklch(0.82 0.15 70)',
      }}
      title="このセクションの指標は絶対値スケールが前提のため、ベースライン補正の対象外です（補正前の値を表示しています）"
    >
      <AlertTriangle size={14} />
      ベースライン補正の対象外（絶対値で表示）
    </div>
  );
}
