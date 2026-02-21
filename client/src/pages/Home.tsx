/*
 * DESIGN: Neuro-Signal Interface
 * Main dashboard layout with sidebar navigation
 */

import { useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import Sidebar from '@/components/Sidebar';
import OverviewSection from '@/components/sections/OverviewSection';
import TimeseriesSection from '@/components/sections/TimeseriesSection';
import EngagementSection from '@/components/sections/EngagementSection';
import ValenceSection from '@/components/sections/ValenceSection';
import EmotionsSection from '@/components/sections/EmotionsSection';
import TransitionsSection from '@/components/sections/TransitionsSection';
import AcademicSection from '@/components/sections/AcademicSection';
import ActionUnitsSection from '@/components/sections/ActionUnitsSection';
import { Activity } from 'lucide-react';

export default function Home() {
  const { data, loading, error } = useDashboardData();
  const [activeSection, setActiveSection] = useState('overview');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'oklch(0.98 0.005 80)' }}>
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-3 h-3 rounded-full signal-pulse" style={{ background: 'oklch(0.62 0.18 160)', boxShadow: '0 0 8px oklch(0.62 0.18 160)' }} />
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1.2rem', color: 'oklch(0.15 0.02 250)' }}>
              データを読み込み中...
            </span>
          </div>
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.52 0.015 250)' }}>
            LOADING NEURAL DATA
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'oklch(0.98 0.005 80)' }}>
        <div className="text-center space-y-3">
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1.2rem', color: 'oklch(0.62 0.18 25)' }}>
            データの読み込みに失敗しました
          </div>
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.52 0.015 250)' }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

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
    <div className="flex h-screen overflow-hidden" style={{ background: 'oklch(0.98 0.005 80)' }}>
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
            <Activity size={18} style={{ color: 'oklch(0.62 0.18 160)' }} />
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.9rem', color: 'oklch(0.15 0.02 250)' }}>
              感情分析ダッシュボード
            </span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.52 0.015 250)' }}>
              / {activeSection.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.52 0.015 250)' }}>
              {data.meta.total_frames.toLocaleString()} frames · {data.meta.duration_minutes.toFixed(2)} min
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'oklch(0.62 0.18 160 / 0.1)', border: '1px solid oklch(0.62 0.18 160 / 0.25)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.62 0.18 160)' }} />
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.42 0.12 160)' }}>
                {data.meta.recording_date}
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
