/**
 * FaceIDSelector
 * ヘッダーバー内に表示するコンパクトな FaceID 切り替え UI。
 * 複数の FaceID が検出された場合のみ表示される。
 *
 * - 「全員」ボタン: 全 FaceID を選択（まとめて表示）
 * - 個別ボタン: クリックで単一選択、Ctrl/Cmd+クリックで複数選択トグル
 */

import { Users, User } from 'lucide-react';
import { useFaceID } from '@/contexts/FaceIDContext';

export default function FaceIDSelector() {
  const {
    availableFaceIds,
    selectedFaceIds,
    isMultiFace,
    selectAll,
    selectOne,
    toggleFaceId,
  } = useFaceID();

  // マルチフェイスモードでなければ何も表示しない
  if (!isMultiFace) return null;

  // 全員選択中かどうか
  const isAllSelected = selectedFaceIds.length === availableFaceIds.length;

  // 個別チップのクリックハンドラ
  const handleChipClick = (faceId: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + クリック → 複数選択をトグル
      toggleFaceId(faceId);
    } else {
      // 通常クリック → その FaceID のみ選択
      selectOne(faceId);
    }
  };

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded-lg"
      style={{
        background: 'oklch(0.25 0.03 255)',
        border: '1px solid oklch(0.32 0.04 255)',
      }}
    >
      {/* アイコンラベル */}
      <Users
        size={12}
        style={{ color: 'oklch(0.68 0.015 255)', flexShrink: 0, marginRight: '2px' }}
      />

      {/* 「全員」ボタン */}
      <button
        onClick={selectAll}
        className="flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors"
        style={{
          background: isAllSelected ? 'oklch(0.70 0.14 195 / 0.20)' : 'transparent',
          border: isAllSelected
            ? '1px solid oklch(0.70 0.14 195 / 0.50)'
            : '1px solid oklch(0.35 0.03 255)',
          color: isAllSelected ? 'oklch(0.70 0.14 195)' : 'oklch(0.66 0.015 255)',
          fontFamily: 'Noto Sans JP, sans-serif',
          fontSize: '0.6rem',
          fontWeight: isAllSelected ? 600 : 400,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
        title="全員のデータをまとめて表示"
      >
        全員
      </button>

      {/* 個別 FaceID チップ */}
      {availableFaceIds.map(faceId => {
        const isSelected = selectedFaceIds.includes(faceId);
        return (
          <button
            key={faceId}
            onClick={(e) => handleChipClick(faceId, e)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors"
            style={{
              background: isSelected ? 'oklch(0.70 0.14 195 / 0.20)' : 'transparent',
              border: isSelected
                ? '1px solid oklch(0.70 0.14 195 / 0.50)'
                : '1px solid oklch(0.35 0.03 255)',
              color: isSelected ? 'oklch(0.70 0.14 195)' : 'oklch(0.66 0.015 255)',
              fontFamily: 'Roboto Mono, monospace',
              fontSize: '0.6rem',
              fontWeight: isSelected ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title={`Face ${faceId} のデータを表示（Ctrl+クリックで複数選択）`}
          >
            <User size={9} />
            {faceId}
          </button>
        );
      })}
    </div>
  );
}
