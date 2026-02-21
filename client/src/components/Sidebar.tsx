/*
 * DESIGN: Neuro-Signal Interface
 * Dark sidebar with signal green accents
 * Syne font for labels, Roboto Mono for data
 */

import { useState } from 'react';
import { BarChart2, Brain, Clock, GitBranch, Grid, TrendingUp, Zap, ChevronRight, Activity } from 'lucide-react';
import FaceScanIcon from '@/components/FaceScanIcon';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const navItems: NavItem[] = [
  { id: 'overview', label: '概要', icon: <Grid size={16} />, description: 'セッションサマリー' },
  { id: 'timeseries', label: '時系列分析', icon: <Activity size={16} />, description: '感情・指標の推移' },
  { id: 'engagement', label: 'Engagement', icon: <Zap size={16} />, description: '関与度の詳細分析' },
  { id: 'valence', label: 'Valence', icon: <TrendingUp size={16} />, description: '感情価の分析' },
  { id: 'emotions', label: '感情分布', icon: <BarChart2 size={16} />, description: '10感情の統計' },
  { id: 'transitions', label: '感情遷移', icon: <GitBranch size={16} />, description: '状態遷移パターン' },
  { id: 'academic', label: '学術的分析', icon: <Brain size={16} />, description: 'Affect Dynamics等' },
  { id: 'actionunits', label: 'アクションユニット', icon: <Clock size={16} />, description: '表情筋動作分析' },
];

interface SidebarProps {
  activeSection: string;
  onSectionChange: (id: string) => void;
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="flex flex-col h-full transition-all duration-300"
      style={{
        width: collapsed ? '64px' : '220px',
        background: 'oklch(0.15 0.02 250)',
        borderRight: '1px solid oklch(0.25 0.02 250)',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5" style={{ borderBottom: '1px solid oklch(0.22 0.02 250)' }}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <FaceScanIcon size={28} />
            <div>
              <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: 'oklch(0.88 0.005 80)', letterSpacing: '-0.01em' }}>
                emoSense
              </div>
              <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.52rem', color: 'oklch(0.62 0.18 160)', letterSpacing: '0.06em', lineHeight: 1.4 }}>
                Facial Expression Analyzer
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded transition-colors"
          style={{ color: 'oklch(0.55 0.015 250)', background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'oklch(0.22 0.02 250)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <ChevronRight size={14} style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s' }} />
        </button>
      </div>

      {/* Signal indicator */}
      {!collapsed && (
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid oklch(0.22 0.02 250)' }}>
          <div
            className="w-2 h-2 rounded-full signal-pulse"
            style={{ background: 'oklch(0.62 0.18 160)', boxShadow: '0 0 6px oklch(0.62 0.18 160)' }}
          />
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.62 0.18 160)', letterSpacing: '0.08em' }}>
            LIVE DATA
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(item => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150"
              style={{
                background: isActive ? 'oklch(0.22 0.025 250)' : 'transparent',
                borderLeft: isActive ? '2px solid oklch(0.62 0.18 160)' : '2px solid transparent',
                color: isActive ? 'oklch(0.88 0.005 80)' : 'oklch(0.55 0.015 250)',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'oklch(0.19 0.02 250)';
                  e.currentTarget.style.color = 'oklch(0.75 0.005 80)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'oklch(0.55 0.015 250)';
                }
              }}
            >
              <span style={{ color: isActive ? 'oklch(0.62 0.18 160)' : 'inherit', flexShrink: 0 }}>
                {item.icon}
              </span>
              {!collapsed && (
                <div className="overflow-hidden">
                  <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 500, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.42 0.01 250)', whiteSpace: 'nowrap', marginTop: '1px' }}>
                    {item.description}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3" style={{ borderTop: '1px solid oklch(0.22 0.02 250)' }}>
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.38 0.01 250)', lineHeight: 1.6 }}>
            <div>REC: 2025-12-17</div>
            <div>16:14:31 JST</div>
          </div>
        </div>
      )}
    </aside>
  );
}
