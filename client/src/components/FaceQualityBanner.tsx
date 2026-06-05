/**
 * FaceQualityBanner
 * 少フレームの FaceID（検出が不安定な可能性）をノイズ除外したことを示す小バッジ。
 *
 * - マルチフェイスか否かに依らず、除外（minor）が1件以上ある時だけ表示する。
 *   （実顔1つ＋ノイズ多数 のケースでも品質を伝えるため）
 */

import { Users } from 'lucide-react';
import { useFaceID } from '@/contexts/FaceIDContext';

export default function FaceQualityBanner() {
  const { quality } = useFaceID();
  const excluded = quality.minor.length;
  if (excluded === 0) return null;

  const detected = quality.kept.length + excluded;

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
      style={{
        fontFamily: 'Noto Sans JP, sans-serif',
        fontSize: '0.62rem',
        fontWeight: 600,
        background: 'oklch(0.75 0.16 70 / 0.14)',
        border: '1px solid oklch(0.75 0.16 70 / 0.50)',
        color: 'oklch(0.82 0.15 70)',
        whiteSpace: 'nowrap',
      }}
      title={`FaceID を ${detected} 個検出。うち ${excluded} 個は少フレーム（総フレームの5%未満または約3秒未満）のため解析対象から除外しています。検出が不安定な可能性があります。`}
    >
      <Users size={12} />
      FaceID {detected}個検出 / {excluded}個をノイズ除外
    </div>
  );
}
