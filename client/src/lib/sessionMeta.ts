/**
 * sessionMeta.ts
 * セッション（＝1 CSV ＝ 1回の測定）の実験計画メタデータ。
 *
 * 再現性の担保のため、被験者属性・実験設計・測定環境・自由記述を構造化して記録する。
 * 全項目は任意（optional）。`schema_version` を付け、キー名はリネームせず追加のみで
 * 非破壊運用とする（将来のメタデータ「ファイル取込」とも共通スキーマにできる）。
 *
 * 永続化は localStorage に filename をキーとして保存する
 * （既存の FaceID ラベル `ksdv.faceLabels` と同じパターン）。
 */

/** 現行スキーマ版。項目追加時は互換維持（リネーム・削除はしない）。破壊的変更時のみ上げる。 */
export const SESSION_META_SCHEMA_VERSION = 1;

const STORAGE_KEY = 'ksdv.sessionMeta';

/** 被験者属性 */
export interface SubjectMeta {
  subject_id?: string;
  age?: string;
  sex?: string;
  handedness?: string;
}

/** 実験設計（将来の群間比較・信頼性検定の群定義に必須） */
export interface DesignMeta {
  group?: string;
  condition?: string;
  stimulus?: string;
  /** 測定回（テスト-再テスト信頼性で同一被験者の何回目かを示す） */
  session_number?: string;
}

/** 測定環境 */
export interface EnvironmentMeta {
  lighting?: string;
  location?: string;
  device?: string;
  camera_distance?: string;
}

/** 自由記述 */
export interface NotesMeta {
  protocol?: string;
  free_notes?: string;
}

/** 1セッションぶんのメタデータ */
export interface SessionMetadata {
  schema_version: number;
  subject: SubjectMeta;
  design: DesignMeta;
  environment: EnvironmentMeta;
  notes: NotesMeta;
}

/** 空のメタデータ（新規セッション用の初期値） */
export function emptySessionMetadata(): SessionMetadata {
  return {
    schema_version: SESSION_META_SCHEMA_VERSION,
    subject: {},
    design: {},
    environment: {},
    notes: {},
  };
}

function readAll(): Record<string, SessionMetadata> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, SessionMetadata>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // 永続化できない環境（プライベートモード等）では無視
  }
}

/** filename をキーにメタデータを読む。未保存なら空のメタデータを返す。 */
export function readSessionMeta(filename: string): SessionMetadata {
  const all = readAll();
  const found = all[filename];
  if (!found) return emptySessionMetadata();
  // 古い版を読み込んだ場合も欠損グループを補完して返す（前方互換）
  return {
    schema_version: found.schema_version ?? SESSION_META_SCHEMA_VERSION,
    subject: found.subject ?? {},
    design: found.design ?? {},
    environment: found.environment ?? {},
    notes: found.notes ?? {},
  };
}

/** filename をキーにメタデータを保存する。 */
export function writeSessionMeta(filename: string, meta: SessionMetadata): void {
  const all = readAll();
  all[filename] = { ...meta, schema_version: SESSION_META_SCHEMA_VERSION };
  writeAll(all);
}

/** filename のメタデータを削除する（このセッションぶんのみ。他ファイルの記録は残す）。 */
export function clearSessionMeta(filename: string): void {
  const all = readAll();
  if (filename in all) {
    delete all[filename];
    writeAll(all);
  }
}

/** メタデータに1つでも入力があるか（CSV出力の要否判定などに使う） */
export function hasAnySessionMeta(meta: SessionMetadata): boolean {
  const groups = [meta.subject, meta.design, meta.environment, meta.notes];
  return groups.some(g => Object.values(g).some(v => v != null && String(v).trim() !== ''));
}
