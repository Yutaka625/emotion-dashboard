/**
 * SessionMetadataCard
 * セッション（1 CSV ＝ 1回の測定）の実験計画メタデータ入力フォーム。
 *
 * 被験者属性・実験設計・測定環境・自由記述を構造化記録し、再現性を担保する。
 * 入力は filename をキーに localStorage へ自動保存（`ksdv.sessionMeta`）。
 * 録画日時は CSV から自動取得済みのため読み取り専用で併記する。
 */

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import type { SessionMetadata } from '@/lib/sessionMeta';
import { readSessionMeta, writeSessionMeta, clearSessionMeta, emptySessionMetadata, hasAnySessionMeta } from '@/lib/sessionMeta';
import CollapsibleCard from '@/components/ui/CollapsibleCard';

interface Props {
  data: DashboardData;
  onChange?: () => void;
  defaultOpen?: boolean;
  storageKey?: string;
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', fontWeight: 600,
  color: 'oklch(0.75 0.008 250)', display: 'block', marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.82rem',
  border: '1px solid oklch(0.28 0.04 255)', background: 'oklch(0.22 0.04 255)',
  color: 'oklch(0.88 0.005 250)',
};

const groupTitleStyle: React.CSSProperties = {
  fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.06em',
  color: 'oklch(0.62 0.015 255)', marginBottom: '8px',
};

/** 1フィールドの定義（グループ・キー・ラベル・プレースホルダ・複数行か） */
type FieldGroup = 'subject' | 'design' | 'environment' | 'notes';
interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}

const FIELDS: Record<FieldGroup, { title: string; fields: FieldDef[] }> = {
  subject: {
    title: 'SUBJECT — 被験者属性',
    fields: [
      { key: 'subject_id', label: '被験者ID', placeholder: '例: P01' },
      { key: 'age', label: '年齢', placeholder: '例: 24' },
      { key: 'sex', label: '性別', placeholder: '例: F / M / その他' },
      { key: 'handedness', label: '利き手', placeholder: '例: 右 / 左' },
    ],
  },
  design: {
    title: 'DESIGN — 実験設計',
    fields: [
      { key: 'group', label: '群', placeholder: '例: 介入群 / 対照群' },
      { key: 'condition', label: '条件', placeholder: '例: 動画A視聴' },
      { key: 'stimulus', label: '刺激・タスク', placeholder: '例: CM素材X' },
      { key: 'session_number', label: '測定回（再テスト用）', placeholder: '例: 1, 2' },
    ],
  },
  environment: {
    title: 'ENVIRONMENT — 測定環境',
    fields: [
      { key: 'lighting', label: '照明', placeholder: '例: 室内蛍光灯' },
      { key: 'location', label: '場所', placeholder: '例: 実験室B' },
      { key: 'device', label: 'デバイス・カメラ', placeholder: '例: ノートPC内蔵カメラ' },
      { key: 'camera_distance', label: 'カメラ距離', placeholder: '例: 約60cm' },
    ],
  },
  notes: {
    title: 'NOTES — 自由記述',
    fields: [
      { key: 'protocol', label: 'プロトコル要約', placeholder: '例: 安静30秒→刺激提示2分', multiline: true },
      { key: 'free_notes', label: '備考', placeholder: '途中で中断あり、など', multiline: true },
    ],
  },
};

