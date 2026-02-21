/*
 * DESIGN: Neuro-Signal Interface
 * Main dashboard with drag & drop CSV upload flow
 * State: 'upload' → 'dashboard'
 */

import { useState, useCallback } from 'react';
import type { DashboardData } from '@/lib/types';
import DropZone from '@/components/DropZone';
import Sidebar from '@/components/Sidebar';
import OverviewSection from '@/components/sections/OverviewSection';
import TimeseriesSection from '@/components/sections/TimeseriesSection';
import EngagementSection from '@/components/sections/EngagementSection';
import ValenceSection from '@/components/sections/ValenceSection';
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

  const handleDataLoaded = useCallback((newData: DashboardData, newFilename: string) => {
    setData(newData);
    setFilename(newFilename);
    setActiveSection('overview');
  }, []);

  const handleReset = useCallback(() => {
    setData(null);
    setFilename('');
    setActiveSection('overview');
  }, []);

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
        } catch {
          setData(null);
          setFilename('');
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
  const renderSection = () => {
    switch (activeSection) {
      case 'overview': return <OverviewSection data={data} />;
      case 'timeseries': return <TimeseriesSection data={data} />;
      case 'engagement': return <EngagementSection data={data} />;
      case 'valence': return <ValenceSection data={data} />;
      case 'emotions': return <EmotionsSection data={data} />;
      case 'transitions': return <TransitionsSection data={data} />;
      case 'academic': return <AcademicSection data={data} />;
      case 'actionunits': return <ActionUnitsSection data={data} />;
      default: return <OverviewSection data={data} />;
    }
  };

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{ background: 'oklch(0.98 0.005 80)' }}
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
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1.25rem', color: 'oklch(0.25 0.02 250)' }}>
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
            background: 'oklch(1 0 0)',
            borderBottom: '1px solid oklch(0.88 0.008 80)',
            boxShadow: '0 1px 4px oklch(0.15 0.02 250 / 0.04)',
          }}
        >
          <div className="flex items-center gap-3">
            <FaceScanIcon size={20} color="oklch(0.35 0.02 250)" scanColor="oklch(0.52 0.18 160)" />
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'oklch(0.15 0.02 250)' }}>
              emoSense
            </span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.52 0.015 250)' }}>
              Facial Expression Analyzer
            </span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.52 0.015 250)' }}>
              / {activeSection.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.52 0.015 250)' }}>
              {data.meta.total_frames.toLocaleString()} frames · {data.meta.duration_minutes.toFixed(2)} min
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'oklch(0.62 0.18 160 / 0.1)', border: '1px solid oklch(0.62 0.18 160 / 0.25)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.62 0.18 160)' }} />
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.42 0.12 160)' }}>
                {data.meta.recording_date}
              </span>
            </div>

            {/* File info + reset button */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'oklch(0.96 0.005 80)', border: '1px solid oklch(0.88 0.008 80)' }}
            >
              <span
                style={{
                  fontFamily: 'Roboto Mono, monospace',
                  fontSize: '0.6rem',
                  color: 'oklch(0.45 0.015 250)',
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
                style={{ color: 'oklch(0.55 0.015 250)' }}
                title="別のファイルを読み込む"
              >
                <X size={12} />
              </button>
            </div>

            {/* Upload new file hint */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
              style={{ background: 'oklch(0.96 0.005 80)', border: '1px solid oklch(0.88 0.008 80)' }}
              onClick={handleReset}
              title="新しいCSVファイルをアップロード"
            >
              <Upload size={12} style={{ color: 'oklch(0.52 0.015 250)' }} />
              <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.45 0.015 250)' }}>
                別のファイル
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
