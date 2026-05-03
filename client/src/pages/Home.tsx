/*
 * DESIGN: Neuro-Signal Interface
 * Main dashboard with drag & drop CSV upload flow
 * State: 'upload' → 'dashboard'
 */

import React, { useState, useCallback } from 'react';
import type { DashboardData } from '@/lib/types';
import { parseCSV, computeDashboardData, detectFaceIdColumn, groupRowsByFaceId } from '@/lib/csvAnalyzer';
import { useFaceID } from '@/contexts/FaceIDContext';
import DropZone from '@/components/DropZone';
import Sidebar from '@/components/Sidebar';
import FaceIDSelector from '@/components/FaceIDSelector';
import OverviewSection from '@/components/sections/OverviewSection';
import TimeseriesSection from '@/components/sections/TimeseriesSection';
import EngagementValenceSection from '@/components/sections/EngagementValenceSection';
import EmotionsSection from '@/components/sections/EmotionsSection';
import TransitionsSection from '@/components/sections/TransitionsSection';
import AcademicSection from '@/components/sections/AcademicSection';
import ActionUnitsSection from '@/components/sections/ActionUnitsSection';
import { Upload, X } from 'lucide-react';
import FaceScanIcon from '@/components/FaceScanIcon';

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [activeSection, setActiveSection] = useState('overview');
  const [isDragOverDashboard, setIsDragOverDashboard] = useState(false);

  // マルチ FaceID の状態管理（Context 経由）
  const { activeDashboardData, setMultiFaceData, isMultiFace } = useFaceID();

  // CSV テキストからマルチ FaceID データを構築するヘルパー
  const buildMultiFaceData = useCallback((csvText: string, fname: string, allCombined: DashboardData) => {
    try {
      const rows = parseCSV(csvText);
      if (rows.length === 0) return;
      const headers = Object.keys(rows[0]);
      const faceIdCol = detectFaceIdColumn(headers);

      if (faceIdCol) {
        const grouped = groupRowsByFaceId(rows, faceIdCol);
        const faceIds = Array.from(grouped.keys()).sort();
        if (faceIds.length > 1) {
          // 複数の FaceID が存在 → 各 FaceID の DashboardData を事前計算
          const perFace = new Map<string, DashboardData>();
          grouped.forEach((faceRows, id) => {
            perFace.set(id, computeDashboardData(faceRows, fname));
          });
          setMultiFaceData({ faceIds, perFace, allCombined, rawRowsByFace: grouped, filename: fname });
          return;
        }
      }
      // FaceID 列なし or 1人分のみ → 通常モード
      setMultiFaceData({ faceIds: [], perFace: new Map(), allCombined, rawRowsByFace: new Map(), filename: fname });
    } catch {
      // エラー時は通常モードにフォールバック
      setMultiFaceData({ faceIds: [], perFace: new Map(), allCombined, rawRowsByFace: new Map(), filename: fname });
    }
  }, [setMultiFaceData]);

  const handleDataLoaded = useCallback((newData: DashboardData, newFilename: string, rawCsvText?: string) => {
    setData(newData);
    setFilename(newFilename);
    setActiveSection('overview');
    // マルチ FaceID データを構築（生 CSV テキストがある場合のみ）
    if (rawCsvText) {
      buildMultiFaceData(rawCsvText, newFilename, newData);
    } else {
      // 生テキストなし → 通常モード
      setMultiFaceData({ faceIds: [], perFace: new Map(), allCombined: newData, rawRowsByFace: new Map(), filename: newFilename });
    }
  }, [buildMultiFaceData, setMultiFaceData]);

  const handleReset = useCallback(() => {
    setData(null);
    setFilename('');
    setActiveSection('overview');
    setMultiFaceData(null);
  }, [setMultiFaceData]);

  // Allow re-uploading by dragging onto the dashboard
  const handleDashboardDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDashboard(true);
  }, []);

  const handleDashboardDragLeave = useCallback((e: React.DragEvent) => {
    // Only trigger if leaving the outermost container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOverDashboard(false);
    }
  }, []);

  const handleDashboardDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDashboard(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      // Temporarily reset to trigger DropZone processing
      setData(null);
      setFilename(file.name);
      // Use FileReader to pass to analyzeCSV
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const text = ev.target?.result as string;
        if (!text) return;
        try {
          const { analyzeCSV } = await import('@/lib/csvAnalyzer');
          const newData = analyzeCSV(text, file.name);
          setData(newData);
          setFilename(file.name);
          setActiveSection('overview');
          // マルチ FaceID データを構築
          buildMultiFaceData(text, file.name, newData);
        } catch {
          setData(null);
          setFilename('');
          setMultiFaceData(null);
        }
      };
      reader.readAsText(file);
    }
  }, []);

  // ---- Upload screen ----
  if (!data) {
    return <DropZone onDataLoaded={handleDataLoaded} />;
  }

  // ---- Dashboard screen ----
  // switch による条件レンダリングではなく CSS で show/hide する。
  // こうすることで、セクション切り替え時にコンポーネントが破棄されず、
  // 各セクション内の状態（選択中の感情など）がリセットされない。
  // FaceID 選択中はその DashboardData、未選択/非マルチフェイスなら従来の data を使う
  const displayData = (isMultiFace && activeDashboardData) ? activeDashboardData : data;

  const sectionIds = ['overview', 'timeseries', 'engagement', 'emotions', 'transitions', 'academic', 'actionunits'] as const;
  const sectionComponents: Record<string, React.ReactNode> = {
    overview:    <OverviewSection data={displayData} />,
    timeseries:  <TimeseriesSection data={displayData} />,
    engagement:  <EngagementValenceSection data={displayData} />,
    emotions:    <EmotionsSection data={displayData} />,
    transitions: <TransitionsSection data={displayData} />,
    academic:    <AcademicSection data={displayData} />,
    actionunits: <ActionUnitsSection data={displayData} />,
  };

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{ background: 'oklch(0.18 0.04 255)' }}
      onDragOver={handleDashboardDragOver}
      onDragLeave={handleDashboardDragLeave}
      onDrop={handleDashboardDrop}
    >
      {/* Drag overlay on dashboard */}
      {isDragOverDashboard && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{
            background: 'oklch(0.62 0.18 160 / 0.12)',
            backdropFilter: 'blur(4px)',
            border: '3px dashed oklch(0.62 0.18 160)',
            borderRadius: '0',
          }}
        >
          <div className="text-center">
            <Upload size={48} style={{ color: 'oklch(0.42 0.18 160)', margin: '0 auto 1rem' }} />
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1.25rem', color: 'oklch(0.92 0.005 250)' }}>
              新しいCSVファイルをドロップして再分析
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header
          className="flex items-center justify-between px-6 py-3 flex-shrink-0"
          style={{
            background: 'oklch(0.22 0.04 255)',
            borderBottom: '1px solid oklch(0.28 0.04 255)',
            boxShadow: '0 1px 4px oklch(0.15 0.02 250 / 0.04)',
          }}
        >
          <div className="flex items-center gap-3">
            <FaceScanIcon size={20} color="oklch(0.75 0.008 250)" scanColor="oklch(0.70 0.14 195)" />
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'oklch(0.92 0.005 250)' }}>
              emoSense
            </span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.015 255)' }}>
              Facial Expression Analyzer
            </span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.58 0.015 255)' }}>
              / {activeSection.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* マルチ FaceID セレクター（複数人データの場合のみ表示） */}
            <FaceIDSelector />

            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.58 0.015 255)' }}>
              {displayData.meta.total_frames.toLocaleString()} frames · {displayData.meta.duration_minutes.toFixed(2)} min
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'oklch(0.70 0.14 195 / 0.12)', border: '1px solid oklch(0.70 0.14 195 / 0.30)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.70 0.14 195)' }} />
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.70 0.14 195)' }}>
                {displayData.meta.recording_date}
              </span>
            </div>

            {/* File info + reset button */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'oklch(0.27 0.04 255)', border: '1px solid oklch(0.32 0.04 255)' }}
            >
              <span
                style={{
                  fontFamily: 'Roboto Mono, monospace',
                  fontSize: '0.6rem',
                  color: 'oklch(0.72 0.008 250)',
                  maxWidth: '180px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={filename}
              >
                {filename}
              </span>
              <button
                onClick={handleReset}
                className="flex items-center gap-1 transition-colors"
                style={{ color: 'oklch(0.58 0.015 255)' }}
                title="別のファイルを読み込む"
              >
                <X size={12} />
              </button>
            </div>

            {/* Upload new file hint */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
              style={{ background: 'oklch(0.27 0.04 255)', border: '1px solid oklch(0.32 0.04 255)' }}
              onClick={handleReset}
              title="新しいCSVファイルをアップロード"
            >
              <Upload size={12} style={{ color: 'oklch(0.58 0.015 255)' }} />
              <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.72 0.008 250)' }}>
                別のファイル
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        {/* 各セクションを常時マウントし、非アクティブ時は display:none で隠す。
            これによりセクション切り替えで内部状態がリセットされなくなる。 */}
        <main className="flex-1 overflow-y-auto p-6">
          {sectionIds.map(id => (
            <div key={id} style={{ display: activeSection === id ? 'block' : 'none' }}>
              {sectionComponents[id]}
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
