/**
 * FaceIDContext
 * 複数の FaceID（顔）を含む CSV データの選択状態をアプリ全体で共有するための Context。
 * BaselineContext.tsx と同じ設計パターンで実装。
 *
 * - FaceID 列がない CSV → isMultiFace = false、セレクター非表示、従来と同じ動作
 * - FaceID 列あり・2人以上 → isMultiFace = true、セレクター表示
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { computeDashboardData } from '@/lib/csvAnalyzer';
import type { DashboardData, MultiFaceData } from '@/lib/types';

// Context に格納する状態と操作の型定義
interface FaceIDContextType {
  /** 利用可能な全 FaceID。空配列 = FaceID 列なし or 1人のみ */
  availableFaceIds: string[];
  /** 現在選択中の FaceID */
  selectedFaceIds: string[];
  /** マルチフェイスモードか（FaceID 列が存在し、2つ以上の値がある） */
  isMultiFace: boolean;
  /** 現在の選択に基づく DashboardData */
  activeDashboardData: DashboardData | null;
  /** CSV アップロード時にマルチフェイスデータを設定する */
  setMultiFaceData: (data: MultiFaceData | null) => void;
  /** 個別 FaceID の選択をトグルする */
  toggleFaceId: (faceId: string) => void;
  /** 全 FaceID を選択する（まとめて表示） */
  selectAll: () => void;
  /** 単一 FaceID のみ選択する（個別表示） */
  selectOne: (faceId: string) => void;
}

const FaceIDContext = createContext<FaceIDContextType | undefined>(undefined);

interface FaceIDProviderProps {
  children: React.ReactNode;
}

/** アプリのルートで使用する Provider */
export function FaceIDProvider({ children }: FaceIDProviderProps) {
  const [multiFaceData, setMultiFaceDataState] = useState<MultiFaceData | null>(null);
  const [selectedFaceIds, setSelectedFaceIds] = useState<string[]>([]);

  // マルチフェイスデータをセットする（CSV アップロード時に呼ばれる）
  const setMultiFaceData = useCallback((data: MultiFaceData | null) => {
    setMultiFaceDataState(data);
    // 初期状態: 全 FaceID を選択（全員表示）
    if (data && data.faceIds.length > 0) {
      setSelectedFaceIds([...data.faceIds]);
    } else {
      setSelectedFaceIds([]);
    }
  }, []);

  // 利用可能な FaceID 一覧
  const availableFaceIds = multiFaceData?.faceIds ?? [];

  // マルチフェイスモードかどうか
  const isMultiFace = availableFaceIds.length >= 2;

  // 個別 FaceID のトグル（最低1つは選択を維持する）
  const toggleFaceId = useCallback((faceId: string) => {
    setSelectedFaceIds(prev => {
      const isSelected = prev.includes(faceId);
      if (isSelected) {
        // 最後の1つは外せない
        if (prev.length <= 1) return prev;
        return prev.filter(id => id !== faceId);
      } else {
        return [...prev, faceId];
      }
    });
  }, []);

  // 全 FaceID を選択
  const selectAll = useCallback(() => {
    setSelectedFaceIds([...availableFaceIds]);
  }, [availableFaceIds]);

  // 単一 FaceID のみ選択
  const selectOne = useCallback((faceId: string) => {
    setSelectedFaceIds([faceId]);
  }, []);

  // 現在の選択に基づく DashboardData を計算する
  const activeDashboardData = useMemo(() => {
    if (!multiFaceData) return null;

    // マルチフェイスモードでない場合は全体データをそのまま返す
    if (!isMultiFace) return multiFaceData.allCombined;

    // 全員選択 → 事前計算済みの allCombined を返す
    if (selectedFaceIds.length === availableFaceIds.length) {
      return multiFaceData.allCombined;
    }

    // 1人だけ選択 → 事前計算済みの perFace を返す（高速）
    if (selectedFaceIds.length === 1) {
      return multiFaceData.perFace.get(selectedFaceIds[0]) ?? multiFaceData.allCombined;
    }

    // 複数（全未満）選択 → 対象行を結合してオンデマンドで計算
    const mergedRows: Record<string, string>[] = [];
    for (const faceId of selectedFaceIds) {
      const faceRows = multiFaceData.rawRowsByFace.get(faceId);
      if (faceRows) mergedRows.push(...faceRows);
    }
    if (mergedRows.length === 0) return multiFaceData.allCombined;

    try {
      return computeDashboardData(mergedRows, multiFaceData.filename);
    } catch {
      // 計算エラー時は全体データにフォールバック
      return multiFaceData.allCombined;
    }
  }, [multiFaceData, selectedFaceIds, availableFaceIds, isMultiFace]);

  return (
    <FaceIDContext.Provider value={{
      availableFaceIds,
      selectedFaceIds,
      isMultiFace,
      activeDashboardData,
      setMultiFaceData,
      toggleFaceId,
      selectAll,
      selectOne,
    }}>
      {children}
    </FaceIDContext.Provider>
  );
}

/** FaceIDContext を使うためのカスタムフック */
export function useFaceID() {
  const context = useContext(FaceIDContext);
  if (!context) {
    throw new Error('useFaceID は FaceIDProvider の中で使ってください');
  }
  return context;
}
