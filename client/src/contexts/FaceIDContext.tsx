/**
 * FaceIDContext
 * 複数の FaceID（顔）を含む CSV データの選択状態をアプリ全体で共有するための Context。
 *
 * - FaceID 列がない CSV → isMultiFace = false、セレクター非表示、従来と同じ動作
 * - FaceID 列あり・2人以上（ノイズ除外後） → isMultiFace = true、セレクター/専用セクション表示
 *
 * 設計方針:
 * - ノイズ（少フレームFaceID）の判定はデータに固定せず、**しきい値から動的に算出**する。
 *   利用者がしきい値を変更すると kept/minor が即座に再評価される。
 * - 既定はノイズ除外（kept のみ表示・集計）。showMinor で minor も表示可能。
 * - FaceID への任意ラベル名（localStorage 永続化・ファイル名キー）と識別色（EVENT_PALETTE）を提供。
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { computeDashboardData } from '@/lib/csvAnalyzer';
import { EVENT_PALETTE } from '@/contexts/EventsContext';
import type { DashboardData, MultiFaceData, FaceQuality } from '@/lib/types';

const LABELS_STORAGE_KEY = 'ksdv.faceLabels';
// ノイズ判定の既定しきい値（総フレームの割合 / 秒）
export const DEFAULT_MIN_FRACTION = 0.05;
export const DEFAULT_MIN_SECONDS = 3;

function readAllLabels(): Record<string, Record<string, string>> {
  try {
    const raw = localStorage.getItem(LABELS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function writeAllLabels(all: Record<string, Record<string, string>>): void {
  try {
    localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // 無視（永続化なしで継続）
  }
}

interface FaceIDContextType {
  availableFaceIds: string[];
  selectedFaceIds: string[];
  isMultiFace: boolean;
  activeDashboardData: DashboardData | null;
  /** ノイズ判定結果（しきい値から動的算出） */
  quality: FaceQuality;
  /** 少フレーム（minor）の FaceID も表示・選択可能にするか */
  showMinor: boolean;
  setShowMinor: (v: boolean) => void;
  /** ノイズ判定しきい値（総フレーム割合・秒） */
  minFraction: number;
  minSeconds: number;
  setThreshold: (fraction: number, seconds: number) => void;
  resetThreshold: () => void;
  setMultiFaceData: (data: MultiFaceData | null) => void;
  toggleFaceId: (faceId: string) => void;
  selectAll: () => void;
  selectOne: (faceId: string) => void;
  displayName: (faceId: string) => string;
  labelOf: (faceId: string) => string;
  setFaceLabel: (faceId: string, name: string) => void;
  faceColor: (faceId: string) => string;
  getFaceData: (faceId: string) => DashboardData | null;
  faceFrameCount: (faceId: string) => number;
}

const FaceIDContext = createContext<FaceIDContextType | undefined>(undefined);

