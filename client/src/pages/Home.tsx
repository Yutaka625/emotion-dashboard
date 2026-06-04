/*
 * DESIGN: Neuro-Signal Interface
 * Main dashboard with drag & drop CSV upload flow
 * State: 'upload' → 'dashboard'
 */

import React, { useState, useCallback, useRef } from 'react';
import type { DashboardData } from '@/lib/types';
import { parseCSV, computeDashboardData, detectFaceIdColumn, groupRowsByFaceId, analyzeCSV } from '@/lib/csvAnalyzer';
import { useFaceID } from '@/contexts/FaceIDContext';
import { useCorrectedDashboardData } from '@/hooks/useCorrectedDashboardData';
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
import ComparisonSection from '@/components/sections/ComparisonSection';
import UXResearchSection from '@/components/sections/UXResearchSection';
import { Upload, X, GitCompare, ArrowUp } from 'lucide-react';

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [activeSection, setActiveSection] = useState('overview');
  const [isDragOverDashboard, setIsDragOverDashboard] = useState(false);

  // セクション切り替え時にメインエリアをスクロール先頭に戻す
  const mainRef = useRef<HTMLElement>(null);
  const handleSectionChange = useCallback((id: string) => {
    setActiveSection(id);
    mainRef.current?.scrollTo(0, 0);
  }, []);

  // 第2CSV（比較用）
  const [secondaryData, setSecondaryData] = useState<DashboardData | null>(null);
  const [secondaryFilename, setSecondaryFilename] = useState<string>('');
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  const handleSecondaryCSV = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      try {
        const newData = analyzeCSV(text, file.name);
        setSecondaryData(newData);
        setSecondaryFilename(file.name);
        setActiveSection('comparison');
      } catch {
        // ignore
      }
    };
    reader.readAsText(file);
  }, []);

  // マルチ FaceID の状態管理（Context 経由）
  const { activeDashboardData, setMultiFaceData, isMultiFace } = useFaceID();

  // FaceID 選択中はその DashboardData、未選択/非マルチフェイスなら従来の data を使う
  const baseData = (isMultiFace && activeDashboardData) ? activeDashboardData : data;
  // ベースライン補正が有効なとき、感情統計を補正後の値で差し替える（hooks は early return より前に呼ぶ）
  const displayData = useCorrectedDashboardData(baseData);

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
    setSecondaryData(null);
    setSecondaryFilename('');
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

  // data は early return 後に非 null 保証。displayData も非 null だが型上は null を許容するため ?? でフォールバック
  const safeDisplayData = displayData ?? data;

  const sectionIds = ['overview', 'timeseries', 'engagement', 'emotions', 'transitions', 'academic', 'actionunits', 'comparison', 'uxresearch'] as const;
  const sectionComponents: Record<string, React.ReactNode> = {
    overview:    <OverviewSection data={safeDisplayData} />,
    timeseries:  <TimeseriesSection data={safeDisplayData} rawTimeseries={(baseData ?? safeDisplayData).timeseries_full} />,
    engagement:  <EngagementValenceSection data={safeDisplayData} />,
    emotions:    <EmotionsSection data={safeDisplayData} />,
    transitions: <TransitionsSection data={safeDisplayData} />,
    academic:    <AcademicSection data={safeDisplayData} />,
    actionunits: <ActionUnitsSection data={safeDisplayData} />,
    comparison:  secondaryData
      ? <ComparisonSection dataA={safeDisplayData} dataB={secondaryData} labelA={filename || 'Session A'} labelB={secondaryFilename || 'Session B'} />
      : (
        // 比較CSV未追加時の空状態。一文だけだと追加方法が分からないため、
        // 機能説明と「直接ファイルを選ぶボタン」＋「右上ボタンへの矢印」で導線を示す。
        <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
          <div
            className="flex flex-col items-center text-center px-8 py-10 rounded-2xl"
            style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.32 0.04 255)', maxWidth: '440px' }}
          >
            <div
              className="flex items-center justify-center rounded-full mb-4"
              style={{ width: '56px', height: '56px', background: 'oklch(0.25 0.08 300)', border: '1px solid oklch(0.45 0.16 300)' }}
            >
              <GitCompare size={26} style={{ color: 'oklch(0.78 0.22 300)' }} />
            </div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'oklch(0.88 0.005 250)', marginBottom: '0.5rem' }}>
              セッション比較を始める
            </div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.82rem', color: 'oklch(0.68 0.015 255)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              もう1つのCSVを追加すると、2つのセッションをA/B並列で表示し、
              感情・指標の差分や統計検定（Welch t検定・効果量）を確認できます。
            </p>
            <button
              onClick={() => secondaryInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg hbg"
              style={{ border: '1px solid oklch(0.45 0.16 300)', color: 'oklch(0.82 0.20 300)', fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.85rem', ['--hbg']: 'oklch(0.25 0.08 300)', ['--hbg-h']: 'oklch(0.30 0.10 300)' } as React.CSSProperties}
            >
              <GitCompare size={16} />
              ＋ 比較用CSVを選択
            </button>
            <div className="flex items-center gap-1.5 mt-4" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.60 0.015 255)' }}>
              <ArrowUp size={13} />
              右上の「＋比較CSV」ボタンからも追加できます
            </div>
          </div>
        </div>
      ),
    uxresearch: <UXResearchSection data={safeDisplayData} />,
  };

  return (
    <div
      className="flex h-screen overflow-hidden relative dashboard-root"
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
      <Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} hasComparison={!!secondaryData} meta={displayData?.meta} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden dashboard-inner">
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
            {/* マルチ FaceID セレクター（複数人データの場合のみ表示） */}
            <FaceIDSelector />

            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)' }}>
              {safeDisplayData.meta.total_frames.toLocaleString()} frames · {safeDisplayData.meta.duration_minutes.toFixed(2)} min
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'oklch(0.70 0.14 195 / 0.12)', border: '1px solid oklch(0.70 0.14 195 / 0.30)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.70 0.14 195)' }} />
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.70 0.14 195)' }}>
                {safeDisplayData.meta.recording_date}
              </span>
            </div>

            {/* ファイル名 + 別のファイルを読み込むボタン（統合済み） */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              style={{ background: 'oklch(0.27 0.04 255)', border: '1px solid oklch(0.32 0.04 255)' }}
              onClick={handleReset}
              title="別のCSVファイルを読み込む"
            >
              <Upload size={12} style={{ color: 'oklch(0.68 0.015 255)', flexShrink: 0 }} />
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
              <X size={12} style={{ color: 'oklch(0.68 0.015 255)', flexShrink: 0 }} />
            </div>

            {/* 比較CSV追加ボタン */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
              style={{
                background: secondaryData ? 'oklch(0.25 0.08 300)' : 'oklch(0.27 0.04 255)',
                border: `1px solid ${secondaryData ? 'oklch(0.45 0.16 300)' : 'oklch(0.32 0.04 255)'}`,
              }}
              onClick={() => secondaryInputRef.current?.click()}
              title="比較用CSVを追加（セッション比較分析）"
            >
              <GitCompare size={12} style={{ color: secondaryData ? 'oklch(0.78 0.22 300)' : 'oklch(0.68 0.015 255)' }} />
              <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: secondaryData ? 'oklch(0.78 0.22 300)' : 'oklch(0.72 0.008 250)' }}>
                {secondaryData ? `比較中: ${secondaryFilename.length > 12 ? secondaryFilename.slice(0, 12) + '…' : secondaryFilename}` : '＋比較CSV'}
              </span>
              {secondaryData && (
                <button
                  onClick={e => { e.stopPropagation(); setSecondaryData(null); setSecondaryFilename(''); }}
                  style={{ color: 'oklch(0.68 0.015 255)', lineHeight: 1 }}
                  title="比較データを削除"
                >
                  <X size={10} />
                </button>
              )}
            </div>
            <input
              ref={secondaryInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleSecondaryCSV(f); e.target.value = ''; }}
            />
          </div>

          {/* ガイドリンク（右端） */}
          <a
            href="KSDV_User-Guide.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hbd hfg"
            style={{
              background: 'oklch(0.27 0.04 255)',
              borderWidth: '1px',
              borderStyle: 'solid',
              textDecoration: 'none',
              flexShrink: 0,
              ['--hbd']: 'oklch(0.32 0.04 255)',
              ['--hbd-h']: 'oklch(0.70 0.14 195 / 0.5)',
              ['--hfg']: 'oklch(0.72 0.008 250)',
              ['--hfg-h']: 'oklch(0.70 0.14 195)',
            } as React.CSSProperties}
            title="使い方ガイドを開く"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem' }}>使い方</span>
          </a>
        </header>

        {/* Scrollable Content */}
        {/* 各セクションを常時マウントし、非アクティブ時は display:none で隠す。
            これによりセクション切り替えで内部状態がリセットされなくなる。 */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6">
          {sectionIds.map(id => (
            <div key={id} className={activeSection === id ? 'section-fade-in' : undefined} style={{ display: activeSection === id ? 'block' : 'none' }}>
              {sectionComponents[id]}
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
