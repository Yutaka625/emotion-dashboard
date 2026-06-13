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
import MultiFaceComparisonSection from '@/components/sections/MultiFaceComparisonSection';
import FaceQualityBanner from '@/components/FaceQualityBanner';
import SessionMetadataCard from '@/components/sections/SessionMetadataCard';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { hasAnySessionMeta, readSessionMeta } from '@/lib/sessionMeta';
import { Upload, X, GitCompare, ArrowUp, Settings2 } from 'lucide-react';

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [activeSection, setActiveSection] = useState('overview');
  const [isDragOverDashboard, setIsDragOverDashboard] = useState(false);
  const [studySetupOpen, setStudySetupOpen] = useState(false);
  const [metadataRevision, setMetadataRevision] = useState(0);

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

  // 詳細タブ（比較タブ以外）にどちらのセッションを表示するか。比較データがある時のみ B を選べる。
  const [detailSession, setDetailSession] = useState<'A' | 'B'>('A');

  // CSVテキストから比較用(B)データを解析・設定し、比較タブへ遷移する
  const applySecondaryFromText = useCallback((text: string, name: string) => {
    if (!text) return;
    try {
      const newData = analyzeCSV(text, name);
      setSecondaryData(newData);
      setSecondaryFilename(name);
      setActiveSection('comparison');
    } catch {
      // ignore
    }
  }, []);

  const handleSecondaryCSV = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      applySecondaryFromText(ev.target?.result as string, file.name);
    };
    reader.readAsText(file);
  }, [applySecondaryFromText]);

  // マルチ FaceID の状態管理（Context 経由）
  const { activeDashboardData, setMultiFaceData, isMultiFace } = useFaceID();

  // セッションA（主データ）: FaceID 選択中はその DashboardData、未選択/非マルチフェイスなら従来の data を使う
  const aBaseData = (isMultiFace && activeDashboardData) ? activeDashboardData : data;
  // 詳細タブに表示するセッション。B を選べるのは比較データがある時だけ（無ければ常にA）。
  const selectedBaseData = (detailSession === 'B' && secondaryData) ? secondaryData : aBaseData;
  // ベースライン補正フック（純粋・メモ化済みなので2回呼んでも安全）。
  //   displayA       … 比較タブの dataA 用（常にA。トグルに影響されない）
  //   displaySelected … 詳細タブ用（選択中セッション A or B）
  // hooks は early return より前に呼ぶ。
  const displayA = useCorrectedDashboardData(aBaseData);
  const displaySelected = useCorrectedDashboardData(selectedBaseData);

  // CSV テキストからマルチ FaceID データを構築するヘルパー
  // ※ ノイズ判定（kept/minor）は固定せず、全 FaceID と totalFrames を詰めるだけにする。
  //    実際の除外判定は FaceIDContext がしきい値から動的に行う。
  const buildMultiFaceData = useCallback((csvText: string, fname: string, allCombined: DashboardData) => {
    try {
      const rows = parseCSV(csvText);
      // 生データなし → 最小構成（CSV出力もできない）
      if (rows.length === 0) {
        setMultiFaceData({ faceIds: [], perFace: new Map(), allCombined, rawRowsByFace: new Map(), filename: fname, totalFrames: 0 });
        return;
      }
      const headers = Object.keys(rows[0]);
      const timeCol = headers[0];
      const faceIdCol = detectFaceIdColumn(headers);
      // 単一Face/通常モードでも CSV出力で使えるよう、全生行・時刻列・FaceID列を必ず保持する
      const setPlain = () => setMultiFaceData({
        faceIds: [], perFace: new Map(), allCombined, rawRowsByFace: new Map(),
        filename: fname, totalFrames: 0, allRows: rows, timeCol, faceIdCol,
      });

      if (faceIdCol) {
        const grouped = groupRowsByFaceId(rows, faceIdCol);
        const allIds = Array.from(grouped.keys()).sort();
        if (allIds.length > 1) {
          const totalFrames = new Set(rows.map(r => r[timeCol])).size;
          // 各 FaceID の DashboardData を事前計算（全 ID）
          const perFace = new Map<string, DashboardData>();
          grouped.forEach((faceRows, id) => {
            try { perFace.set(id, computeDashboardData(faceRows, fname)); } catch { /* 空/不正は登録しない */ }
          });
          setMultiFaceData({ faceIds: allIds, perFace, allCombined, rawRowsByFace: grouped, filename: fname, totalFrames, allRows: rows, timeCol, faceIdCol });
          return;
        }
      }
      // FaceID 列なし or 1人分のみ → 通常モード（生行は保持）
      setPlain();
    } catch {
      // エラー時は通常モードにフォールバック（生行なし）
      setMultiFaceData({ faceIds: [], perFace: new Map(), allCombined, rawRowsByFace: new Map(), filename: fname, totalFrames: 0 });
    }
  }, [setMultiFaceData]);

  const handleDataLoaded = useCallback((newData: DashboardData, newFilename: string, rawCsvText?: string) => {
    setData(newData);
    setFilename(newFilename);
    setActiveSection('overview');
    setDetailSession('A'); // 新規読み込み時は詳細タブをAに戻す
    // マルチ FaceID データを構築（生 CSV テキストがある場合のみ）
    if (rawCsvText) {
      buildMultiFaceData(rawCsvText, newFilename, newData);
    } else {
      // 生テキストなし → 通常モード
      setMultiFaceData({ faceIds: [], perFace: new Map(), allCombined: newData, rawRowsByFace: new Map(), filename: newFilename, totalFrames: 0 });
    }
  }, [buildMultiFaceData, setMultiFaceData]);

  const handleReset = useCallback(() => {
    setData(null);
    setFilename('');
    setActiveSection('overview');
    setMultiFaceData(null);
    setSecondaryData(null);
    setSecondaryFilename('');
    setDetailSession('A');
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
          setDetailSession('A'); // 再分析時は詳細タブをAに戻す
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
    return <DropZone onDataLoaded={handleDataLoaded} onComparisonSecondary={applySecondaryFromText} />;
  }

  // ---- Dashboard screen ----
  // switch による条件レンダリングではなく CSS で show/hide する。
  // こうすることで、セクション切り替え時にコンポーネントが破棄されず、
  // 各セクション内の状態（選択中の感情など）がリセットされない。

  // data は early return 後に非 null 保証。補正フックの結果も型上は null を許容するため ?? でフォールバック。
  // safeSelected … 詳細タブ用（選択中セッション）／ safeA … 比較タブの dataA 用（常にA）
  const safeSelected = displaySelected ?? selectedBaseData ?? data;
  const safeA = displayA ?? aBaseData ?? data;
  const metadataFilled = metadataRevision >= 0 && hasAnySessionMeta(readSessionMeta(safeSelected.meta.filename));
  const selectedSessionLabel = detailSession === 'B' && secondaryData ? 'Session B' : 'Session A';

  const sectionIds = ['overview', 'timeseries', 'engagement', 'emotions', 'transitions', 'academic', 'actionunits', 'multiface', 'comparison', 'uxresearch'] as const;
  const sectionComponents: Record<string, React.ReactNode> = {
    overview:    <OverviewSection data={safeSelected} onSectionChange={handleSectionChange} hasComparison={!!secondaryData} />,
    timeseries:  <TimeseriesSection data={safeSelected} rawTimeseries={(selectedBaseData ?? safeSelected).timeseries_full} />,
    engagement:  <EngagementValenceSection data={safeSelected} />,
    emotions:    <EmotionsSection data={safeSelected} />,
    transitions: <TransitionsSection data={safeSelected} />,
    academic:    <AcademicSection data={safeSelected} />,
    actionunits: <ActionUnitsSection data={safeSelected} />,
    multiface:   <MultiFaceComparisonSection />,
    comparison:  secondaryData
      ? <ComparisonSection dataA={safeA} dataB={secondaryData} labelA={filename || 'Session A'} labelB={secondaryFilename || 'Session B'} />
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
    uxresearch: <UXResearchSection data={safeSelected} />,
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
      <Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} hasComparison={!!secondaryData} hasMultiFace={isMultiFace} meta={safeSelected.meta} />

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
            {/* マルチ FaceID セレクター／品質バナーは A 表示中のみ（マルチFaceIDはAの文脈のため） */}
            {detailSession === 'A' && (
              <>
                {/* マルチ FaceID セレクター（複数人データの場合のみ表示） */}
                <FaceIDSelector />
                {/* FaceID 品質バナー（ノイズ除外があった場合のみ表示） */}
                <FaceQualityBanner />
              </>
            )}

            {/* A/B 表示切替（比較データがある時のみ）。詳細タブにどちらのセッションを出すかを切り替える */}
            {secondaryData && (
              <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg" style={{ background: 'oklch(0.25 0.03 255)', border: '1px solid oklch(0.32 0.04 255)' }}>
                <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.58rem', color: 'oklch(0.60 0.015 255)', marginLeft: '2px', marginRight: '1px', whiteSpace: 'nowrap' }}>表示中</span>
                {([
                  { id: 'A' as const, name: filename || 'Session A', color: 'oklch(0.70 0.14 195)' },
                  { id: 'B' as const, name: secondaryFilename || 'Session B', color: 'oklch(0.78 0.22 340)' },
                ]).map(({ id, name, color }) => {
                  const on = detailSession === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setDetailSession(id)}
                      className="px-2 py-0.5 rounded-full transition-colors"
                      title={`${name} のデータを詳細タブに表示`}
                      style={{
                        background: on ? color : 'transparent',
                        color: on ? 'oklch(0.16 0.02 250)' : 'oklch(0.66 0.015 255)',
                        border: `1px solid ${on ? color : 'oklch(0.35 0.03 255)'}`,
                        fontFamily: 'Roboto Mono, monospace',
                        fontSize: '0.62rem',
                        fontWeight: on ? 700 : 400,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {id}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'oklch(0.70 0.14 195 / 0.12)', border: '1px solid oklch(0.70 0.14 195 / 0.30)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.70 0.14 195)' }} />
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.70 0.14 195)' }}>
                {safeSelected.meta.recording_date}
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
                  onClick={e => { e.stopPropagation(); setSecondaryData(null); setSecondaryFilename(''); setDetailSession('A'); }}
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

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setStudySetupOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hbd hfg"
              style={{
                background: 'oklch(0.27 0.04 255)',
                borderWidth: '1px',
                borderStyle: 'solid',
                ['--hbd']: 'oklch(0.32 0.04 255)',
                ['--hbd-h']: 'oklch(0.70 0.14 195 / 0.5)',
                ['--hfg']: 'oklch(0.72 0.008 250)',
                ['--hfg-h']: 'oklch(0.70 0.14 195)',
              } as React.CSSProperties}
              title="セッション設定を開く"
            >
              <Settings2 size={12} />
              <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                セッション情報: {metadataFilled ? '入力あり' : '未入力'}
              </span>
            </button>
          </div>
        </header>

        <Sheet open={studySetupOpen} onOpenChange={setStudySetupOpen}>
          <SheetContent
            side="right"
            className="w-[min(92vw,760px)] sm:max-w-[760px] overflow-hidden gap-0"
            style={{
              background: 'oklch(0.18 0.04 255)',
              borderColor: 'oklch(0.30 0.04 255)',
              color: 'oklch(0.88 0.005 250)',
            }}
          >
            <SheetHeader className="pb-3 pr-12">
              <div className="section-label">SESSION INFORMATION</div>
              <SheetTitle style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.35, color: 'oklch(0.88 0.005 250)' }}>
                セッション情報
              </SheetTitle>
              <SheetDescription style={{ fontFamily: 'Noto Sans JP, sans-serif', color: 'oklch(0.66 0.015 250)', lineHeight: 1.6 }}>
                被験者属性・実験条件・測定環境をセッション単位で管理します。A/B比較時は、上部の表示中セッション切替に連動して編集対象が変わります。
              </SheetDescription>
            </SheetHeader>

            <div className="px-4 pb-6 space-y-4 overflow-y-auto min-h-0 flex-1">
              <div
                className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl p-3"
                style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.30 0.04 255)' }}
              >
                <div>
                  <div className="section-label mb-1">SESSION</div>
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'oklch(0.70 0.14 195)' }}>
                    {selectedSessionLabel}
                  </div>
                </div>
                <div>
                  <div className="section-label mb-1">FILE</div>
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'oklch(0.80 0.008 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {safeSelected.meta.filename}
                  </div>
                </div>
                <div>
                  <div className="section-label mb-1">METADATA</div>
                  <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.78rem', color: metadataFilled ? 'oklch(0.78 0.16 160)' : 'oklch(0.74 0.14 70)' }}>
                    {metadataFilled ? '入力あり' : '未入力'}
                  </div>
                </div>
              </div>

              <SessionMetadataCard
                data={safeSelected}
                defaultOpen
                storageKey="ksdv.collapse.studySetup.sessionMeta"
                onChange={() => setMetadataRevision(v => v + 1)}
              />
            </div>
          </SheetContent>
        </Sheet>

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
