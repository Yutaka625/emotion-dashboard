/**
 * BaselineContext
 * ベースライン補正の状態をアプリ全体で共有するための Context。
 * ThemeContext.tsx と同じ設計パターンで実装。
 */

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { computeBaselineOffsets } from '@/lib/csvAnalyzer';
import type { BaselineOffsets, BaselineCenter, BaselineDisplayMode, TimeseriesPoint } from '@/lib/types';

// Context に格納する状態と操作の型定義
interface BaselineContextType {
  /** 設定済みのベースライン区間（秒）。未設定なら null */
  baselineRange: [number, number] | null;
  /** 計算済みの各感情の { offset, sd }。未設定なら null */
  baselineOffsets: BaselineOffsets | null;
  /**
   * 補正がグラフに適用されているかどうか（派生値）。
   * displayMode が 'absolute' 以外 かつ 区間・オフセットが揃っているとき true。
   */
  isBaselineActive: boolean;
  /** 中心値の計算方式（'mean'=平均減算 / 'median'=中央値減算）。デフォルト 'mean' */
  centerMethod: BaselineCenter;
  /** 中心値方式を切り替える（区間設定済みなら offsets を再計算） */
  setCenterMethod: (c: BaselineCenter) => void;
  /**
   * 補正後スコアの表示モード。デフォルト 'absolute'（補正なし=一般向け）。
   * absolute / deviation / lift / zscore
   */
  displayMode: BaselineDisplayMode;
  /** 表示モードを切り替える */
  setDisplayMode: (m: BaselineDisplayMode) => void;
  /**
   * ベースライン区間を設定してオフセットを計算する。
   * 区間設定時は displayMode を 'deviation' に切り替える（意味のある既定へ）。
   * @param range - ベースライン区間 [開始秒, 終了秒]
   * @param data  - timeseries_full 全体のデータ（計算に使用）
   */
  setBaseline: (range: [number, number], data: TimeseriesPoint[]) => void;
  /** 補正を解除して区間・オフセットを初期化（displayMode は 'absolute' に戻す） */
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
  // 中心値方式はユーザー設定として補正解除後も維持する
  const [centerMethod, setCenterMethodState] = useState<BaselineCenter>('mean');
  // 表示モード。デフォルトは absolute（補正なし）
  const [displayMode, setDisplayMode] = useState<BaselineDisplayMode>('absolute');

  // 中心値方式の変更時に offsets を再計算するため、最後に設定したデータと区間を保持する
  const lastDataRef = useRef<TimeseriesPoint[] | null>(null);

  // 補正適用中かどうかの派生値
  const isBaselineActive = displayMode !== 'absolute' && baselineRange !== null && baselineOffsets !== null;

  // ベースライン区間を設定してオフセットを計算する
  const setBaseline = useCallback((range: [number, number], data: TimeseriesPoint[]) => {
    lastDataRef.current = data;
    const offsets = computeBaselineOffsets(data, range[0], range[1], centerMethod);
    setBaselineRange(range);
    setBaselineOffsets(offsets);
    // 区間を設定したら意味のある既定（偏差）へ。すでに補正モードならそのまま維持
    setDisplayMode(prev => (prev === 'absolute' ? 'deviation' : prev));
  }, [centerMethod]);

  // 中心値方式を切り替え、区間設定済みなら offsets を再計算する
  const setCenterMethod = useCallback((c: BaselineCenter) => {
    setCenterMethodState(c);
    if (baselineRange && lastDataRef.current) {
      const offsets = computeBaselineOffsets(lastDataRef.current, baselineRange[0], baselineRange[1], c);
      setBaselineOffsets(offsets);
    }
  }, [baselineRange]);

  // 補正を解除して区間・オフセットを初期化（centerMethod はユーザー設定として維持）
  const clearBaseline = useCallback(() => {
    setBaselineRange(null);
    setBaselineOffsets(null);
    setDisplayMode('absolute');
  }, []);

  return (
    <BaselineContext.Provider value={{
      baselineRange,
      baselineOffsets,
      isBaselineActive,
      centerMethod,
      setCenterMethod,
      displayMode,
      setDisplayMode,
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
