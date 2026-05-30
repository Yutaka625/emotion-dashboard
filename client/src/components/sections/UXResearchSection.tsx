/**
 * DESIGN: Neuro-Signal Interface
 * UXリサーチ向け分析セクション
 * 4パネル: UXスコア / 感情ヒートマップ / フリクション&デライト / タスク別サマリー
 */

import { useMemo, useState } from 'react';
import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import { useEvents } from '@/contexts/EventsContext';
import { AlertTriangle, Star, Zap, Brain, Trophy, Filter } from 'lucide-react';

interface Props {
  data: DashboardData;
}

// ---- 感情カラーから HUE 成分を抽出するヘルパー ----
// EMOTION_COLORS は "oklch(L C H)" 形式
function extractOklchHue(color: string): string {
  const m = color.match(/oklch\([\d.]+\s+[\d.]+\s+([\d.]+)/);
  return m ? m[1] : '255';
}

// ---- ゲージバー ----
function GaugeBar({ value, max = 1, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: '6px', background: 'oklch(0.28 0.04 255)' }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ---- 信号灯バッジ（LOW/MED/HIGH） ----
function SeverityBadge({ level }: { level: 'LOW' | 'MED' | 'HIGH' }) {
  const cfg = {
    LOW:  { label: 'LOW',  bg: 'oklch(0.62 0.18 160 / 0.15)', color: 'oklch(0.62 0.18 160)', border: 'oklch(0.62 0.18 160 / 0.4)' },
    MED:  { label: 'MED',  bg: 'oklch(0.78 0.18 60 / 0.15)',  color: 'oklch(0.78 0.18 60)',  border: 'oklch(0.78 0.18 60 / 0.4)' },
    HIGH: { label: 'HIGH', bg: 'oklch(0.62 0.22 25 / 0.15)',  color: 'oklch(0.62 0.22 25)',  border: 'oklch(0.62 0.22 25 / 0.4)' },
  }[level];
  return (
    <span
      className="px-1.5 py-0.5 rounded text-xs font-mono font-bold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

export default function UXResearchSection({ data }: Props) {
  const { ux_scores, change_points, timeseries_full, time_summary_10s } = data;
  const { events } = useEvents();
  const [frictionFilter, setFrictionFilter] = useState<'all' | 'friction' | 'delight'>('all');

  // ---- UXスコア段階評価 ----
  const uxRating = useMemo(() => {
    const s = ux_scores.ux_score;
    if (s >= 85) return { label: '優秀', color: 'oklch(0.70 0.14 195)' };
    if (s >= 70) return { label: '良好', color: 'oklch(0.62 0.18 160)' };
    if (s >= 50) return { label: '改善余地あり', color: 'oklch(0.78 0.18 60)' };
    return { label: '要改善', color: 'oklch(0.62 0.22 25)' };
  }, [ux_scores.ux_score]);

  // ---- フリクション & デライト分類 ----
  const frictionDelightItems = useMemo(() => {
    const FRICTION_RISE = new Set(['confusion', 'anger', 'sadness', 'disgust', 'fear']);
    const DELIGHT_RISE  = new Set(['joy', 'surprise', 'sentimentality']);
    const DELIGHT_FALL  = new Set(['confusion', 'anger', 'sadness']);
    const WEIGHT: Record<string, number> = {
      confusion: 2.0, anger: 1.8, joy: 1.5, surprise: 1.2,
    };

    return change_points.map(cp => {
      let kind: 'friction' | 'delight' | 'neutral';
      if (cp.direction === 'rise' && FRICTION_RISE.has(cp.emotion)) kind = 'friction';
      else if (cp.direction === 'rise' && DELIGHT_RISE.has(cp.emotion)) kind = 'delight';
      else if (cp.direction === 'fall' && DELIGHT_FALL.has(cp.emotion)) kind = 'delight';
      else kind = 'neutral';

      const weight = WEIGHT[cp.emotion] ?? 1.0;
      const severityScore = Math.abs(cp.delta) * weight;
      const severity: 'HIGH' | 'MED' | 'LOW' =
        severityScore >= 0.15 ? 'HIGH' : severityScore >= 0.08 ? 'MED' : 'LOW';

      return { ...cp, kind, severity, severityScore };
    });
  }, [change_points]);

  const filteredItems = useMemo(() => {
    if (frictionFilter === 'all') return frictionDelightItems;
    return frictionDelightItems.filter(i => i.kind === frictionFilter);
  }, [frictionDelightItems, frictionFilter]);

  const frictionCount = frictionDelightItems.filter(i => i.kind === 'friction').length;
  const delightCount  = frictionDelightItems.filter(i => i.kind === 'delight').length;

  // ---- 感情ヒートマップデータ（time_summary_10s を使用、最大40ビン） ----
  const heatmapBins = useMemo(() => {
    if (time_summary_10s.length <= 40) return time_summary_10s;
    // 40超ならtimeseries_fullから20ビンに再集計
    const n = timeseries_full.length;
    const binCount = 20;
    const binSize = Math.ceil(n / binCount);
    return Array.from({ length: binCount }, (_, bi) => {
      const slice = timeseries_full.slice(bi * binSize, (bi + 1) * binSize);
      if (slice.length === 0) return null;
      const entry: Record<string, number> = {
        time_start: slice[0].time - timeseries_full[0].time,
        time_end: slice[slice.length - 1].time - timeseries_full[0].time,
      };
      for (const e of NON_NEUTRAL_EMOTIONS) {
        const vals = slice.map(f => (f as any)[e] as number ?? 0);
        entry[`${e}_mean`] = vals.reduce((a, b) => a + b, 0) / vals.length;
      }
      return entry;
    }).filter(Boolean) as typeof time_summary_10s;
  }, [time_summary_10s, timeseries_full]);

  // 各感情の全ビン最大値（正規化用）
  const heatmapMaxPerEmotion = useMemo(() => {
    const maxMap: Record<string, number> = {};
    for (const e of NON_NEUTRAL_EMOTIONS) {
      maxMap[e] = Math.max(0.001, ...heatmapBins.map(b => ((b as any)[`${e}_mean`] ?? 0) as number));
    }
    return maxMap;
  }, [heatmapBins]);

  // ---- タスク別サマリー計算 ----
  const taskSummaries = useMemo(() => {
    const startTime = timeseries_full[0]?.time ?? 0;
    return events.map(ev => {
      const frames = timeseries_full.filter(
        f => (f.time - startTime) >= ev.startTime && (f.time - startTime) <= ev.endTime
      );
      if (frames.length === 0) return { ev, frameCount: 0, frustration: 0, delight: 0, engQuality: 0, dominantEmotion: '-' };

      const avg = (col: string) => frames.reduce((a, f) => a + ((f as any)[col] as number ?? 0), 0) / frames.length;

      const conf = avg('confusion');
      const ang  = avg('anger');
      const sad  = avg('sadness');
      const dis  = avg('disgust');
      const joy  = avg('joy');
      const sur  = avg('surprise');
      const sent = avg('sentimentality');
      const eng  = avg('engagement');

      const frustration  = conf * 0.4 + ang * 0.3 + sad * 0.2 + dis * 0.1;
      const delight      = joy * 0.5 + sur * 0.3 + sent * 0.2;
      const engQuality   = eng * Math.max(0, 1 - conf * 2);

      // 支配的感情
      let domEmo = 'confusion', domVal = -Infinity;
      for (const e of NON_NEUTRAL_EMOTIONS) {
        const v = avg(e);
        if (v > domVal) { domVal = v; domEmo = e; }
      }

      return { ev, frameCount: frames.length, frustration, delight, engQuality, dominantEmotion: domEmo };
    });
  }, [events, timeseries_full]);

  // ---- Styles ----
  const cardStyle = {
    background: 'oklch(0.22 0.04 255)',
    border: '1px solid oklch(0.28 0.04 255)',
    borderRadius: '10px',
    padding: '1.25rem',
  };

  const sectionLabel = {
    fontFamily: 'Roboto Mono, monospace',
    fontSize: '0.62rem',
    fontWeight: 500,
    letterSpacing: '0.12em',
    color: 'oklch(0.68 0.015 255)',
    textTransform: 'uppercase' as const,
  };

  const cardTitle = {
    fontFamily: 'Noto Sans JP, sans-serif',
    fontWeight: 700,
    fontSize: '1rem',
    color: 'oklch(0.88 0.005 250)',
    marginBottom: '1rem',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div style={sectionLabel}>UX RESEARCH</div>
        <h1 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.75rem', color: 'oklch(0.88 0.005 250)', lineHeight: 1.1 }}>
          UXリサーチ分析
        </h1>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.68 0.015 255)', marginTop: '0.5rem' }}>
          フラストレーション・デライト・認知負荷など、UX改善に直結する感情指標を可視化します
        </p>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Panel 1: UXスコアダッシュボード
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={cardStyle}>
        <div style={sectionLabel} className="mb-3">UX SCORE DASHBOARD</div>
        <div style={cardTitle}>UX複合指標スコア</div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* UX Score 総合（大） */}
          <div
            className="md:col-span-1 flex flex-col items-center justify-center p-4 rounded-xl"
            style={{ background: 'oklch(0.18 0.04 255)', border: `2px solid ${uxRating.color}40` }}
          >
            <div style={{ ...sectionLabel, marginBottom: '0.5rem' }}>TOTAL UX SCORE</div>
            <div style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 900, fontSize: '3rem', color: uxRating.color, lineHeight: 1 }}>
              {Math.round(ux_scores.ux_score)}
            </div>
            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', marginTop: '4px' }}>/ 100</div>
            <div
              className="mt-3 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: `${uxRating.color}20`, color: uxRating.color, border: `1px solid ${uxRating.color}50`, fontFamily: 'Noto Sans JP, sans-serif' }}
            >
              {uxRating.label}
            </div>
          </div>

          {/* 4指標 */}
          <div className="md:col-span-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: 'Frustration Index',
                labelJa: 'フラストレーション',
                value: ux_scores.frustration_index,
                icon: <AlertTriangle size={16} />,
                color: 'oklch(0.62 0.22 25)',
                description: 'confusion×0.4 + anger×0.3 + sadness×0.2',
                alert: ux_scores.frustration_index >= 0.3 ? '要注意' : null,
              },
              {
                label: 'Delight Index',
                labelJa: 'デライト',
                value: ux_scores.delight_index,
                icon: <Star size={16} />,
                color: 'oklch(0.78 0.14 82)',
                description: 'joy×0.5 + surprise×0.3 + sentimentality×0.2',
                alert: null,
              },
              {
                label: 'Engagement Quality',
                labelJa: 'エンゲージメント品質',
                value: ux_scores.engagement_quality,
                icon: <Zap size={16} />,
                color: 'oklch(0.70 0.14 195)',
                description: 'engagement × (1 − confusion×2)',
                alert: null,
              },
              {
                label: 'Cognitive Load',
                labelJa: '認知負荷',
                value: ux_scores.cognitive_load,
                icon: <Brain size={16} />,
                color: 'oklch(0.78 0.18 60)',
                description: 'confusion×0.6 + brow_furrow×0.4',
                alert: ux_scores.cognitive_load >= 0.35 ? '高負荷' : null,
              },
            ].map(m => (
              <div key={m.label} className="p-3 rounded-lg" style={{ background: 'oklch(0.18 0.04 255)', border: '1px solid oklch(0.25 0.04 255)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ ...sectionLabel, fontSize: '0.56rem' }}>{m.label}</span>
                  <span style={{ color: m.color }}>{m.icon}</span>
                </div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 700, fontSize: '1.6rem', color: m.color, lineHeight: 1 }}>
                  {m.value.toFixed(3)}
                </div>
                <div className="mt-2">
                  <GaugeBar value={m.value} color={m.color} />
                </div>
                <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', color: 'oklch(0.62 0.01 255)', marginTop: '6px', lineHeight: 1.4 }}>
                  {m.description}
                </div>
                {m.alert && (
                  <div className="mt-1 text-xs font-bold" style={{ color: m.color, fontFamily: 'Noto Sans JP, sans-serif' }}>
                    ⚠ {m.alert}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Panel 2: 感情ヒートマップ
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={cardStyle}>
        <div style={sectionLabel} className="mb-3">EMOTION HEATMAP</div>
        <div style={cardTitle}>感情強度ヒートマップ（時間 × 感情）</div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.66 0.015 255)', marginBottom: '1rem' }}>
          色が明るいほど感情強度が高い。横軸=時間、縦軸=感情種別。
        </p>

        {/* グリッド本体 */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${Math.max(400, heatmapBins.length * 18)}px` }}>
            {NON_NEUTRAL_EMOTIONS.map(emotion => {
              const hue = extractOklchHue(EMOTION_COLORS[emotion] ?? 'oklch(0.62 0.18 255)');
              const maxVal = heatmapMaxPerEmotion[emotion];
              return (
                <div key={emotion} className="flex items-center gap-1 mb-0.5">
                  {/* 感情ラベル */}
                  <div
                    style={{
                      fontFamily: 'Noto Sans JP, sans-serif',
                      fontSize: '0.65rem',
                      color: EMOTION_COLORS[emotion],
                      width: '56px',
                      flexShrink: 0,
                      textAlign: 'right',
                    }}
                  >
                    {EMOTION_LABELS_JA[emotion]}
                  </div>
                  {/* セル列 */}
                  <div className="flex gap-px flex-1">
                    {heatmapBins.map((bin, bi) => {
                      const val = ((bin as any)[`${emotion}_mean`] ?? 0) as number;
                      const intensity = val / maxVal; // 0〜1
                      const opacity = 0.08 + intensity * 0.88; // 最小 0.08 で常に見える
                      return (
                        <div
                          key={bi}
                          className="flex-1 rounded-sm group relative"
                          style={{
                            height: '22px',
                            background: `oklch(0.62 0.18 ${hue} / ${opacity.toFixed(2)})`,
                            cursor: 'default',
                          }}
                          title={`${EMOTION_LABELS_JA[emotion]} @ ${Math.round((bin as any).time_start ?? 0)}s — 強度: ${(val * 100).toFixed(1)}%`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {/* X軸ラベル */}
            <div className="flex items-center gap-1 mt-1">
              <div style={{ width: '56px', flexShrink: 0 }} />
              <div className="flex gap-px flex-1">
                {heatmapBins.filter((_, i) => i % Math.max(1, Math.floor(heatmapBins.length / 8)) === 0).map((bin, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: 'Roboto Mono, monospace',
                      fontSize: '0.55rem',
                      color: 'oklch(0.58 0.01 255)',
                      flex: Math.max(1, Math.floor(heatmapBins.length / 8)),
                    }}
                  >
                    {Math.round((bin as any).time_start ?? 0)}s
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 凡例 */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {NON_NEUTRAL_EMOTIONS.map(e => (
            <div key={e} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: EMOTION_COLORS[e] }} />
              <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.65rem', color: 'oklch(0.60 0.01 255)' }}>
                {EMOTION_LABELS_JA[e]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Panel 3: フリクション & デライト分析
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={cardStyle}>
        <div style={sectionLabel} className="mb-3">FRICTION & DELIGHT ANALYSIS</div>
        <div className="flex items-center justify-between mb-4">
          <div style={cardTitle}>フリクション＆デライト検出</div>
          {/* サマリーカウント */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'oklch(0.62 0.22 25 / 0.12)', border: '1px solid oklch(0.62 0.22 25 / 0.3)' }}>
              <AlertTriangle size={12} style={{ color: 'oklch(0.62 0.22 25)' }} />
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', color: 'oklch(0.62 0.22 25)' }}>
                Friction: {frictionCount}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'oklch(0.78 0.14 82 / 0.12)', border: '1px solid oklch(0.78 0.14 82 / 0.3)' }}>
              <Star size={12} style={{ color: 'oklch(0.78 0.14 82)' }} />
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', color: 'oklch(0.78 0.14 82)' }}>
                Delight: {delightCount}
              </span>
            </div>
          </div>
        </div>

        {/* フィルタートグル */}
        <div className="flex gap-2 mb-4">
          {(['all', 'friction', 'delight'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFrictionFilter(f)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{
                fontFamily: 'Noto Sans JP, sans-serif',
                background: frictionFilter === f ? 'oklch(0.28 0.04 255)' : 'transparent',
                border: `1px solid ${frictionFilter === f ? 'oklch(0.40 0.06 255)' : 'oklch(0.28 0.04 255)'}`,
                color: frictionFilter === f ? 'oklch(0.88 0.005 250)' : 'oklch(0.66 0.015 255)',
              }}
            >
              <Filter size={11} />
              {f === 'all' ? 'すべて' : f === 'friction' ? 'フリクションのみ' : 'デライトのみ'}
            </button>
          ))}
        </div>

        {/* タイムライン */}
        {change_points.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'oklch(0.58 0.01 255)', fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem' }}>
            変化点が検出されていません。感情の変動が少ないセッションです。
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'oklch(0.58 0.01 255)', fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem' }}>
            該当するイベントがありません。
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item, idx) => {
              const isFriction = item.kind === 'friction';
              const isDelight  = item.kind === 'delight';
              const kindColor = isFriction ? 'oklch(0.62 0.22 25)'
                : isDelight ? 'oklch(0.78 0.14 82)'
                : 'oklch(0.66 0.015 255)';
              const kindLabel = isFriction ? 'フリクション' : isDelight ? 'デライト' : '中立変化';

              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{ background: 'oklch(0.18 0.04 255)', border: `1px solid ${kindColor}25` }}
                >
                  {/* 時刻 */}
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', color: 'oklch(0.66 0.015 255)', width: '38px', flexShrink: 0 }}>
                    {item.time.toFixed(0)}s
                  </div>
                  {/* 種別バッジ */}
                  <div
                    className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{ background: `${kindColor}18`, color: kindColor, border: `1px solid ${kindColor}40`, fontFamily: 'Noto Sans JP, sans-serif', whiteSpace: 'nowrap' }}
                  >
                    {isFriction ? <AlertTriangle size={10} className="inline mr-1" /> : isDelight ? <Star size={10} className="inline mr-1" /> : null}
                    {kindLabel}
                  </div>
                  {/* 感情 */}
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: EMOTION_COLORS[item.emotion] ?? '#999' }} />
                    <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.80 0.005 250)' }}>
                      {EMOTION_LABELS_JA[item.emotion] ?? item.emotion}
                    </span>
                  </div>
                  {/* 方向 */}
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: item.direction === 'rise' ? 'oklch(0.62 0.22 25)' : 'oklch(0.62 0.18 160)' }}>
                    {item.direction === 'rise' ? '↑ 上昇' : '↓ 下降'}
                  </div>
                  {/* Severity */}
                  <SeverityBadge level={item.severity} />
                  {/* Delta */}
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.62 0.01 255)', marginLeft: 'auto' }}>
                    Δ{item.delta > 0 ? '+' : ''}{item.delta.toFixed(4)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Panel 4: タスク別サマリー
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={cardStyle}>
        <div style={sectionLabel} className="mb-3">TASK SUMMARY</div>
        <div style={cardTitle}>タスク別UX指標</div>

        {events.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 rounded-xl"
            style={{ background: 'oklch(0.18 0.04 255)', border: '1px dashed oklch(0.32 0.04 255)' }}
          >
            <Trophy size={36} style={{ color: 'oklch(0.38 0.04 255)', marginBottom: '1rem' }} />
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.95rem', color: 'oklch(0.60 0.015 255)', marginBottom: '0.5rem' }}>
              タスクがまだ登録されていません
            </div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', color: 'oklch(0.58 0.01 255)', textAlign: 'center', lineHeight: 1.6 }}>
              「時系列分析」セクションの EVENT ANNOTATIONS パネルで<br />
              タスク区間（開始〜終了時間）を登録すると、<br />
              ここにタスク別のUX指標が表示されます。
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {taskSummaries.map(ts => (
              <div
                key={ts.ev.id}
                className="p-4 rounded-xl"
                style={{ background: 'oklch(0.18 0.04 255)', border: `1px solid ${ts.ev.color}30` }}
              >
                {/* タスクヘッダー */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: ts.ev.color }} />
                    <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'oklch(0.88 0.005 250)' }}>
                      {ts.ev.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.66 0.015 255)' }}>
                      {ts.ev.startTime}s → {ts.ev.endTime}s
                    </span>
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.58 0.01 255)' }}>
                      ({ts.frameCount}frames)
                    </span>
                  </div>
                </div>

                {ts.frameCount === 0 ? (
                  <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', color: 'oklch(0.58 0.01 255)' }}>
                    この区間にデータがありません
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Frustration', value: ts.frustration, color: 'oklch(0.62 0.22 25)', icon: <AlertTriangle size={12} /> },
                      { label: 'Delight',      value: ts.delight,     color: 'oklch(0.78 0.14 82)',  icon: <Star size={12} /> },
                      { label: 'Eng. Quality', value: ts.engQuality,  color: 'oklch(0.70 0.14 195)', icon: <Zap size={12} /> },
                    ].map(m => (
                      <div key={m.label}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1" style={{ color: m.color }}>
                            {m.icon}
                            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.66 0.015 255)' }}>
                              {m.label}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: m.color, fontWeight: 700 }}>
                            {m.value.toFixed(3)}
                          </span>
                        </div>
                        <GaugeBar value={m.value} color={m.color} />
                      </div>
                    ))}
                  </div>
                )}

                {/* 支配的感情 */}
                {ts.frameCount > 0 && ts.dominantEmotion !== '-' && (
                  <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid oklch(0.25 0.04 255)' }}>
                    <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.62 0.01 255)' }}>支配的感情:</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: EMOTION_COLORS[ts.dominantEmotion] ?? '#999' }} />
                      <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: EMOTION_COLORS[ts.dominantEmotion] ?? '#999', fontWeight: 600 }}>
                        {EMOTION_LABELS_JA[ts.dominantEmotion] ?? ts.dominantEmotion}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
