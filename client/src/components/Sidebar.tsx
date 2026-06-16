/*
 * DESIGN: Neuro-Signal Interface
 * Dark sidebar with signal green accents
 * Syne font for labels, Roboto Mono for data
 */

import { useState, type CSSProperties } from 'react';
import { BarChart2, Brain, GitBranch, Grid, Zap, ChevronRight, Activity, GitCompare, FlaskConical, Scan, Users, CircleHelp } from 'lucide-react';
import FaceScanIcon from '@/components/FaceScanIcon';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  highlight?: boolean;
}

const baseNavItems: NavItem[] = [
  { id: 'overview', label: '概要', icon: <Grid size={16} />, description: 'セッションサマリー' },
  { id: 'timeseries', label: '時系列分析', icon: <Activity size={16} />, description: '感情・指標の推移' },
  { id: 'engagement', label: '特殊指標', icon: <Zap size={16} />, description: '関与度・感情価の詳細分析' },
  { id: 'emotions', label: '感情分布', icon: <BarChart2 size={16} />, description: '10感情の統計' },
  { id: 'transitions', label: '感情遷移', icon: <GitBranch size={16} />, description: '状態遷移パターン' },
  { id: 'actionunits', label: 'アクションユニット', icon: <Scan size={16} />, description: '表情筋動作分析' },
  { id: 'academic', label: '学術的分析', icon: <Brain size={16} />, description: 'Affect Dynamics等' },
  { id: 'uxresearch', label: 'UXリサーチ', icon: <FlaskConical size={16} />, description: 'フリクション・デライト分析', highlight: true },
];

interface SidebarProps {
  activeSection: string;
  onSectionChange: (id: string) => void;
  hasComparison?: boolean;
  hasMultiFace?: boolean;
  meta?: { recording_date: string; recording_time: string };
}

export default function Sidebar({ activeSection, onSectionChange, hasComparison, hasMultiFace, meta }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const navItems: NavItem[] = [
    ...baseNavItems,
    ...(hasMultiFace ? [{ id: 'multiface', label: 'マルチFaceID', icon: <Users size={16} />, description: '顔ごとの比較', highlight: true }] : []),
    ...(hasComparison ? [{ id: 'comparison', label: '比較分析', icon: <GitCompare size={16} />, description: 'セッション間比較', highlight: true }] : []),
  ];

  return (
    <aside
      className="flex flex-col h-full transition-all duration-300"
      style={{
        width: collapsed ? '64px' : '220px',
        background: 'oklch(0.14 0.04 255)',
        borderRight: '1px solid oklch(0.22 0.04 255)',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5" style={{ borderBottom: '1px solid oklch(0.22 0.02 250)' }}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <FaceScanIcon size={28} />
            <div>
              <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: 'oklch(0.92 0.005 250)', letterSpacing: '-0.01em' }}>
                KSDV
              </div>
              <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.52rem', color: 'oklch(0.70 0.14 195)', letterSpacing: '0.06em', lineHeight: 1.4 }}>
                Kokoro Sensor Data Visualizer
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded hbg"
          style={{ color: 'oklch(0.68 0.015 255)', ['--hbg']: 'transparent', ['--hbg-h']: 'oklch(0.22 0.02 250)' } as CSSProperties}
        >
          <ChevronRight size={14} style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s' }} />
        </button>
      </div>

      {/* Signal indicator */}
      {!collapsed && (
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid oklch(0.22 0.02 250)' }}>
          <div
            className="w-2 h-2 rounded-full signal-pulse"
            style={{ background: 'oklch(0.70 0.14 195)', boxShadow: '0 0 6px oklch(0.70 0.14 195)' }}
          />
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.70 0.14 195)', letterSpacing: '0.08em' }}>
            SESSION DATA
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(item => {
          const isActive = activeSection === item.id;
          return (
            /* 折りたたみ時: アイコンのみ + ホバーでラベルツールチップ */
            <div key={item.id} className="relative group/nav">
              <button
                onClick={() => onSectionChange(item.id)}
                data-active={isActive}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
                className="nav-item w-full flex items-center gap-3 px-4 py-2.5 text-left"
                style={{
                  // 背景・文字色は CSS（.nav-item[data-active])が所有。
                  // 動的な左ボーダーのアクセント色（highlight=紫 / 通常=金）のみ inline で指定。
                  borderLeft: isActive ? `2px solid ${item.highlight ? 'oklch(0.78 0.22 300)' : 'oklch(0.78 0.14 82)'}` : '2px solid transparent',
                }}
              >
                {/* アイコン色: 選択時のみアクセント色（highlight=紫 / 通常=金）。
                    非選択時は highlight に関わらず全項目グレーで統一（テキストも同様にグレー） */}
                <span style={{ color: isActive ? (item.highlight ? 'oklch(0.78 0.22 300)' : 'oklch(0.78 0.14 82)') : 'oklch(0.66 0.015 255)', flexShrink: 0 }}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <div className="overflow-hidden">
                    <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 500, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </div>
                    <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.62 0.01 255)', whiteSpace: 'nowrap', marginTop: '1px' }}>
                      {item.description}
                    </div>
                  </div>
                )}
              </button>
              {/* 折りたたみ時のみ: ホバーでラベルを右側にポップアップ表示 */}
              {collapsed && (
                <div
                  className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 rounded-lg opacity-0 group-hover/nav:opacity-100 transition-opacity z-50 whitespace-nowrap"
                  style={{
                    background: 'oklch(0.28 0.04 255)',
                    border: '1px solid oklch(0.35 0.04 255)',
                    boxShadow: '0 4px 12px oklch(0.10 0.02 250 / 0.4)',
                  }}
                >
                  <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.78rem', color: 'oklch(0.90 0.005 250)' }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.58rem', color: 'oklch(0.64 0.01 255)', marginTop: '1px' }}>
                    {item.description}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid oklch(0.22 0.02 250)' }}>
        <a
          href="KSDV_User-Guide.html"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'} rounded-lg hbd hfg`}
          style={{
            minHeight: 34,
            padding: collapsed ? '0.5rem' : '0.5rem 0.65rem',
            background: 'oklch(0.20 0.04 255)',
            borderWidth: '1px',
            borderStyle: 'solid',
            textDecoration: 'none',
            marginBottom: collapsed ? 0 : '0.75rem',
            ['--hbd']: 'oklch(0.28 0.04 255)',
            ['--hbd-h']: 'oklch(0.70 0.14 195 / 0.5)',
            ['--hfg']: 'oklch(0.70 0.008 250)',
            ['--hfg-h']: 'oklch(0.70 0.14 195)',
          } as CSSProperties}
          title="使い方ガイドを開く"
        >
          <CircleHelp size={15} style={{ flexShrink: 0 }} />
          {!collapsed && (
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.76rem' }}>
              使い方
            </span>
          )}
        </a>

        {!collapsed && (
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.58 0.01 255)', lineHeight: 1.6 }}>
            {meta ? (
              <>
                <div>REC: {meta.recording_date}</div>
                <div>{meta.recording_time} JST</div>
              </>
            ) : (
              <div>—</div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
