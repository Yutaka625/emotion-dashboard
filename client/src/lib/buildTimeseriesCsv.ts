/*
 * buildTimeseriesCsv
 * 「時系列生データ」CSV出力の本体。生のCSV行（パース済み）＋抽出条件 から CSV文字列を作る純関数。
 *
 * 設計方針:
 * - 出力元は常に「生行（全フレーム）」。ダウンサンプルや列の取捨選択は条件で切り替える。
 * - 時刻は computeDashboardData と同じく 0 始まりに正規化する（時間範囲フィルタが 0〜duration 秒前提のため）。
 * - 値が空・数値でないセルは空欄として出力する（0 で埋めない＝欠損を正直に表す）。
 *
 * UI から切り離した純関数にすることで、テストや他出力への再利用を容易にする。
 */

import { NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import { ACTION_UNIT_COLS, HEAD_POSE_COLS } from '@/lib/csvAnalyzer';
import { csvQuote } from '@/lib/csvExport';

const SPECIAL_COLS = ['engagement', 'valence', 'attention'];
// 感情はニュートラルも含めた10種（生データを忠実に出すため neutral も対象）
const EMOTION_COLS = [...NON_NEUTRAL_EMOTIONS, 'neutral'];

/** 列グループの種類。`other` は座標・ランドマーク・輝度など既知カテゴリ以外の全列。 */
export type ColumnGroupKey = 'emotions' | 'special' | 'actionUnits' | 'headPose' | 'other';

/** どの列グループを出力に含めるか（既定はすべて true ＝全データ出力） */
export type ColumnSelection = Record<ColumnGroupKey, boolean>;

/**
 * CSVヘッダーを列グループに振り分ける（出力順は元ヘッダーの並びを保持）。
 * time 列・FaceID 列は別扱いのため除外する。
 * `other` は感情/特殊指標/AU/頭部姿勢のいずれにも属さない列（輝度・瞳孔間距離・
 * バウンディングボックス・ランドマーク座標・未知の追加列など）をすべて拾う。
 */
export function categorizeColumns(
  header: string[],
  timeCol: string,
  faceIdCol: string | null,
): Record<ColumnGroupKey, string[]> {
  const emoSet = new Set(EMOTION_COLS);
  const spSet = new Set(SPECIAL_COLS);
  const auSet = new Set(ACTION_UNIT_COLS);
  const hpSet = new Set(HEAD_POSE_COLS);
  const groups: Record<ColumnGroupKey, string[]> = { emotions: [], special: [], actionUnits: [], headPose: [], other: [] };
  for (const h of header) {
    if (h === timeCol || h === faceIdCol) continue;
    if (emoSet.has(h)) groups.emotions.push(h);
    else if (spSet.has(h)) groups.special.push(h);
    else if (auSet.has(h)) groups.actionUnits.push(h);
    else if (hpSet.has(h)) groups.headPose.push(h);
    else groups.other.push(h);
  }
  return groups;
}

/** FaceID の抽出範囲 */
export type FaceScope =
  | { kind: 'all' }                       // FaceID 列なし or 全行
  | { kind: 'selected'; faceIds: string[] } // 選択中の顔のみ（合算・FaceID列なし）
  | { kind: 'split'; faceIds: string[] };   // 1ファイルに FaceID 列を付けて分割出力

export interface TimeseriesExportOptions {
  faceScope: FaceScope;
  /** 0始まりの時間範囲（秒）。[start, end] の両端を含む */
  timeRange: [number, number];
  columns: ColumnSelection;
  /** 小数点以下の桁数 */
  decimals: number;
  /** true=全フレーム生データ / false=最大600点にダウンサンプル */
  fullFrames: boolean;
  /**
   * time 列の出力表記。
   *   'original' … 元データの time 値をそのまま出力（加工なし。生データ出力の既定）
   *   'zero'     … 区間先頭を 0 秒に振り直して出力（ダッシュボードの時間軸と同じ）
   * ※ どちらでも時間範囲フィルタは「先頭からの経過秒（0始まり）」で評価する。
   */
  timeMode: 'original' | 'zero';
}

export interface TimeseriesExportInput {
  /** パース済みの全生行 */
  rows: Record<string, string>[];
  /** 時刻列のヘッダー名（通常は先頭列 "time stamp"） */
  timeCol: string;
  /** FaceID 列のヘッダー名（無ければ null） */
  faceIdCol: string | null;
}

/**
 * 出力する値列を、元ヘッダーの並び順を保ったまま組み立てる。
 * オフにされたグループの列だけを除外する（＝既定では全列が出力される）。
 */
function buildValueColumns(header: string[], timeCol: string, faceIdCol: string | null, columns: ColumnSelection): string[] {
  const groups = categorizeColumns(header, timeCol, faceIdCol);
  const enabled = new Set<string>();
  (Object.keys(groups) as ColumnGroupKey[]).forEach(k => {
    if (columns[k]) groups[k].forEach(c => enabled.add(c));
  });
  // 元ヘッダー順を維持（time/FaceID は別扱い）
  return header.filter(h => h !== timeCol && h !== faceIdCol && enabled.has(h));
}

/**
 * 文字列セル（ヘッダー名・FaceID値など）を出力する。
 * カンマ・引用符・改行を含むときだけクォートする。
 * KSDV の簡易パーサは引用符を外さないため、不要なクォートは付けない
 * （= 出力した CSV をそのまま KSDV に読み戻せるようにする）。
 */
function maybeQuote(s: string): string {
  return /[",\n]/.test(s) ? csvQuote(s) : s;
}

/** セル値を整形する。数値なら指定桁、数値でなければ空欄。 */
function fmt(raw: string | undefined, decimals: number): string {
  if (raw == null || raw.trim() === '') return '';
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v.toFixed(decimals) : '';
}

/**
 * 抽出条件に従って時系列CSVの本文（ヘッダー＋データ行）を生成する。
 * @returns CSV本文（改行連結済み）。BOM付与・ダウンロードは呼び出し側（csvExport.downloadCSV）が行う。
 */
export function buildTimeseriesCsv(
  input: TimeseriesExportInput,
  options: TimeseriesExportOptions,
): string {
  const { rows, timeCol, faceIdCol } = input;
  const { faceScope, timeRange, columns, decimals, fullFrames, timeMode } = options;

  // 1) FaceID 範囲で行を絞り込む
  let selected = rows;
  const split = faceScope.kind === 'split';
  if (faceIdCol && faceScope.kind !== 'all') {
    const idSet = new Set(faceScope.faceIds);
    selected = rows.filter(r => idSet.has(r[faceIdCol]));
  }

  // 2) 先頭時刻を求める（時間範囲フィルタは常に「先頭からの経過秒」で評価するため）。
  //    出力する time の値は timeMode で切り替える（元の値そのまま / 0始まり）。
  let startTime = Infinity;
  for (const r of selected) {
    const t = parseFloat(r[timeCol]);
    if (Number.isFinite(t) && t < startTime) startTime = t;
  }
  if (!Number.isFinite(startTime)) startTime = 0;

  // 3) 行にフィルタ用の経過時刻(t)と元時刻(raw)を付与し、時間範囲でフィルタ → 時刻順にソート
  const [rangeStart, rangeEnd] = timeRange;
  type Prepared = { t: number; raw: number; row: Record<string, string> };
  const prepared: Prepared[] = [];
  for (const r of selected) {
    const raw = parseFloat(r[timeCol]);
    if (!Number.isFinite(raw)) continue;
    const t = raw - startTime; // フィルタ判定用の経過秒（0始まり）
    if (t < rangeStart || t > rangeEnd) continue;
    prepared.push({ t, raw, row: r });
  }
  // split のときは FaceID→時刻 の順、それ以外は時刻順
  if (split && faceIdCol) {
    prepared.sort((a, b) => {
      const fa = a.row[faceIdCol] ?? '';
      const fb = b.row[faceIdCol] ?? '';
      return fa === fb ? a.t - b.t : fa < fb ? -1 : 1;
    });
  } else {
    prepared.sort((a, b) => a.t - b.t);
  }

  // 4) ダウンサンプル（オプション）。全フレームでなければ最大600点へ間引く。
  let points = prepared;
  if (!fullFrames && prepared.length > 600) {
    const step = Math.max(1, Math.floor(prepared.length / 600));
    points = prepared.filter((_, i) => i % step === 0);
  }

  // 5) ヘッダー組み立て
  //    KSDV で再分析できる（往復可能な）形にするため:
  //      - 先頭列は必ず time（KSDVは先頭列を時刻列とみなす）
  //      - FaceID は2列目に置く（KSDVは列名で検出するので先頭でなくてよい）
  //      - ヘッダーはクォートしない（KSDVの簡易パーサは引用符を外さないため、
  //        クォートすると列名が一致しなくなる）。列名にカンマ等が無いので安全。
  const csvHeader = Object.keys(rows[0] ?? {});
  const valueCols = buildValueColumns(csvHeader, timeCol, faceIdCol, columns);
  const header: string[] = ['time'];
  if (split && faceIdCol) header.push('FaceID');
  header.push(...valueCols);

  // 6) データ行組み立て（時刻 → FaceID → 各指標 の順）
  //    timeMode='original' は元の time 値をそのまま、'zero' は先頭を0にした経過秒を出力。
  const lines: string[] = [header.map(maybeQuote).join(',')];
  for (const p of points) {
    const timeVal = timeMode === 'original' ? p.raw : p.t;
    const cells: string[] = [timeVal.toFixed(decimals)];
    if (split && faceIdCol) cells.push(maybeQuote(p.row[faceIdCol] ?? ''));
    for (const col of valueCols) cells.push(fmt(p.row[col], decimals));
    lines.push(cells.join(','));
  }

  return lines.join('\n');
}
