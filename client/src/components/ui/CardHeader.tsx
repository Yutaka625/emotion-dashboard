/**
 * CardHeader
 * 主要コンテンツカード（グラフ・表・分析カード）の共通ヘッダー。
 *
 * 構成: 英語ラベル（section-label）＋ 日本語タイトル＋ タイトル横の ⓘ ツールチップ。
 * - ⓘ は「日本語タイトル」側に付け、ホバーでそのカードの内容説明を表示する。
 * - 従来カード本文に置いていた説明文（<p>）は info に集約する（画面をすっきりさせる）。
 *
 * 右側に補助要素（エクスポートボタン等）を置きたい場合は right を渡す。
 */

import type { ReactNode } from 'react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import TierBadge, { type Tier } from '@/components/ui/TierBadge';

interface Props {
  /** 英語ラベル（例: DISTRIBUTION） */
  label: string;
  /** 日本語タイトル（例: 感情出現率） */
  title: string;
  /** ⓘ ツールチップに表示するカードの説明文 */
  info?: string;
  /** ラベルの文字色 */
  labelColor?: string;
  /** タイトルの文字色 */
  titleColor?: string;
  /** 料金ティアのバッジ（Pro/Biz）。Core は省略（無印）。 */
  tier?: Tier;
  /** ヘッダー右側に置く要素（ボタン等） */
  right?: ReactNode;
}

export default function CardHeader({
  label,
  title,
  info,
  labelColor = 'oklch(0.68 0.015 255)',
  titleColor = 'oklch(0.88 0.005 250)',
  tier,
  right,
}: Props) {
  return (
    <div className="flex items-start justify-between gap-3" style={{ marginBottom: '1rem' }}>
      <div className="min-w-0">
        <div className="section-label mb-1" style={{ color: labelColor }}>{label}</div>
        <div className="flex items-center gap-1.5">
          <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: titleColor }}>
            {title}
          </span>
          {info && <InfoTooltip text={info} />}
        </div>
      </div>
      {(tier || right) && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {tier && <TierBadge tier={tier} />}
          {right}
        </div>
      )}
    </div>
  );
}
