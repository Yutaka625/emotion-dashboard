/**
 * DESIGN: Neuro-Signal Interface
 * UXリサーチ向け分析セクション
 * 4パネル: UXスコア / 感情ヒートマップ / フリクション&デライト / タスク別サマリー
 */

import { useMemo, useState } from 'react';
import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import AbsoluteScaleBadge from '@/components/ui/AbsoluteScaleBadge';
import CardHeader from '@/components/ui/CardHeader';
import { useEvents } from '@/contexts/EventsContext';
import { AlertTriangle, Star, Zap, Brain, Trophy, Filter, ArrowUpDown, ArrowLeftRight, RotateCcw } from 'lucide-react';
import {
  countHeadMotionEventsByType,
  filterHeadMotionEvents,
  type HeadMotionFilter,
} from '@/lib/uxResearchFilters';

interface Props {
  data: DashboardData;
}

// 頭部動作検知イベント（アクションユニットタブから移設）。非言語サイン＝行動の解釈レイヤーのため UXリサーチに配置
// 時刻を MM:SS 形式に変換
const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
};

const MOTION_CONFIG = {
  nod:   { label: 'うなづき', axis: 'Pitch（上下）', color: 'oklch(0.75 0.14 195)', Icon: ArrowUpDown },
  shake: { label: '首振り',   axis: 'Yaw（左右）',   color: 'oklch(0.82 0.18 80)',  Icon: ArrowLeftRight },
  tilt:  { label: '首傾げ',   axis: 'Roll（傾き）',  color: 'oklch(0.78 0.14 300)', Icon: RotateCcw },
} as const;


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
  const { ux_scores, change_points, timeseries_full, head_motion_events } = data;
  const { events } = useEvents();
  const [frictionFilter, setFrictionFilter] = useState<'all' | 'friction' | 'delight'>('all');
  const [headMotionFilter, setHeadMotionFilter] = useState<HeadMotionFilter>('all');

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

  const headMotionCounts = useMemo(
    () => countHeadMotionEventsByType(head_motion_events),
    [head_motion_events],
  );
  const filteredHeadMotionEvents = useMemo(
    () => filterHeadMotionEvents(head_motion_events, headMotionFilter),
    [head_motion_events, headMotionFilter],
  );

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
        {/* ベースライン補正ON時: UXスコアは絶対値（補正対象外）であることを明示 */}
        <div className="mt-2"><AbsoluteScaleBadge /></div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Panel 1: UXスコアダッシュボード
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={cardStyle}>
        <CardHeader
          label="UX SCORE DASHBOARD"
          title="UX複合指標スコア"
          tier="pro"
          info="感情データから算出した4つのUX指標（フラストレーション・デライト・エンゲージメント品質・認知負荷）と、それらを合成した総合UXスコア（0〜100）を表示します。数値が高いほど良好な体験を示します。"
        />

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
                description: '困惑・怒り・悲しみ・嫌悪の合計。高いほど体験にストレスや不満がある',
                alert: ux_scores.frustration_index >= 0.3 ? '要注意' : null,
              },
              {
                label: 'Delight Index',
                labelJa: 'デライト',
                value: ux_scores.delight_index,
                icon: <Star size={16} />,
                color: 'oklch(0.78 0.14 82)',
                description: '喜び・驚き・感傷の合計。高いほどポジティブな反応や感動があった',
                alert: null,
              },
              {
                label: 'Engagement Quality',
                labelJa: 'エンゲージメント品質',
                value: ux_scores.engagement_quality,
                icon: <Zap size={16} />,
                color: 'oklch(0.70 0.14 195)',
                description: '混乱が少ない状態での集中度。高いほど良質な注意・没頭が起きている',
                alert: null,
              },
              {
                label: 'Cognitive Load',
                labelJa: '認知負荷',
                value: ux_scores.cognitive_load,
                icon: <Brain size={16} />,
                color: 'oklch(0.78 0.18 60)',
                description: '困惑と眉のしかめから推定。高いほど理解・操作が難しく頭に負荷がかかっている',
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
          Panel 3: フリクション & デライト分析
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={cardStyle}>
        <CardHeader
          label="FRICTION & DELIGHT ANALYSIS"
          title="フリクション＆デライト検出"
          tier="pro"
          info="ネガティブ感情が強まった瞬間（フリクション＝つまずき）と、ポジティブ感情が高まった瞬間（デライト＝喜び）を時系列から自動検出し一覧します。下のフィルタで種類を絞り込めます（各ボタンに検出件数を表示）。UX改善の着目点を見つけられます。"
        />

        {/* フィルタートグル（種別の検出件数を融合表示） */}
        <div className="flex gap-2 mb-4">
          {([
            { id: 'all',      label: 'すべて',       count: frictionDelightItems.length, color: 'oklch(0.70 0.03 255)', icon: Filter },
            { id: 'friction', label: 'フリクション', count: frictionCount,               color: 'oklch(0.62 0.22 25)', icon: AlertTriangle },
            { id: 'delight',  label: 'デライト',     count: delightCount,                color: 'oklch(0.78 0.14 82)', icon: Star },
          ] as const).map(({ id, label, count, color, icon: Icon }) => {
            const active = frictionFilter === id;
            return (
              <button
                key={id}
                onClick={() => setFrictionFilter(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  fontFamily: 'Noto Sans JP, sans-serif',
                  background: active ? color.replace(')', ' / 0.16)') : 'transparent',
                  border: `1px solid ${active ? color.replace(')', ' / 0.55)') : 'oklch(0.28 0.04 255)'}`,
                  color: active ? color : 'oklch(0.66 0.015 255)',
                }}
              >
                <Icon size={11} style={{ color }} />
                {label}
                <span style={{ fontFamily: 'Roboto Mono, monospace', color, opacity: active ? 1 : 0.85 }}>{count}</span>
              </button>
            );
          })}
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
          Panel 3.5: 頭部動作検知イベント（非言語サイン）
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={cardStyle}>
        <CardHeader
          label="HEAD MOTION EVENTS"
          title="頭部動作検知イベント"
          tier="pro"
          info="明確なうなづき（Pitch ≥8°）・首振り（Yaw ≥12°）・首傾げ（Roll ≥15°）を自動検知し、発生した時刻の一覧を示します。下のフィルタで動作種別を絞り込めます。同意・否定・思考などの非言語サインの手がかりになります。"
        />

        {/* フィルタートグル（動作種別の検出件数を融合表示） */}
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            { id: 'all' as const, label: 'すべて', count: headMotionCounts.all, color: 'oklch(0.70 0.03 255)', Icon: Filter },
            ...((Object.entries(MOTION_CONFIG) as [keyof typeof MOTION_CONFIG, typeof MOTION_CONFIG[keyof typeof MOTION_CONFIG]][]).map(([type, cfg]) => ({
              id: type,
              label: cfg.label,
              count: headMotionCounts[type],
              color: cfg.color,
              Icon: cfg.Icon,
            }))),
          ] as const).map(({ id, label, count, color, Icon }) => {
            const active = headMotionFilter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setHeadMotionFilter(id)}
                className="interactive-pill flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  fontFamily: 'Noto Sans JP, sans-serif',
                  background: active ? color.replace(')', ' / 0.16)') : 'transparent',
                  border: `1px solid ${active ? color.replace(')', ' / 0.55)') : 'oklch(0.28 0.04 255)'}`,
                  color: active ? color : 'oklch(0.66 0.015 255)',
                }}
              >
                <Icon size={11} style={{ color }} />
                {label}
                <span style={{ fontFamily: 'Roboto Mono, monospace', color, opacity: active ? 1 : 0.85 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {head_motion_events.length === 0 ? (
          <div className="py-8 text-center" style={{ color: 'oklch(0.60 0.015 255)', fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.82rem' }}>
            明確な頭部動作は検知されませんでした
            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.55 0.01 255)', marginTop: '4px' }}>
              （CSV に pitch / yaw / roll 列がない場合も表示されません）
            </div>
          </div>
        ) : filteredHeadMotionEvents.length === 0 ? (
          <div className="py-8 text-center" style={{ color: 'oklch(0.58 0.01 255)', fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem' }}>
            該当する頭部動作イベントがありません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '2px solid oklch(0.28 0.04 255)' }}>
                  {['動作', '開始時刻', '終了時刻', '持続時間', '変化量'].map(h => (
                    <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHeadMotionEvents.map((ev, i) => {
                  const cfg = MOTION_CONFIG[ev.type];
                  const duration = (ev.time_end - ev.time_start).toFixed(2);
                  return (
                    <tr
                      key={i}
                      className="row-hover"
                      style={{ borderBottom: '1px solid oklch(0.20 0.04 255)' }}
                    >
                      {/* 動作種別 */}
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1.5">
                          <cfg.Icon size={13} style={{ color: cfg.color, flexShrink: 0 }} />
                          <span className="status-pill px-2 py-0.5 rounded-full" style={{ background: cfg.color + '1a', color: cfg.color, fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {cfg.label}
                          </span>
                        </div>
                      </td>
                      {/* 開始時刻 */}
                      <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.88 0.005 250)' }}>
                        {formatTime(ev.time_start)}
                      </td>
                      {/* 終了時刻 */}
                      <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.72 0.008 250)' }}>
                        {formatTime(ev.time_end)}
                      </td>
                      {/* 持続時間 */}
                      <td className="py-2 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.65 0.015 255)' }}>
                        {duration}s
                      </td>
                      {/* 変化量 */}
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(60, (ev.magnitude / 40) * 60)}px`,
                              background: cfg.color,
                              opacity: 0.7,
                            }}
                          />
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', color: 'oklch(0.75 0.008 250)', fontWeight: 600 }}>
                            {ev.magnitude}°
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Panel 4: タスク別サマリー
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={cardStyle}>
        <CardHeader
          label="TASK SUMMARY"
          title="タスク別UX指標"
          tier="pro"
          info="「時系列分析」タブで登録したイベント（タスク区間）ごとに、UXスコアや主要指標を集計します。『どのタスクで最もフラストレーションが高かったか』などをタスク単位で比較できます。"
        />

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