export default function SessionMetadataCard({
  data,
  onChange,
  defaultOpen = false,
  storageKey = 'ksdv.collapse.overview.sessionMeta',
}: Props) {
  const filename = data.meta.filename;
  const [meta, setMeta] = useState<SessionMetadata>(() => readSessionMeta(filename));
  // クリア操作の2段階確認（誤操作防止）。ファイル切替時はリセット。
  const [confirmingClear, setConfirmingClear] = useState(false);

  // CSV を切り替えたら、そのファイルのメタデータを読み直す
  useEffect(() => {
    setMeta(readSessionMeta(filename));
    setConfirmingClear(false);
  }, [filename]);

  // 入力のたびに localStorage へ保存（filename キー）
  const updateField = (group: FieldGroup, key: string, value: string) => {
    setMeta(prev => {
      const next: SessionMetadata = {
        ...prev,
        [group]: { ...prev[group], [key]: value },
      };
      writeSessionMeta(filename, next);
      onChange?.();
      return next;
    });
  };

  // このセッション（filename）ぶんのメタデータのみ削除しフォームを空に戻す
  const handleClear = () => {
    clearSessionMeta(filename);
    setMeta(emptySessionMetadata());
    onChange?.();
    setConfirmingClear(false);
  };

  const filled = hasAnySessionMeta(meta);

  return (
    <CollapsibleCard
      label="SESSION METADATA"
      title="記録条件・被験者メタデータ"
      tier="pro"
      info="実験の再現性のため、被験者属性・実験設計・測定環境を記録します。全項目は任意で、入力はこのブラウザに自動保存され（外部送信なし）、学術CSV出力にも含まれます。録画日時はCSVから自動取得しています。"
      badge={filled ? (
        <span className="px-2 py-0.5 rounded" style={{ background: 'oklch(0.25 0.06 160)', color: 'oklch(0.80 0.18 160)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem' }}>
          入力あり
        </span>
      ) : undefined}
      defaultOpen={defaultOpen}
      storageKey={storageKey}
    >
      {/* 自動取得情報（読み取り専用）＋このセッションのメタデータをクリア */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.66rem', color: 'oklch(0.58 0.015 255)' }}>
          <span>ファイル: {filename}</span>
          <span>録画日時: {data.meta.recording_date || '—'} {data.meta.recording_time}</span>
          <span>総フレーム: {data.meta.total_frames.toLocaleString()}</span>
        </div>
        {filled && (
          <div className="flex-shrink-0">
            {confirmingClear ? (
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.72 0.16 30)', whiteSpace: 'nowrap' }}>このセッションの記録を消去しますか？</span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2.5 py-1 rounded text-xs transition-colors"
                  style={{ fontFamily: 'Noto Sans JP, sans-serif', whiteSpace: 'nowrap', background: 'oklch(0.45 0.18 25)', color: 'oklch(0.97 0.01 25)', border: '1px solid oklch(0.55 0.20 25)' }}
                >
                  はい、消去
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="px-2.5 py-1 rounded text-xs transition-colors"
                  style={{ fontFamily: 'Noto Sans JP, sans-serif', whiteSpace: 'nowrap', background: 'transparent', color: 'oklch(0.66 0.015 255)', border: '1px solid oklch(0.32 0.04 255)' }}
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors"
                style={{ fontFamily: 'Noto Sans JP, sans-serif', whiteSpace: 'nowrap', background: 'transparent', color: 'oklch(0.70 0.14 30)', border: '1px solid oklch(0.45 0.12 30)' }}
                title="このセッション（このファイル）のメタデータを消去します。他のファイルの記録は残ります。録画日時など自動取得情報は対象外です。"
              >
                <Trash2 size={12} />
                クリア
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-5">
        {(Object.keys(FIELDS) as FieldGroup[]).map(group => (
          <div key={group}>
            <div style={groupTitleStyle}>{FIELDS[group].title}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FIELDS[group].fields.map(f => {
                const value = (meta[group] as Record<string, string | undefined>)[f.key] ?? '';
                return (
                  <div key={f.key} className={f.multiline ? 'md:col-span-2' : undefined}>
                    <label style={labelStyle}>{f.label}</label>
                    {f.multiline ? (
                      <textarea
                        value={value}
                        onChange={e => updateField(group, f.key, e.target.value)}
                        placeholder={f.placeholder}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                        style={inputStyle}
                      />
                    ) : (
                      <input
                        type="text"
                        value={value}
                        onChange={e => updateField(group, f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={inputStyle}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
}
