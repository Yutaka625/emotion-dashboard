/**
 * SettingBox
 * 設定カード本体内の「ネストされたボックス」を統一するための共通部品。
 *
 * 例: ベースライン区間の表示枠、スムージングのスライダー枠、イベント追加フォームの枠など、
 * カードの中でひとまとまりの設定を囲む箱。
 * これまではカードごとに角丸（rounded-lg/rounded-xl）・余白（p-3/p-4）・背景・ボーダーが
 * バラバラだったため、ここに集約して見た目を揃える。
 *
 * 外側の余白（mb-4 や mt-4 など）は文脈によって変わるので className で受け取る。
 */

import type { ReactNode } from 'react';

interface Props {
  /** ボックスの中身 */
  children: ReactNode;
  /** 追加のクラス（外側の余白など。例: "mb-4" / "mt-4"） */
  className?: string;
}

export default function SettingBox({ children, className = '' }: Props) {
  return (
    <div
      className={`p-3 rounded-lg ${className}`}
      style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.28 0.04 255)' }}
    >
      {children}
    </div>
  );
}
