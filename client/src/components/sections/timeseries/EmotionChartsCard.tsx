/**
 * EmotionChartsCard
 * 感情スコアの時系列グラフ + 特殊指標グラフ
 * タブ: オーバーレイ / 個別波形 / ヒートマップ / スタック面 / 支配感情
 */

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart, ComposedChart, BarChart, Bar,
  ReferenceArea, ReferenceLine,
} from 'recharts';
import { EMOTION_COLORS, EMOTION_LABELS_JA, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import type { TimeseriesPoint, ChangePoint, BaselineDisplayMode } from '@/lib/types';
import { useBaseline } from '@/contexts/BaselineContext';
import { useEvents } from '@/contexts/EventsContext';
import { rechartsTooltip } from '@/lib/chartTooltip';
import CardHeader from '@/components/ui/CardHeader';

const EMOTION_HEX = EMOTION_COLORS;

// 補正モード時のY軸ラベル（absolute は補正なしなので空）
const AXIS_LABEL: Record<BaselineDisplayMode, string> = {
  absolute:  '',
  deviation: 'Δ ベースライン比',
  lift:      '変化率 (%)',
  zscore:    'Zスコア (SD)',
};
// ツールチップ等の値に付ける単位サフィックス
const VALUE_SUFFIX: Record<BaselineDisplayMode, string> = {
  absolute: '', deviation: '', lift: '%', zscore: ' SD',
};

const SPECIAL_COLORS: Record<string, string> = {
  engagement: 'oklch(0.78 0.14 82)',
  valence:    'oklch(0.70 0.14 195)',
  attention:  'oklch(0.60 0.25 15)',
};

type TabId = 'overlay' | 'sparklines' | 'heatmap' | 'stacked' | 'dominant';

interface DominantEntry { time: string; emotion: string; color: string; label: string; }

interface Props {
  displayData: TimeseriesPoint[];
  heatmapData: Record<string, number>[];
  stackedData:  Record<string, number | string>[];
  dominantTimeline: DominantEntry[];
  heatmapMax: number;
  sampledLength: number;
  visibleChangePoints: ChangePoint[];
  maxTime: number;
  durationSeconds: number;
  /** 選択中の感情（オーバーレイタブ用） */
  selectedEmotions: string[];
  toggleEmotion: (e: string) => void;
  /** 特殊指標の表示切り替え */
  showSpecial: string[];
  toggleSpecial: (k: string) => void;
  /** アクティブタブ（親で保持して state reset を防ぐ） */
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
}

const TABS = [
  { id: 'overlay',    label: 'オーバーレイ' },
  { id: 'sparklines', label: '個別波形' },
  { id: 'heatmap',    label: 'ヒートマップ' },
  { id: 'stacked',    label: 'スタック面' },
  { id: 'dominant',   label: '支配感情' },
] as const;

const LIGHT_EMOTIONS = new Set(['disgust', 'fear', 'joy', 'sadness', 'surprise', 'confusion', 'sentimentality', 'attention']);

const formatTime = (t: number) => `${Number(t).toFixed(0)}s`;

export default function EmotionChartsCard({
  displayData, heatmapData, stackedData, dominantTimeline, heatmapMax,
  sampledLength, visibleChangePoints, maxTime, durationSeconds,
  selectedEmotions, toggleEmotion, showSpecial, toggleSpecial,
  activeTab, setActiveTab,
}: Props) {
  const { baselineRange, isBaselineActive, displayMode } = useBaseline();
  const { events } = useEvents();
  const [showChangePoints, setShowChangePoints] = useState(false);
  const [showOutliers, setShowOutliers] = useState(false);

  // 値フォーマッタ: NaN（変化率の算出不能）は「—」、それ以外は小数3桁＋補正中のみ単位を付与
  const fmtValue = (v: number) =>
    Number.isNaN(v) ? '—' : v.toFixed(3) + (isBaselineActive ? VALUE_SUFFIX[displayMode] : '');

  // 補正適用中（absolute 以外）に表示モード別のグラフ説明文を返す
  const correctedSubtitle =
    displayMode === 'deviation' ? '感情スコアのベースラインからの変化（0=平常時 / 正=増加 / 負=抑制）'
    : displayMode === 'lift'    ? '感情スコアのベースライン比の変化率（%・平常時=0／平常時の値が小さい感情は「—」）'
    : displayMode === 'zscore'  ? '感情スコアのZスコア（平常時=0 / 単位=標準偏差SD）'
    : '感情スコアの時系列グラフ';

  // 特殊指標（Engagement/Valence/Attention）用の補正モード別サブタイトル
  const correctedSubtitleSpecial =
    displayMode === 'deviation' ? 'ベースラインからの変化（0=平常時 / 正=増加 / 負=低下）'
    : displayMode === 'lift'    ? 'ベースライン比の変化率（%）。Valence は符号付きのため「—」'
    : displayMode === 'zscore'  ? 'Zスコア（平常時=0 / 単位=SD）。SDが極小の区間は「—」'
    : 'Engagement / Valence / Attention';

  // ---- ベースライン区間ハイライト ----
  const renderBaselineArea = () => {
    if (!baselineRange) return null;
    return (
      <ReferenceArea
        x1={baselineRange[0]} x2={baselineRange[1]}
        fill="oklch(0.70 0.14 195)" fillOpacity={0.08}
        stroke="oklch(0.70 0.14 195)" strokeOpacity={0.4} strokeDasharray="4 2"
        label={{ value: 'BL区間', position: 'insideTopLeft', fontSize: 9, fill: 'oklch(0.70 0.14 195)', fontFamily: 'Roboto Mono, monospace' }}
      />
    );
  };

  // ---- ベースライン ゼロライン（補正適用中のみ） ----
  const renderBaselineZeroLine = () => {
    if (!isBaselineActive) return null;
    return (
      <ReferenceLine y={0} stroke="oklch(0.70 0.14 195)" strokeWidth={1.5} strokeDasharray="6 3"
        label={{ value: 'BASELINE=0', position: 'insideTopLeft', fontSize: 9, fill: 'oklch(0.70 0.14 195)' }}
      />
    );
  };

  // ---- イベント塗りつぶし ----
  const renderEventAreas = () =>
    events.map(ev => (
      <ReferenceArea key={ev.id} x1={ev.startTime} x2={ev.endTime}
        fill={ev.color} fillOpacity={0.12} stroke={ev.color} strokeOpacity={0.5}
        strokeWidth={1} strokeDasharray="4 2"
        label={{ value: ev.name, position: 'insideTopLeft', fontSize: 10, fill: ev.color, fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600 }}
      />
    ));

  // ---- イベント境界線 ----
  const renderEventLines = () =>
    events.flatMap(ev => [
      <ReferenceLine key={`${ev.id}-s`} x={ev.startTime} stroke={ev.color} strokeWidth={1.5} strokeDasharray="4 2" />,
      <ReferenceLine key={`${ev.id}-e`} x={ev.endTime}   stroke={ev.color} strokeWidth={1.5} strokeDasharray="4 2" />,
    ]);

  // ---- 変化点ライン ----
  const renderChangePointLines = () =>
    showChangePoints
      ? visibleChangePoints.map((cp, i) => (
          <ReferenceLine key={`cp-${i}`} x={cp.time}
            stroke={cp.direction === 'rise' ? 'oklch(0.75 0.22 140)' : 'oklch(0.68 0.24 24)'}
            strokeWidth={1.5} strokeOpacity={0.7} strokeDasharray="3 3"
            label={{ value: cp.direction === 'rise' ? '↑' : '↓', position: 'insideTopRight', fontSize: 11,
              fill: cp.direction === 'rise' ? 'oklch(0.75 0.22 140)' : 'oklch(0.68 0.24 24)' }}
          />
        ))
      : [];

  // ---- カスタムツールチップ ----
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const t = Number(label);
    const activeEvents = events.filter(ev => t >= ev.startTime && t <= ev.endTime);
    return (
      <div className="p-3 rounded-lg shadow-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.30 0.04 255)', maxWidth: '240px' }}>
        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: '#4ade80', marginBottom: '6px' }}>
          t = {t.toFixed(2)}s
        </div>
        {activeEvents.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {activeEvents.map(ev => (
              <span key={ev.id} className="px-1.5 py-0.5 rounded text-xs"
                style={{ background: ev.color + '30', color: ev.color, fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', border: `1px solid ${ev.color}60` }}>
                {ev.name}
              </span>
            ))}
          </div>
        )}
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.75 0.005 80)' }}>
              {p.name}: <span style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 600 }}>{fmtValue(Number(p.value))}</span>
            </span>
          </div>
        ))}
        {/* 変化率モードで算出不能（—）の系列があるときの補足 */}
        {displayMode === 'lift' && payload.some((p: any) => Number.isNaN(Number(p.value))) && (
          <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.6rem', color: 'oklch(0.62 0.015 255)', marginTop: '4px' }}>
            ℹ「—」は平常時の値が小さく変化率を算出できません
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* ---- EMOTION TIME SERIES ---- */}
      <div className="metric-card">
        <CardHeader
          label="EMOTION TIME SERIES"
          title={isBaselineActive ? correctedSubtitle : '感情スコアの時系列グラフ'}
          info="感情スコアの時間変化を表示します。タブで表示形式（オーバーレイ／個別波形／ヒートマップ／スタック面／支配感情）を切り替えられます。ベースライン補正中は補正後の値（平常時からの変化）を表示します。"
        />

        {/* タブバー */}
        <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'oklch(0.20 0.04 255)', width: 'fit-content' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabId)}
              className="px-3 py-1.5 rounded-md text-xs transition-all"
              style={{
                fontFamily: 'Noto Sans JP, sans-serif',
                fontWeight: activeTab === tab.id ? 600 : 400,
                background: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? 'oklch(0.22 0.04 255)' : 'oklch(0.68 0.015 255)',
                boxShadow: activeTab === tab.id ? '0 1px 3px oklch(0.15 0.02 250 / 0.1)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: オーバーレイ */}
        {activeTab === 'overlay' && (
          <div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {NON_NEUTRAL_EMOTIONS.map(emotion => {
                const isActive = selectedEmotions.includes(emotion);
                const textColor = isActive ? (LIGHT_EMOTIONS.has(emotion) ? 'oklch(0.15 0.02 250)' : 'white') : 'oklch(0.68 0.015 250)';
                return (
                  <button key={emotion} onClick={() => toggleEmotion(emotion)}
                    className="px-2.5 py-0.5 rounded-full text-xs transition-all"
                    style={{ fontFamily: 'Noto Sans JP, sans-serif', background: isActive ? EMOTION_HEX[emotion] : 'oklch(0.20 0.04 255)', color: textColor, border: `1px solid ${isActive ? EMOTION_HEX[emotion] : 'oklch(0.28 0.04 255)'}`, fontSize: '0.72rem' }}
                  >
                    {EMOTION_LABELS_JA[emotion]}
                  </button>
                );
              })}
            </div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.68 0.015 255)', marginBottom: '0.75rem' }}>
              複数の感情スコアを同一グラフ上に重ねて表示します。感情ボタンをクリックして表示/非表示を切り替えられます。
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={displayData} margin={{ top: 5, right: 10, bottom: 5, left: isBaselineActive && AXIS_LABEL[displayMode] ? 12 : 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
                <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatTime} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
                <YAxis
                  tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }}
                  label={isBaselineActive && AXIS_LABEL[displayMode]
                    ? { value: AXIS_LABEL[displayMode], angle: -90, position: 'insideLeft', style: { fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.66rem', fill: 'oklch(0.68 0.015 255)', textAnchor: 'middle' } }
                    : undefined}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={v => <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem' }}>{v}</span>} />
                {renderBaselineArea()}
                {renderBaselineZeroLine()}
                {renderEventAreas()}
                {renderChangePointLines()}
                {selectedEmotions.map(emotion => (
                  <Line key={emotion} type="monotone" dataKey={emotion} stroke={EMOTION_HEX[emotion]} strokeWidth={1.5}
                    dot={showOutliers ? (props: any) => {
                      const { cx, cy, payload } = props;
                      if (!payload?.outlierFlags?.[emotion]) return <g key={`od-${payload.time}-${emotion}`} />;
                      return (
                        <circle key={`od-${payload.time}-${emotion}`} cx={cx} cy={cy} r={5}
                          fill="none" stroke={EMOTION_HEX[emotion]} strokeWidth={2} opacity={0.85} />
                      );
                    } : false}
                    activeDot={{ r: 3 }}
                    name={EMOTION_LABELS_JA[emotion]}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* 外れ値トグル */}
            <div className="mt-2 mb-1">
              <button
                onClick={() => setShowOutliers(p => !p)}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded transition-all"
                style={{ fontFamily: 'Roboto Mono, monospace', background: showOutliers ? 'oklch(0.28 0.08 60)' : 'oklch(0.22 0.04 255)', color: showOutliers ? 'oklch(0.80 0.18 70)' : 'oklch(0.68 0.015 255)', border: `1px solid ${showOutliers ? 'oklch(0.50 0.18 70)' : 'oklch(0.28 0.04 255)'}` }}
                title="IQR法で検出した外れ値フレームをグラフ上に空丸でマーク表示します（デフォルト: OFF）"
              >
                <span style={{ fontSize: '0.9rem' }}>◯</span>
                外れ値マーク ({showOutliers ? 'ON' : 'OFF'})
              </button>
              {showOutliers && (
                <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', color: 'oklch(0.55 0.015 255)', marginTop: '4px' }}>
                  IQR法（Q1 − 1.5×IQR ～ Q3 + 1.5×IQR）の外れ値フレームを空丸でマーク。詳細は「学術的分析」タブの外れ値サマリーを参照。
                </p>
              )}
            </div>

            {/* 変化点トグル */}
            <div className="mt-3">
              <button onClick={() => setShowChangePoints(p => !p)}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded transition-all"
                style={{ fontFamily: 'Roboto Mono, monospace', background: showChangePoints ? 'oklch(0.30 0.06 160)' : 'oklch(0.22 0.04 255)', color: showChangePoints ? 'oklch(0.75 0.22 140)' : 'oklch(0.68 0.015 255)', border: `1px solid ${showChangePoints ? 'oklch(0.45 0.18 140)' : 'oklch(0.28 0.04 255)'}` }}
              >
                <span>{showChangePoints ? '▲' : '▼'}</span>
                変化点検出 ({visibleChangePoints.length}件)
              </button>
              {showChangePoints && visibleChangePoints.length > 0 && (
                <div className="mt-2 rounded-lg overflow-hidden" style={{ border: '1px solid oklch(0.28 0.04 255)' }}>
                  <div className="px-3 py-2" style={{ background: 'oklch(0.20 0.04 255)', borderBottom: '1px solid oklch(0.26 0.04 255)' }}>
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.62 0.015 255)', letterSpacing: '0.06em' }}>
                      CHANGE POINTS — 感情スコアの急変タイミング（グローバルSD×2.5以上の変化）
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'oklch(0.22 0.04 255)' }}>
                    {visibleChangePoints.map((cp, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2" style={{ background: 'oklch(0.185 0.04 255)' }}>
                        <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', color: 'oklch(0.62 0.015 255)', minWidth: '52px' }}>{cp.time.toFixed(1)}s</span>
                        <span className="px-2 py-0.5 rounded text-xs" style={{ background: EMOTION_HEX[cp.emotion] + '20', color: EMOTION_HEX[cp.emotion], fontFamily: 'Noto Sans JP, sans-serif', minWidth: '48px', textAlign: 'center' }}>
                          {EMOTION_LABELS_JA[cp.emotion] || cp.emotion}
                        </span>
                        <span style={{ fontSize: '0.9rem' }}>{cp.direction === 'rise' ? '↑' : '↓'}</span>
                        <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', color: cp.direction === 'rise' ? 'oklch(0.75 0.22 140)' : 'oklch(0.68 0.24 24)' }}>
                          {cp.delta > 0 ? '+' : ''}{cp.delta.toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {showChangePoints && visibleChangePoints.length === 0 && (
                <div className="mt-2 text-center py-3" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.62 0.015 255)' }}>
                  この時間範囲内に有意な変化点は検出されませんでした
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: 個別波形（スパークライン） */}
        {activeTab === 'sparklines' && (
          <div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
              各感情スコアを独立したチャートで表示します。微細な変動パターンを個別に確認できます。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {NON_NEUTRAL_EMOTIONS.map(emotion => {
                // NaN（変化率で算出不能）を除外して統計を計算。全フレーム算出不能なら「—」
                const vals = displayData.map(d => (d as any)[emotion] as number).filter(v => !Number.isNaN(v));
                const hasVals = vals.length > 0;
                const maxVal  = hasVals ? Math.max(...vals) : 0;
                const meanVal = hasVals ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                const maxLabel = hasVals ? maxVal.toFixed(2) : '—';
                const avgLabel = hasVals ? meanVal.toFixed(3) : '—';
                return (
                  <div key={emotion} className="p-3 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: `1px solid ${EMOTION_HEX[emotion]}30` }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: EMOTION_HEX[emotion] }} />
                        <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.82rem', color: 'oklch(0.88 0.005 250)' }}>{EMOTION_LABELS_JA[emotion]}</span>
                      </div>
                      <div className="text-right">
                        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: EMOTION_HEX[emotion] }}>max {maxLabel}</div>
                        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)' }}>avg {avgLabel}</div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={80}>
                      <AreaChart data={displayData} margin={{ top: 2, right: 2, bottom: 2, left: 0 }}>
                        <defs>
                          <linearGradient id={`grad-${emotion}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={EMOTION_HEX[emotion]} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={EMOTION_HEX[emotion]} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} hide />
                        {/* 補正中は偏差/Zで負値が出るため自動レンジに切替 */}
                        <YAxis hide domain={isBaselineActive ? ['auto', 'auto'] : [0, Math.max(maxVal * 1.1, 0.01)]} />
                        <Tooltip {...rechartsTooltip} formatter={(v: number) => [fmtValue(Number(v)), EMOTION_LABELS_JA[emotion]]} labelFormatter={(l: number) => `t=${Number(l).toFixed(1)}s`}
                          contentStyle={{ ...rechartsTooltip.contentStyle, fontSize: '0.72rem', border: `1px solid ${EMOTION_HEX[emotion]}50`, padding: '4px 8px' }}
                        />
                        {renderEventLines()}
                        <Area type="monotone" dataKey={emotion} stroke={EMOTION_HEX[emotion]} fill={`url(#grad-${emotion})`} strokeWidth={1.5}
                          dot={showOutliers ? (props: any) => {
                            const { cx, cy, payload } = props;
                            if (!payload?.outlierFlags?.[emotion]) return <g key={`os-${payload.time}-${emotion}`} />;
                            return (
                              <circle key={`os-${payload.time}-${emotion}`} cx={cx} cy={cy} r={4}
                                fill="none" stroke={EMOTION_HEX[emotion]} strokeWidth={1.8} opacity={0.85} />
                            );
                          } : false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: ヒートマップ */}
        {activeTab === 'heatmap' && (
          <div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
              5秒区間ごとの感情スコア平均値をヒートマップで表示します。横軸が時間、縦軸が感情種別、色の濃さがスコアの強度を示します。
            </p>
            <div className="overflow-x-auto">
              <div style={{ minWidth: '600px' }}>
                {events.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-shrink-0 text-right" style={{ width: '60px' }}>
                      <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)' }}>EVENT</span>
                    </div>
                    <div className="flex-1 relative" style={{ height: '16px' }}>
                      {events.map(ev => {
                        const leftPct  = (ev.startTime / durationSeconds) * 100;
                        const widthPct = ((ev.endTime - ev.startTime) / durationSeconds) * 100;
                        return (
                          <div key={ev.id} className="absolute h-full rounded-sm flex items-center justify-center overflow-hidden"
                            style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: ev.color, opacity: 0.7 }} title={ev.name}
                          >
                            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.55rem', color: 'oklch(0.90 0.005 250)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 2px' }}>
                              {ev.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {NON_NEUTRAL_EMOTIONS.map(emotion => {
                  const emotionMax = emotion === 'confusion'
                    ? Math.max(0, ...heatmapData.map(d => d[emotion] as number).filter(v => !Number.isNaN(v)))
                    : heatmapMax;
                  return (
                    <div key={emotion} className="flex items-center gap-2 mb-1">
                      <div className="flex-shrink-0 text-right" style={{ width: '60px' }}>
                        <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', color: EMOTION_HEX[emotion], fontWeight: 600 }}>{EMOTION_LABELS_JA[emotion]}</span>
                      </div>
                      <div className="flex gap-0.5 flex-1">
                        {heatmapData.map((d, i) => {
                          const val = d[emotion] as number;
                          // 変化率で算出不能（NaN）のセルは「データなし」表示にする
                          const isNaNCell = Number.isNaN(val);
                          const intensity = !isNaNCell && emotionMax > 0 ? val / emotionMax : 0;
                          const isInEvent = events.some(ev => d.time >= ev.startTime && d.time <= ev.endTime);
                          return (
                            <div key={i} className="flex-1 rounded-sm"
                              style={isNaNCell
                                ? { height: '22px', background: 'transparent', border: '1px dashed oklch(0.34 0.02 255)', minWidth: '4px', outline: isInEvent ? '1px solid oklch(0.68 0.015 250)' : 'none' }
                                : { height: '22px', background: `${EMOTION_HEX[emotion]}`, opacity: Math.max(0.04, intensity), minWidth: '4px', outline: isInEvent ? '1px solid oklch(0.68 0.015 250)' : 'none' }}
                              title={`t=${d.time}s: ${isNaNCell ? '—（平常時の値が小さく算出不可）' : val.toFixed(3)}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 mt-2">
                  <div style={{ width: '60px' }} />
                  <div className="flex justify-between flex-1">
                    {[0, 50, 100, 150, 200, 250].map(t => (
                      <span key={t} style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)' }}>{t}s</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)' }}>低</span>
                  <div className="flex gap-0.5">
                    {[0.05, 0.15, 0.3, 0.5, 0.7, 0.85, 1.0].map((op, i) => (
                      <div key={i} className="w-6 h-3 rounded-sm" style={{ background: 'oklch(0.68 0.18 235)', opacity: op }} />
                    ))}
                  </div>
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)' }}>高</span>
                  <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', marginLeft: '8px' }}>※各感情内での相対スケール（5秒区間平均値）</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: スタック面グラフ */}
        {activeTab === 'stacked' && (
          <div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
              10秒区間ごとの感情スコア平均値を積み上げ面グラフで表示します。各感情の相対的な変化パターンを把握できます。
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stackedData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
                <XAxis dataKey="time" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
                <Tooltip {...rechartsTooltip}
                  formatter={(v: number, name: string) => [v.toFixed(3), EMOTION_LABELS_JA[name] || name]} />
                <Legend formatter={v => <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem' }}>{EMOTION_LABELS_JA[v] || v}</span>} />
                {NON_NEUTRAL_EMOTIONS.map(emotion => (
                  <Area key={emotion} type="monotone" dataKey={emotion} stackId="1" stroke={EMOTION_HEX[emotion]} fill={EMOTION_HEX[emotion]} fillOpacity={0.75} strokeWidth={0.5} dot={false} name={emotion} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* TAB: 支配的感情タイムライン */}
        {activeTab === 'dominant' && (
          <div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
              10秒区間ごとに最も高いスコアを示した「支配的感情」の推移を表示します。感情状態の遷移パターンを視覚的に把握できます。
            </p>
            <div className="mb-4">
              <div className="section-label mb-2">DOMINANT EMOTION TIMELINE</div>
              {events.length > 0 && (
                <div className="relative mb-1" style={{ height: '14px' }}>
                  {events.map(ev => {
                    const leftPct  = (ev.startTime / durationSeconds) * 100;
                    const widthPct = ((ev.endTime - ev.startTime) / durationSeconds) * 100;
                    return (
                      <div key={ev.id} className="absolute h-full rounded-sm flex items-center justify-center overflow-hidden"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: ev.color, opacity: 0.75 }}
                      >
                        <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.55rem', color: 'oklch(0.90 0.005 250)', fontWeight: 700, whiteSpace: 'nowrap', padding: '0 2px' }}>
                          {ev.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-0.5 rounded-lg overflow-hidden" style={{ height: '40px' }}>
                {dominantTimeline.map((d, i) => (
                  <div key={i} className="flex-1 flex items-center justify-center relative group" style={{ background: d.color, minWidth: '8px' }} title={`${d.time}: ${d.label}`}>
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                      style={{ background: 'oklch(0.22 0.04 255)', color: 'oklch(0.90 0.005 250)', fontFamily: 'Noto Sans JP, sans-serif', whiteSpace: 'nowrap' }}>
                      {d.time}: {d.label}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)' }}>0s</span>
                <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)' }}>{maxTime}s</span>
              </div>
            </div>
            <div className="section-label mb-2">10-SECOND WINDOW EMOTION SCORES</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stackedData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', fill: 'oklch(0.68 0.015 255)' }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
                <Tooltip {...rechartsTooltip}
                  formatter={(v: number, name: string) => [v.toFixed(3), EMOTION_LABELS_JA[name] || name]} />
                <Legend formatter={v => <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem' }}>{EMOTION_LABELS_JA[v] || v}</span>} />
                {NON_NEUTRAL_EMOTIONS.map(emotion => (
                  <Bar key={emotion} dataKey={emotion} stackId="a" fill={EMOTION_HEX[emotion]} fillOpacity={0.85} name={emotion} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-3">
              {NON_NEUTRAL_EMOTIONS.map(e => (
                <div key={e} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: EMOTION_HEX[e] }} />
                  <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.75 0.008 250)' }}>{EMOTION_LABELS_JA[e]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- SPECIAL METRICS ---- */}
      <div className="metric-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="section-label mb-1">SPECIAL METRICS</div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)' }}>
              {isBaselineActive ? correctedSubtitleSpecial : 'Engagement / Valence / Attention'}
            </div>
          </div>
          <div className="flex gap-2">
            {(['engagement', 'valence', 'attention'] as const).map(key => (
              <button key={key} onClick={() => toggleSpecial(key)}
                className="px-3 py-1 rounded-full text-xs transition-all"
                style={{
                  fontFamily: 'Roboto Mono, monospace',
                  background: showSpecial.includes(key) ? SPECIAL_COLORS[key] : 'oklch(0.20 0.04 255)',
                  color: showSpecial.includes(key) ? 'white' : 'oklch(0.68 0.015 250)',
                  border: `1px solid ${showSpecial.includes(key) ? SPECIAL_COLORS[key] : 'oklch(0.28 0.04 255)'}`,
                  opacity: showSpecial.includes(key) ? 1 : 0.6,
                }}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={displayData} margin={{ top: 5, right: 10, bottom: 5, left: isBaselineActive && AXIS_LABEL[displayMode] ? 12 : 0 }}>
            <defs>
              <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={SPECIAL_COLORS.engagement} stopOpacity={0.25} />
                <stop offset="95%" stopColor={SPECIAL_COLORS.engagement} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" />
            <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatTime} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }} />
            <YAxis
              tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fill: 'oklch(0.68 0.015 255)' }}
              domain={isBaselineActive ? ['auto', 'auto'] : [0, 100]}
              label={isBaselineActive && AXIS_LABEL[displayMode]
                ? { value: AXIS_LABEL[displayMode], angle: -90, position: 'insideLeft', style: { fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.66rem', fill: 'oklch(0.68 0.015 255)', textAnchor: 'middle' } }
                : undefined}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={v => <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem' }}>{v}</span>} />
            {renderBaselineArea()}
            {renderBaselineZeroLine()}
            {renderEventAreas()}
            {showSpecial.includes('engagement') && (
              <Area type="monotone" dataKey="engagement" stroke={SPECIAL_COLORS.engagement} fill="url(#engGrad)" strokeWidth={1.5} dot={false} name="Engagement" />
            )}
            {showSpecial.includes('valence') && (
              <Line type="monotone" dataKey="valence" stroke={SPECIAL_COLORS.valence} strokeWidth={1.5} dot={false} name="Valence" />
            )}
            {showSpecial.includes('attention') && (
              <Line type="monotone" dataKey="attention" stroke={SPECIAL_COLORS.attention} strokeWidth={1.5} dot={false} name="Attention" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        {/* 変化率(lift)モードで Valence は符号付きのため算出しない旨の常設注記 */}
        {displayMode === 'lift' && showSpecial.includes('valence') && (
          <div className="mt-2 px-3 py-2 rounded" style={{ background: 'oklch(0.20 0.04 255)', border: '1px solid oklch(0.30 0.04 255)', fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.72 0.012 250)', lineHeight: 1.6 }}>
            ℹ Valence は符号付き指標（−100〜+100）のため、変化率（lift）モードでは算出しません（グラフ・ツールチップ上は「—」）。偏差（deviation）または Zスコア モードでご確認ください。
          </div>
        )}
      </div>
    </>
  );
}
