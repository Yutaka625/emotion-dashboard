/**
 * CollapsibleCard
 * 設定カードの共通ガワ（外枠＋ヘッダー＋折りたたみ本体）。
 *
 * 各設定カードに共通する「ラベル / タイトル / 説明 / バッジ」のヘッダーを集約し、
 * 以下の2機能を内蔵する:
 *   - 折りたたみトグル（ヘッダー右の ▲▼ ボタンで本体を開閉）
 *   - 説明文のツールチップ化（タイトル横の ⓘ にホバーで説明表示）
 *
 * 開閉状態は storageKey を指定すると localStorage に保存し、再訪時も維持する。
 */

import { useState, useEffect, type ReactNode, type CSSProperties } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import TierBadge, { type Tier } from '@/components/ui/TierBadge';

interface Props {
  /** セクションラベル（例: BASELINE SETTINGS） */
  label: string;
  /** ラベルの文字色 */
  labelColor?: string;
  /** 日本語タイトル（例: ベースライン補正設定） */
  title: string;
  /** タイトルの文字色 */
  titleColor?: string;
  /** 説明文（指定するとタイトル横に ⓘ ツールチップを表示） */
  info?: string;
  /** 料金ティアのバッジ（Pro/Biz）。Core は省略（無印）。 */
  tier?: Tier;
  /** 状態バッジ（例: 「⚡ 補正適用中」）。折りたたみ中も表示される */
  badge?: ReactNode;
  /** カード左端の色帯（省略時は色帯なし） */
  borderLeftColor?: string;
  /** 初期の開閉状態（デフォルト true=開） */
  defaultOpen?: boolean;
  /** localStorage 保存キー（指定時のみ開閉状態を永続化） */
  storageKey?: string;
  /** 折りたたみ対象の本体 */
  children: ReactNode;
}

// localStorage から開閉状態の初期値を読む（無効値・未対応環境では defaultOpen にフォールバック）
function readInitialOpen(storageKey: string | undefined, defaultOpen: boolean): boolean {
  if (!storageKey) return defaultOpen;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'open') return true;
    if (saved === 'closed') return false;
  } catch {
    // localStorage が使えない環境（プライベートモード等）では無視
  }
  return defaultOpen;
}

export default function CollapsibleCard({
  label,
  labelColor = 'oklch(0.68 0.015 255)',
  title,
  titleColor = 'oklch(0.88 0.005 250)',
  info,
  tier,
  badge,
  borderLeftColor,
  defaultOpen = true,
  storageKey,
  children,
}: Props) {
  const [open, setOpen] = useState(() => readInitialOpen(storageKey, defaultOpen));

  // 開閉が変わったら localStorage に保存
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, open ? 'open' : 'closed');
    } catch {
      // 保存できない環境では無視（機能は動作する）
    }
  }, [open, storageKey]);

  return (
    <div
      className="metric-card"
      style={borderLeftColor ? { borderLeft: `3px solid ${borderLeftColor}` } : undefined}
    >
      {/* ヘッダー（常時表示）。クリックで開閉 */}
      <div className="flex items-start justify-between gap-3" style={{ marginBottom: open ? '0.75rem' : 0 }}>
        <div className="min-w-0">
          <div className="section-label mb-1" style={{ color: labelColor }}>{label}</div>
          {/* ⓘ は日本語タイトル側に付ける（カードの内容説明をタイトルから確認できるように） */}
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: titleColor }}>
              {title}
            </span>
            {info && <InfoTooltip text={info} />}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* ティアバッジ・状態バッジは折りたたみ中も表示し、一目で確認できるようにする */}
          {tier && <TierBadge tier={tier} />}
          {badge}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="p-1 rounded hbg"
            style={{ color: 'oklch(0.68 0.015 255)', ['--hbg']: 'transparent', ['--hbg-h']: 'oklch(0.26 0.04 255)' } as CSSProperties}
            aria-label={open ? '折りたたむ' : '展開する'}
            aria-expanded={open}
          >
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* 本体（open のときだけ表示） */}
      {open && children}
    </div>
  );
}
