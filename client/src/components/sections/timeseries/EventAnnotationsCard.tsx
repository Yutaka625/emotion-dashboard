/**
 * EventAnnotationsCard
 * イベント（介入）登録・一覧・統計・区間比較UI
 */

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import { EMOTION_COLORS, EMOTION_LABELS_JA, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import type { TimeseriesPoint } from '@/lib/types';
import { useEvents } from '@/contexts/EventsContext';
import type { EventAnnotation } from '@/contexts/EventsContext';
import { EVENT_PALETTE } from '@/contexts/EventsContext';
import { compareSegments, TESTABLE_EMOTIONS } from '@/lib/statisticsUtils';
import type { TTestResult } from '@/lib/statisticsUtils';
import CollapsibleCard from '@/components/ui/CollapsibleCard';
import SettingBox from '@/components/ui/SettingBox';
import SettingSubLabel from '@/components/ui/SettingSubLabel';

const SPECIAL_COLORS: Record<string, string> = {
  engagement: 'oklch(0.78 0.14 82)',
  valence:    'oklch(0.70 0.14 195)',
  attention:  'oklch(0.60 0.25 15)',
};

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

interface EventStats {
  id: string;
  frameCount: number;
  stats: Record<string, { mean: number; max: number }>;
  dominantEmotion: string;
}

interface Props {
  eventStats: EventStats[];
  maxTime: number;
  displayTimeseriesFull: TimeseriesPoint[];
  /** イベントクリックで時間範囲をズームする */
  onZoomEvent: (start: number, end: number) => void;
}

export default function EventAnnotationsCard({ eventStats, maxTime, displayTimeseriesFull, onZoomEvent }: Props) {
  const { events, setEvents } = useEvents();

  const [newEventName, setNewEventName]   = useState('');
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd]     = useState('');
  const [eventFormError, setEventFormError] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);

  // 区間比較・統計検定 state
  const [compSegA, setCompSegA] = useState('');
  const [compSegB, setCompSegB] = useState('');
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<Record<string, TTestResult> | null>(null);

  const handleAddEvent = () => {
    setEventFormError('');
    const name  = newEventName.trim();
    const start = parseFloat(newEventStart);
    const end   = parseFloat(newEventEnd);
    if (!name)                      { setEventFormError('イベント名を入力してください'); return; }
    if (isNaN(start) || isNaN(end)) { setEventFormError('開始・終了時間を数値で入力してください'); return; }
    if (start < 0 || end > maxTime) { setEventFormError(`時間は 0 〜 ${maxTime} 秒の範囲で入力してください`); return; }
    if (start >= end)               { setEventFormError('終了時間は開始時間より大きくしてください'); return; }
    const colorIdx = events.length % EVENT_PALETTE.length;
    const newEv: EventAnnotation = { id: generateId(), name, startTime: start, endTime: end, color: EVENT_PALETTE[colorIdx] };
    setEvents(prev => [...prev, newEv]);
    setNewEventName(''); setNewEventStart(''); setNewEventEnd('');
    setShowEventForm(false);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    if (expandedEventId === id) setExpandedEventId(null);
  };

  return (
    <CollapsibleCard
      label="EVENT ANNOTATIONS"
      labelColor="oklch(0.72 0.16 250)"
      title="イベント（介入）登録"
      info="イベント名・開始・終了時間を登録するとグラフに反映されます"
      borderLeftColor="oklch(0.55 0.18 250)"
      storageKey="ksdv.collapse.events"
      badge={events.length > 0 ? (
        <span style={{
          fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem',
          background: 'oklch(0.55 0.18 250 / 0.15)', border: '1px solid oklch(0.55 0.18 250 / 0.4)',
          color: 'oklch(0.72 0.16 250)', padding: '3px 10px', borderRadius: '4px',
        }}>
          {events.length}件
        </span>
      ) : null}
    >
      {/* イベントを追加ボタン（本体先頭。折りたたみ時は本体ごと隠れる） */}
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setShowEventForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all"
          style={{
            fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.82rem',
            background: showEventForm ? 'oklch(0.32 0.12 250)' : 'oklch(0.22 0.04 255)',
            color: 'oklch(0.90 0.005 250)',
          }}
        >
          <Plus size={14} />
          イベントを追加
        </button>
      </div>

      {/* 追加フォーム */}
      {showEventForm && (
        <SettingBox className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fontWeight: 600, color: 'oklch(0.75 0.008 250)', display: 'block', marginBottom: '4px' }}>
                イベント名
              </label>
              <input
                type="text"
                value={newEventName}
                onChange={e => setNewEventName(e.target.value)}
                placeholder="例: プレゼン開始"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.82rem', border: '1px solid oklch(0.28 0.04 255)', background: 'oklch(0.22 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
                onKeyDown={e => e.key === 'Enter' && handleAddEvent()}
              />
            </div>
            <div>
              <label style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fontWeight: 600, color: 'oklch(0.75 0.008 250)', display: 'block', marginBottom: '4px' }}>
                開始時間（秒）
              </label>
              <input
                type="number"
                value={newEventStart}
                onChange={e => setNewEventStart(e.target.value)}
                placeholder={`0 〜 ${maxTime}`}
                min={0} max={maxTime} step={0.1}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', border: '1px solid oklch(0.28 0.04 255)', background: 'oklch(0.22 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
              />
            </div>
            <div>
              <label style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fontWeight: 600, color: 'oklch(0.75 0.008 250)', display: 'block', marginBottom: '4px' }}>
                終了時間（秒）
              </label>
              <input
                type="number"
                value={newEventEnd}
                onChange={e => setNewEventEnd(e.target.value)}
                placeholder={`0 〜 ${maxTime}`}
                min={0} max={maxTime} step={0.1}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', border: '1px solid oklch(0.28 0.04 255)', background: 'oklch(0.22 0.04 255)', color: 'oklch(0.88 0.005 250)' }}
              />
            </div>
          </div>
          {eventFormError && (
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: '#ef4444', marginBottom: '8px' }}>
              {eventFormError}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={handleAddEvent} className="px-4 py-2 rounded-lg text-sm font-semibold transition-all" style={{ fontFamily: 'Noto Sans JP, sans-serif', background: 'oklch(0.22 0.04 255)', color: 'oklch(0.90 0.005 250)' }}>
              登録する
            </button>
            <button onClick={() => { setShowEventForm(false); setEventFormError(''); }} className="px-4 py-2 rounded-lg text-sm transition-all" style={{ fontFamily: 'Noto Sans JP, sans-serif', background: 'oklch(0.22 0.04 255)', color: 'oklch(0.75 0.008 250)' }}>
              キャンセル
            </button>
          </div>
        </SettingBox>
      )}

      {/* イベント一覧 */}
      {events.length === 0 ? (
        <div className="py-6 text-center" style={{ border: '1px dashed oklch(0.28 0.04 255)', borderRadius: '12px' }}>
          <Tag size={20} style={{ color: 'oklch(0.72 0.015 250)', margin: '0 auto 8px' }} />
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.82rem', color: 'oklch(0.68 0.015 255)' }}>
            まだイベントが登録されていません
          </p>
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 250)', marginTop: '4px' }}>
            「イベントを追加」ボタンから登録してください
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(ev => {
            const stat = eventStats.find(s => s.id === ev.id);
            const isExpanded = expandedEventId === ev.id;
            return (
              <div key={ev.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${ev.color}40`, background: `${ev.color}08` }}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ev.color }} />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.88rem', color: 'oklch(0.88 0.005 250)' }}>
                      {ev.name}
                    </div>
                    <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', color: 'oklch(0.68 0.015 250)' }}>
                      {ev.startTime}s — {ev.endTime}s &nbsp;|&nbsp; {(ev.endTime - ev.startTime).toFixed(1)}秒間 &nbsp;|&nbsp; {stat?.frameCount || 0} フレーム
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* グラフをこのイベント区間にズーム */}
                    <button
                      onClick={() => onZoomEvent(ev.startTime, ev.endTime)}
                      className="p-1.5 rounded-lg transition-all text-xs"
                      style={{ color: ev.color, background: `${ev.color}15`, fontFamily: 'Roboto Mono, monospace', fontSize: '0.58rem' }}
                      title="この区間をグラフでズーム"
                    >
                      zoom
                    </button>
                    <button
                      onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                      className="p-1.5 rounded-lg transition-all"
                      style={{ color: ev.color, background: `${ev.color}15` }}
                      title="感情統計を表示"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="p-1.5 rounded-lg transition-all"
                      style={{ color: '#ef4444', background: '#ef444415' }}
                      title="削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* 展開時の感情統計 */}
                {isExpanded && stat && stat.frameCount > 0 && (
                  <div className="px-4 pb-4 pt-1">
                    <SettingSubLabel color={ev.color}>EVENT EMOTION STATS — {ev.name}</SettingSubLabel>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {(['engagement', 'valence', 'attention'] as const).map(key => (
                        <div key={key} className="p-2 rounded-lg text-center" style={{ background: SPECIAL_COLORS[key] + '12', border: `1px solid ${SPECIAL_COLORS[key]}30` }}>
                          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: SPECIAL_COLORS[key], marginBottom: '2px', textTransform: 'uppercase' }}>{key}</div>
                          <div style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 700, fontSize: '1rem', color: 'oklch(0.88 0.005 250)' }}>
                            {stat.stats[key]?.mean.toFixed(1)}
                          </div>
                          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)' }}>
                            max {stat.stats[key]?.max.toFixed(1)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {NON_NEUTRAL_EMOTIONS.filter(e => e !== 'confusion').map(e => {
                        const mean  = stat.stats[e]?.mean || 0;
                        const isDom = stat.dominantEmotion === e;
                        return (
                          <div key={e} className="flex items-center gap-2">
                            <div className="flex-shrink-0 text-right" style={{ width: '52px' }}>
                              <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: isDom ? EMOTION_COLORS[e] : 'oklch(0.68 0.015 250)', fontWeight: isDom ? 700 : 400 }}>
                                {EMOTION_LABELS_JA[e]}
                              </span>
                            </div>
                            <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'oklch(0.22 0.04 255)' }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, mean * 2)}%`, background: EMOTION_COLORS[e], opacity: isDom ? 1 : 0.7 }} />
                            </div>
                            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: isDom ? EMOTION_COLORS[e] : 'oklch(0.68 0.015 255)', minWidth: '36px', fontWeight: isDom ? 700 : 400 }}>
                              {mean.toFixed(2)}
                            </span>
                            {isDom && <span className="px-1 py-0.5 rounded text-xs" style={{ background: EMOTION_COLORS[e] + '20', color: EMOTION_COLORS[e], fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.6rem' }}>主要</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 区間比較・統計的検定（イベント2件以上の場合のみ） */}
      {events.length >= 2 && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid oklch(0.25 0.04 255)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="section-label mb-1" style={{ color: 'oklch(0.65 0.20 270)' }}>STATISTICAL COMPARISON</div>
              <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'oklch(0.88 0.005 250)' }}>
                区間比較・統計的検定
              </div>
              <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.68 0.015 255)', marginTop: '2px' }}>
                2つのイベント区間の感情スコアをWelchのt検定で比較します
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 mb-3">
            {(['A', 'B'] as const).map(seg => {
              const val = seg === 'A' ? compSegA : compSegB;
              const setVal = seg === 'A'
                ? (v: string) => { setCompSegA(v); setComparisonResult(null); }
                : (v: string) => { setCompSegB(v); setComparisonResult(null); };
              return (
                <div key={seg}>
                  <label style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.68 0.015 255)', display: 'block', marginBottom: '4px' }}>区間 {seg}</label>
                  <select
                    value={val}
                    onChange={e => setVal(e.target.value)}
                    className="rounded px-2 py-1 text-sm"
                    style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.32 0.06 255)', color: 'oklch(0.88 0.005 250)', fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem' }}
                  >
                    <option value="">選択してください</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name} ({ev.startTime}s–{ev.endTime}s)</option>
                    ))}
                  </select>
                </div>
              );
            })}
            <button
              disabled={!compSegA || !compSegB || compSegA === compSegB}
              onClick={() => {
                const evA = events.find(e => e.id === compSegA);
                const evB = events.find(e => e.id === compSegB);
                if (!evA || !evB) return;
                const result = compareSegments(
                  displayTimeseriesFull,
                  { start: evA.startTime, end: evA.endTime, name: evA.name },
                  { start: evB.startTime, end: evB.endTime, name: evB.name },
                );
                setComparisonResult(result);
                setShowComparison(true);
              }}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: 'oklch(0.45 0.18 270)', color: 'white', fontFamily: 'Noto Sans JP, sans-serif' }}
            >
              検定を実行
            </button>
          </div>

          {showComparison && comparisonResult && (() => {
            const evA = events.find(e => e.id === compSegA);
            const evB = events.find(e => e.id === compSegB);
            return (
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid oklch(0.30 0.06 270)' }}>
                <div className="px-3 py-2 flex items-center justify-between" style={{ background: 'oklch(0.20 0.05 270)', borderBottom: '1px solid oklch(0.28 0.05 270)' }}>
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.65 0.20 270)', letterSpacing: '0.06em' }}>
                    WELCH t-TEST RESULTS — {evA?.name} vs {evB?.name}
                  </span>
                  <div className="flex gap-3 text-xs" style={{ fontFamily: 'Roboto Mono, monospace', color: 'oklch(0.66 0.015 255)' }}>
                    <span>*** p&lt;0.001</span><span>** p&lt;0.01</span><span>* p&lt;0.05</span><span>n.s. p≥0.05</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'oklch(0.185 0.04 255)', borderBottom: '1px solid oklch(0.26 0.04 255)' }}>
                        {['感情', `${evA?.name} 平均`, `${evB?.name} 平均`, 't値', 'df', 'p値', "Cohen's d", '効果量', '有意性'].map(h => (
                          <th key={h} style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.62 0.015 255)', padding: '6px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TESTABLE_EMOTIONS.map((emotion, i) => {
                        const r = comparisonResult[emotion];
                        if (!r) return null;
                        const isSig = r.significance !== 'n.s.';
                        return (
                          <tr key={emotion} style={{ borderBottom: '1px solid oklch(0.22 0.04 255)', background: isSig ? 'oklch(0.22 0.06 270 / 0.4)' : 'transparent' }}>
                            <td style={{ padding: '5px 10px' }}>
                              <span className="px-2 py-0.5 rounded text-xs" style={{ background: EMOTION_COLORS[emotion] + '20', color: EMOTION_COLORS[emotion] || 'oklch(0.75 0.008 250)', fontFamily: 'Noto Sans JP, sans-serif' }}>
                                {EMOTION_LABELS_JA[emotion] || emotion}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: evA ? evA.color : 'oklch(0.75 0.008 250)', fontSize: '0.72rem' }}>{r.meanA.toFixed(3)}</td>
                            <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: evB ? evB.color : 'oklch(0.75 0.008 250)', fontSize: '0.72rem' }}>{r.meanB.toFixed(3)}</td>
                            <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: 'oklch(0.75 0.008 250)', fontSize: '0.72rem' }}>{r.t.toFixed(3)}</td>
                            <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: 'oklch(0.66 0.015 255)', fontSize: '0.72rem' }}>{r.df.toFixed(1)}</td>
                            <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: isSig ? 'oklch(0.78 0.20 140)' : 'oklch(0.66 0.015 255)', fontSize: '0.72rem' }}>{r.p.toFixed(4)}</td>
                            <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', color: 'oklch(0.75 0.008 250)', fontSize: '0.72rem' }}>{r.cohensD.toFixed(3)}</td>
                            <td style={{ fontFamily: 'Noto Sans JP, sans-serif', padding: '5px 10px', color: 'oklch(0.65 0.015 255)', fontSize: '0.72rem' }}>{r.effectSize}</td>
                            <td style={{ fontFamily: 'Roboto Mono, monospace', padding: '5px 10px', fontSize: '0.85rem', fontWeight: 700, color: isSig ? 'oklch(0.85 0.22 95)' : 'oklch(0.62 0.015 255)' }}>{r.significance}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </CollapsibleCard>
  );
}
