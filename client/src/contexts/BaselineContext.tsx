/**
 * BaselineContext
 * ベースライン補正の状態をアプリ全体で共有するための Context。
 * ThemeContext.tsx と同じ設計パターンで実装。
 */

import React, { createContext, useCallback, useContext, useState } from 'react';
import { computeBaselineOffsets } from '@/lib/csvAnalyzer';
import type { BaselineOffsets, TimeseriesPoint } from '@/lib/types';

// Context に格納する状態と操作の型定義
interface BaselineContextType {
  /** 設定済みのベースライン区間（秒）。未設定なら null */
  baselineRange: [number, number] | null;
  /** 計算済みの各感情オフセット値。未設定なら null */
  baselineOffsets: BaselineOffsets | null;
  /** 補正がグラフに適用されているかどうか */
  isBaselineActive: boolean;
  /**
   * true: マイナスを0に丸める（一般向けデフォルト）
   * false: マイナス値をそのまま表示（研究者向け signed モード）
   */
  clampNegatives: boolean;
  /** clampNegatives を切り替える */
  setClampNegatives: (v: boolean) => void;
  /**
   * ベースライン区間を設定してオフセットを計算し、補正を有効にする
   * @param range - ベースライン区間 [開始秒, 終了秒]
   * @param data  - timeseries_full 全体のデータ（計算に使用）
   */
  setBaseline: (range: [number, number], data: TimeseriesPoint[]) => void;
  /** 補正を解除して全状態を初期値に戻す */
  clearBaseline: () => void;
}

const BaselineContext = createContext<BaselineContextType | undefined>(undefined);

interface BaselineProviderProps {
  children: React.ReactNode;
}

/** アプリのルートで使用する Provider */
export function BaselineProvider({ children }: BaselineProviderProps) {
  const [baselineRange, setBaselineRange] = useState<[number, number] | null>(null);
  const [baselineOffsets, setBaselineOffsets] = useState<BaselineOffsets | null>(null);
  const [isBaselineActive, setIsBaselineActive] = useState(false);
  // デフォルト true = 0に丸める（一般向け）。ユーザー設定として補正解除時もリセットしない
  const [clampNegatives, setClampNegatives] = useState(true);

  // ベースライン区間を設定してオフセットを計算し、補正を有効にする
  const setBaseline = useCallback((range: [number, number], data: TimeseriesPoint[]) => {
    const offsets = computeBaselineOffsets(data, range[0], range[1]);
    setBaselineRange(range);
    setBaselineOffsets(offsets);
    setIsBaselineActive(true);
  }, []);

  // 補正を解除して全状態を初期値に戻す（clampNegatives はユーザー設定として維持）
  const clearBaseline = useCallback(() => {
    setBaselineRange(null);
    setBaselineOffsets(null);
    setIsBaselineActive(false);
  }, []);

  return (
    <BaselineContext.Provider value={{
      baselineRange,
      baselineOffsets,
      isBaselineActive,
      clampNegatives,
      setClampNegatives,
      setBaseline,
      clearBaseline,
    }}>
      {children}
    </BaselineContext.Provider>
  );
}

/** BaselineContext を使うためのカスタムフック */
export function useBaseline() {
  const context = useContext(BaselineContext);
  if (!context) {
    throw new Error('useBaseline は BaselineProvider の中で使ってください');
  }
  return context;
}
