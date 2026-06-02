/**
 * SettingSubLabel
 * 設定カード本体内の「副見出し」を統一するための共通部品。
 *
 * 例: 「STEP 1 — ベースライン区間」「SMOOTHING METHOD」「WINDOW SIZE」など、
 * 各設定カードの中で小さな見出しとして使う行。
 * これまではカードごとにインラインスタイル（フォント・字詰め・余白）がバラバラだったため、
 * ここに集約して見た目を揃える。
 *
 * action を渡すと、見出しの右側にボタンや現在値などを両端揃えで配置できる。
 */

import type { ReactNode, CSSProperties } from 'react';

interface Props {
  /** 見出しの文字列 */
  children: ReactNode;
  /** アクセント色（省略時はニュートラルなグレー） */
  color?: string;
  /** 追加のクラス（余白の上書きなど） */
  className?: string;
  /** 見出しの右側に置く要素（自動検出ボタン・現在値表示など）。指定すると両端揃えになる */
  action?: ReactNode;
}

// 副見出しの共通スタイル（全カードで統一）
const labelStyle: CSSProperties = {
  fontFamily: 'Roboto Mono, monospace',
  fontSize: '0.65rem',
  fontWeight: 500,
  letterSpacing: '0.08em',
};

export default function SettingSubLabel({
  children,
  color = 'oklch(0.68 0.015 255)',
  className = 'mb-2',
  action,
}: Props) {
  // action がある場合は見出しと右要素を両端に配置
  if (action) {
    return (
      <div className={`flex items-center justify-between ${className}`}>
        <span style={{ ...labelStyle, color }}>{children}</span>
        {action}
      </div>
    );
  }

  // action がない場合は見出しのみ
  return (
    <div className={className} style={{ ...labelStyle, color }}>
      {children}
    </div>
  );
}
