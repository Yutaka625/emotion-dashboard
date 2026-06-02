/**
 * chartTooltip
 * Recharts の <Tooltip> 共通スタイル。
 *
 * なぜ必要か:
 *   Recharts のツールチップは、項目テキスト（itemStyle）の色を初期状態で
 *   「系列の色」にする。感情グラフでは怒り・軽蔑など暗い色が系列色になるため、
 *   暗い背景のツールチップ上では文字がほとんど読めなくなる。
 *   そこで itemStyle / labelStyle の文字色を明るい色に固定し、系列色に依らず
 *   常に読めるようにする。
 *
 * 使い方:
 *   import { rechartsTooltip } from '@/lib/chartTooltip';
 *   <Tooltip {...rechartsTooltip} formatter={...} />
 *   ※ formatter / labelFormatter / cursor などは併用可（スペッド後に個別指定）。
 */

import type { CSSProperties } from 'react';

// ツールチップの枠（背景・枠線・角丸・既定文字色）
const contentStyle: CSSProperties = {
  fontFamily: 'Noto Sans JP, sans-serif',
  fontSize: '0.8rem',
  border: '1px solid oklch(0.30 0.04 255)',
  borderRadius: '6px',
  background: 'oklch(0.20 0.04 255)',
  color: 'oklch(0.90 0.005 250)',
};

// 項目テキスト・ラベルの文字色（明るい色に固定して可読性を確保）
const textStyle: CSSProperties = { color: 'oklch(0.90 0.005 250)' };

/** <Tooltip {...rechartsTooltip} /> の形で展開して使う共通プロップ */
export const rechartsTooltip = {
  contentStyle,
  itemStyle: textStyle,
  labelStyle: textStyle,
};