export function FaceIDProvider({ children }: { children: React.ReactNode }) {
  const [multiFaceData, setMultiFaceDataState] = useState<MultiFaceData | null>(null);
  const [selectedFaceIds, setSelectedFaceIds] = useState<string[]>([]);
  const [showMinor, setShowMinor] = useState(false);
  const [faceLabels, setFaceLabels] = useState<Record<string, string>>({});
  const [minFraction, setMinFraction] = useState(DEFAULT_MIN_FRACTION);
  const [minSeconds, setMinSeconds] = useState(DEFAULT_MIN_SECONDS);

  const allIds = useMemo(() => multiFaceData?.faceIds ?? [], [multiFaceData]);
  const totalFrames = multiFaceData?.totalFrames ?? 0;
  const fps = multiFaceData?.allCombined.meta.fps_avg || 15;

  // ノイズ判定（しきい値から動的算出）: frames < 総フレーム*割合 または < 秒*fps なら minor
  const quality = useMemo<FaceQuality>(() => {
    if (!multiFaceData || allIds.length === 0) return { totalFrames: 0, kept: [], minor: [] };
    const minByFraction = totalFrames * minFraction;
    const minByDuration = minSeconds * fps;
    const kept: string[] = [];
    const minor: { id: string; frames: number }[] = [];
    for (const id of allIds) {
      const frames = multiFaceData.rawRowsByFace.get(id)?.length ?? 0;
      if (frames >= minByFraction && frames >= minByDuration) kept.push(id);
      else minor.push({ id, frames });
    }
    // 全部 minor になった場合は除外せず全件 kept にフォールバック
    if (kept.length === 0) return { totalFrames, kept: [...allIds], minor: [] };
    return { totalFrames, kept, minor };
  }, [multiFaceData, allIds, totalFrames, fps, minFraction, minSeconds]);

  const keptIds = quality.kept;
  const keptKey = keptIds.join('|');
  const minorIds = useMemo(() => quality.minor.map(m => m.id), [quality]);

  const availableFaceIds = useMemo(
    () => (showMinor ? [...keptIds, ...minorIds] : keptIds),
    [keptIds, minorIds, showMinor],
  );
  const isMultiFace = keptIds.length >= 2;

  // マルチフェイスデータをセット。ラベルはファイル名キーで読み込む（選択は下の effect で kept に設定）
  const setMultiFaceData = useCallback((data: MultiFaceData | null) => {
    setMultiFaceDataState(data);
    setShowMinor(false);
    setSelectedFaceIds([]);
    setFaceLabels(data && data.faceIds.length > 0 ? (readAllLabels()[data.filename] ?? {}) : {});
  }, []);

  // データ/しきい値の変化で kept が変わったら、選択を kept 全員にリセット
  useEffect(() => {
    setSelectedFaceIds(keptIds.length > 0 ? [...keptIds] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keptKey]);

  // showMinor 切替などで available が縮んだら、選択から外れた ID を落とす
  useEffect(() => {
    setSelectedFaceIds(prev => {
      const filtered = prev.filter(id => availableFaceIds.includes(id));
      if (filtered.length === prev.length) return prev;
      return filtered.length > 0 ? filtered : [...keptIds];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableFaceIds]);

  const toggleFaceId = useCallback((faceId: string) => {
    setSelectedFaceIds(prev => {
      if (prev.includes(faceId)) {
        if (prev.length <= 1) return prev;
        return prev.filter(id => id !== faceId);
      }
      return [...prev, faceId];
    });
  }, []);
  const selectAll = useCallback(() => setSelectedFaceIds([...availableFaceIds]), [availableFaceIds]);
  const selectOne = useCallback((faceId: string) => setSelectedFaceIds([faceId]), []);

  const setThreshold = useCallback((fraction: number, seconds: number) => {
    setMinFraction(Number.isFinite(fraction) ? Math.max(0, fraction) : DEFAULT_MIN_FRACTION);
    setMinSeconds(Number.isFinite(seconds) ? Math.max(0, seconds) : DEFAULT_MIN_SECONDS);
  }, []);
  const resetThreshold = useCallback(() => {
    setMinFraction(DEFAULT_MIN_FRACTION);
    setMinSeconds(DEFAULT_MIN_SECONDS);
  }, []);

  // 表示名・ラベル・色
  const displayName = useCallback(
    (faceId: string) => (faceLabels[faceId]?.trim() ? faceLabels[faceId] : `Face ${faceId}`),
    [faceLabels],
  );
  const labelOf = useCallback((faceId: string) => faceLabels[faceId] ?? '', [faceLabels]);
  const setFaceLabel = useCallback((faceId: string, name: string) => {
    setFaceLabels(prev => {
      const next = { ...prev, [faceId]: name };
      const fname = multiFaceData?.filename;
      if (fname) {
        const all = readAllLabels();
        all[fname] = next;
        writeAllLabels(all);
      }
      return next;
    });
  }, [multiFaceData]);
  const faceColor = useCallback((faceId: string) => {
    const idx = availableFaceIds.indexOf(faceId);
    return EVENT_PALETTE[(idx < 0 ? 0 : idx) % EVENT_PALETTE.length];
  }, [availableFaceIds]);
  const getFaceData = useCallback(
    (faceId: string) => multiFaceData?.perFace.get(faceId) ?? null,
    [multiFaceData],
  );
  const faceFrameCount = useCallback(
    (faceId: string) => multiFaceData?.rawRowsByFace.get(faceId)?.length ?? 0,
    [multiFaceData],
  );

  // kept のみで合算した DashboardData（denoise）。kept が全件なら allCombined をそのまま使う
  const denoisedCombined = useMemo(() => {
    if (!multiFaceData) return null;
    if (keptIds.length === allIds.length) return multiFaceData.allCombined;
    const rows = keptIds.flatMap(id => multiFaceData.rawRowsByFace.get(id) ?? []);
    if (rows.length === 0) return multiFaceData.allCombined;
    try {
      return computeDashboardData(rows, multiFaceData.filename);
    } catch {
      return multiFaceData.allCombined;
    }
  }, [multiFaceData, keptKey, allIds.length]);

  // 現在の選択に基づく DashboardData
  const activeDashboardData = useMemo(() => {
    if (!multiFaceData) return null;
    if (!isMultiFace) {
      // kept が1人ならその顔（denoise後の単一）、0人や非マルチは allCombined
      if (keptIds.length === 1) return multiFaceData.perFace.get(keptIds[0]) ?? multiFaceData.allCombined;
      return multiFaceData.allCombined;
    }
    const sortedSel = [...selectedFaceIds].sort();
    const sortedKept = [...keptIds].sort();
    const isAllKept = sortedSel.length === sortedKept.length && sortedSel.every((v, i) => v === sortedKept[i]);
    if (isAllKept) return denoisedCombined ?? multiFaceData.allCombined;
    if (selectedFaceIds.length === 1) return multiFaceData.perFace.get(selectedFaceIds[0]) ?? multiFaceData.allCombined;
    const rows = selectedFaceIds.flatMap(id => multiFaceData.rawRowsByFace.get(id) ?? []);
    if (rows.length === 0) return denoisedCombined ?? multiFaceData.allCombined;
    try {
      return computeDashboardData(rows, multiFaceData.filename);
    } catch {
      return denoisedCombined ?? multiFaceData.allCombined;
    }
  }, [multiFaceData, isMultiFace, keptIds, selectedFaceIds, denoisedCombined]);

  return (
    <FaceIDContext.Provider value={{
      availableFaceIds,
      selectedFaceIds,
      isMultiFace,
      activeDashboardData,
      quality,
      showMinor,
      setShowMinor,
      minFraction,
      minSeconds,
      setThreshold,
      resetThreshold,
      setMultiFaceData,
      toggleFaceId,
      selectAll,
      selectOne,
      displayName,
      labelOf,
      setFaceLabel,
      faceColor,
      getFaceData,
      faceFrameCount,
    }}>
      {children}
    </FaceIDContext.Provider>
  );
}

export function useFaceID() {
  const context = useContext(FaceIDContext);
  if (!context) {
    throw new Error('useFaceID は FaceIDProvider の中で使ってください');
  }
  return context;
}
