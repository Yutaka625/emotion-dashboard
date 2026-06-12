/*
 * ExportSettingsDialog
 * 「時系列生データ」CSV出力の前に、抽出条件を決めるモーダル。
 *
 * 設計方針（KSDVの思想＝非エンジニア運用・シンプルさ）:
 * - 触らずに「そのまま出力」を押せば、元データの全列を加工せず（time＝元の値・全フレーム）出す。
 * - 条件（FaceID範囲／時間範囲／time表記／列／精度）は不要分だけ触ればよい。
 *
 * 実データの生成は純関数 buildTimeseriesCsv に委譲し、ダウンロードは csvExport.downloadCSV に集約する。
 */

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import SettingBox from '@/components/ui/SettingBox';
import { Download } from 'lucide-react';
import { useFaceID } from '@/contexts/FaceIDContext';
import { downloadCSV } from '@/lib/csvExport';
import {
  buildTimeseriesCsv,
  categorizeColumns,
  type ColumnGroupKey,
  type ColumnSelection,
  type FaceScope,
} from '@/lib/buildTimeseriesCsv';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 出力元ファイル名（拡張子はあってもなくてもよい） */
  filename: string;
  /** 時間範囲の最大値（秒）。初期範囲・上限に使う */
  maxTime: number;
  /** 初期の時間範囲（現在の表示範囲）。秒・0始まり */
  initialTimeRange: [number, number];
}

type FaceScopeKind = 'all' | 'selected' | 'split';

// 見た目の共通スタイル
const labelStyle = { fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.82 0.01 250)', fontWeight: 700 } as const;
const subStyle = { fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', color: 'oklch(0.62 0.015 255)' } as const;

export default function ExportSettingsDialog({ open, onOpenChange, filename, maxTime, initialTimeRange }: Props) {
  const { isMultiFace, selectedFaceIds, availableFaceIds, displayName, rawRows, rawTimeCol, rawFaceIdCol } = useFaceID();

  // 実データのヘッダーから、出力可能な列をグループ分けする（時刻・FaceID列は除外）。
  // 元CSVに実在する列だけを対象にするため、座標・ランドマーク等も自動で「その他」に入る。
  const groups = useMemo(() => {
    const header = Object.keys(rawRows[0] ?? {});
    return categorizeColumns(header, rawTimeCol ?? header[0] ?? 'time', rawFaceIdCol);
  }, [rawRows, rawTimeCol, rawFaceIdCol]);

  // ---- 条件 state（デフォルト = すべての列を出力。不要な分だけオフにする） ----
  const [faceScope, setFaceScope] = useState<FaceScopeKind>(isMultiFace ? 'selected' : 'all');
  const [timeRange, setTimeRange] = useState<[number, number]>(initialTimeRange);
  const [columns, setColumns] = useState<ColumnSelection>({ emotions: true, special: true, actionUnits: true, headPose: true, other: true });
  const [decimals, setDecimals] = useState(3);
  const [fullFrames, setFullFrames] = useState(true);
  // time 列の表記。既定は元の値そのまま（生データ出力として加工しない）
  const [timeMode, setTimeMode] = useState<'original' | 'zero'>('original');

  const toggleColumn = (key: ColumnGroupKey) =>
    setColumns(prev => ({ ...prev, [key]: !prev[key] }));

  // 列グループの表示メタ（ラベル・補足）。実在する列があるグループだけ表示する。
  const columnGroupMeta: { key: ColumnGroupKey; label: string; hint: (cols: string[]) => string }[] = [
    { key: 'emotions',    label: '感情',          hint: cols => `${cols.length}種：${cols.slice(0, 3).join(' / ')} …` },
    { key: 'special',     label: '特殊指標',      hint: cols => cols.join(' / ') },
    { key: 'actionUnits', label: 'Action Units',  hint: cols => `${cols.length}種：${cols.slice(0, 2).join(' / ')} など顔の筋肉` },
    { key: 'headPose',    label: 'ヘッドポーズ',  hint: cols => cols.join(' / ') },
    { key: 'other',       label: 'その他の計測値', hint: cols => `${cols.length}列：輝度・瞳孔間距離・バウンディングボックス・ランドマーク座標など` },
  ];

  const setStart = (v: number) => setTimeRange(([, e]) => [Math.max(0, Math.min(v, e)), e]);
  const setEnd = (v: number) => setTimeRange(([s]) => [s, Math.min(maxTime, Math.max(v, s))]);

  // 実在かつオンになっている列が1つもなければ出力不可
  const noColumns = columnGroupMeta.every(({ key }) => groups[key].length === 0 || !columns[key]);

  const handleExport = () => {
    // FaceID 範囲を組み立てる
    let scope: FaceScope;
    if (faceScope === 'all' || !isMultiFace) scope = { kind: 'all' };
    else if (faceScope === 'split') scope = { kind: 'split', faceIds: availableFaceIds };
    else scope = { kind: 'selected', faceIds: selectedFaceIds };

    const content = buildTimeseriesCsv(
      { rows: rawRows, timeCol: rawTimeCol ?? Object.keys(rawRows[0] ?? {})[0] ?? 'time', faceIdCol: rawFaceIdCol },
      { faceScope: scope, timeRange, columns, decimals, fullFrames, timeMode },
    );

    // ファイル名: 範囲と分割の有無を反映
    const base = filename.replace(/\.[^.]+$/, '') || 'emotion_data';
    const split = faceScope === 'split' && isMultiFace ? '_byface' : '';
    const name = `emotion_data_${base}${split}_${timeRange[0]}-${timeRange[1]}s.csv`;
    downloadCSV(name, content);
    onOpenChange(false);
  };

  // チェックボックス行（列選択など）
  const Check = ({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint?: string }) => (
    <label className="flex items-start gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={onChange} style={{ marginTop: '2px', accentColor: 'oklch(0.70 0.14 195)' }} />
      <span>
        <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.74rem', color: 'oklch(0.80 0.01 250)' }}>{label}</span>
        {hint && <span style={{ ...subStyle, marginLeft: '6px' }}>{hint}</span>}
      </span>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px] gap-3"
        style={{ background: 'oklch(0.20 0.04 255)', border: '1px solid oklch(0.30 0.04 255)', color: 'oklch(0.82 0.01 250)' }}
      >
        <DialogTitle style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: 'oklch(0.90 0.005 250)' }}>
          時系列データの出力設定
        </DialogTitle>
        <DialogDescription style={subStyle}>
          条件を変えなければ、元データの全列（感情・特殊指標・Action Units・ヘッドポーズ・座標等）を加工せず出力します。
        </DialogDescription>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {/* FaceID 範囲（マルチFaceID時のみ） */}
          {isMultiFace && (
            <SettingBox>
              <div style={labelStyle} className="mb-2">FaceID（人物）の範囲</div>
              <div className="space-y-1.5">
                {([
                  { id: 'selected' as const, label: '選択中の顔のみ', hint: `${selectedFaceIds.map(displayName).join(' / ') || 'なし'}` },
                  { id: 'all' as const, label: '全員をまとめて', hint: '検出した全人物を1ファイルに合算' },
                  { id: 'split' as const, label: 'FaceIDごとに分割', hint: '1ファイルに FaceID 列を付けて人物別に並べる' },
                ]).map(opt => (
                  <label key={opt.id} className="flex items-start gap-2 cursor-pointer select-none">
                    <input type="radio" name="faceScope" checked={faceScope === opt.id} onChange={() => setFaceScope(opt.id)} style={{ marginTop: '2px', accentColor: 'oklch(0.70 0.14 195)' }} />
                    <span>
                      <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.74rem', color: 'oklch(0.80 0.01 250)' }}>{opt.label}</span>
                      <span style={{ ...subStyle, marginLeft: '6px' }}>{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </SettingBox>
          )}

          {/* 時間範囲 */}
          <SettingBox>
            <div style={labelStyle} className="mb-2">時間範囲（秒）</div>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={timeRange[1]} value={timeRange[0]}
                onChange={e => setStart(Number(e.target.value))}
                className="w-24 px-2 py-1 rounded" style={{ background: 'oklch(0.16 0.03 255)', border: '1px solid oklch(0.32 0.04 255)', color: 'oklch(0.85 0.01 250)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }} />
              <span style={subStyle}>〜</span>
              <input type="number" min={timeRange[0]} max={maxTime} value={timeRange[1]}
                onChange={e => setEnd(Number(e.target.value))}
                className="w-24 px-2 py-1 rounded" style={{ background: 'oklch(0.16 0.03 255)', border: '1px solid oklch(0.32 0.04 255)', color: 'oklch(0.85 0.01 250)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }} />
              <span style={{ ...subStyle, marginLeft: '4px' }}>/ 全体 {maxTime}s</span>
            </div>
            {/* time 列の表記（元の値そのまま / 0始まり）。範囲指定は常に「先頭からの経過秒」で評価。 */}
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid oklch(0.28 0.04 255)' }}>
              <div style={{ ...subStyle, marginBottom: '4px' }}>time 列の表記</div>
              <div className="space-y-1">
                {([
                  { id: 'original' as const, label: '元の値そのまま', hint: '加工なし（生データ）' },
                  { id: 'zero' as const, label: '0秒始まりに揃える', hint: '区間先頭を0秒に' },
                ]).map(opt => (
                  <label key={opt.id} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="radio" name="timeMode" checked={timeMode === opt.id} onChange={() => setTimeMode(opt.id)} style={{ accentColor: 'oklch(0.70 0.14 195)' }} />
                    <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.80 0.01 250)' }}>{opt.label}</span>
                    <span style={subStyle}>{opt.hint}</span>
                  </label>
                ))}
              </div>
            </div>
          </SettingBox>

          {/* 列の選択（既定はすべて出力。不要な分だけオフにする） */}
          <SettingBox>
            <div style={labelStyle} className="mb-1">出力する列</div>
            <div style={{ ...subStyle, marginBottom: '8px' }}>既定で元データの全列を出力します。不要なグループだけチェックを外してください。</div>
            <div className="space-y-1.5">
              {columnGroupMeta
                .filter(({ key }) => groups[key].length > 0)
                .map(({ key, label, hint }) => (
                  <Check key={key} checked={columns[key]} onChange={() => toggleColumn(key)} label={label} hint={hint(groups[key])} />
                ))}
            </div>
            {noColumns && (
              <div style={{ ...subStyle, color: 'oklch(0.72 0.16 30)', marginTop: '6px' }}>
                ※ 少なくとも1つの列を選んでください
              </div>
            )}
          </SettingBox>

          {/* 精度・生データ */}
          <SettingBox>
            <div style={labelStyle} className="mb-2">数値の精度・データ量</div>
            <div className="flex items-center gap-2 mb-2">
              <span style={subStyle}>小数点以下</span>
              <input type="number" min={0} max={6} value={decimals}
                onChange={e => setDecimals(Math.max(0, Math.min(6, Number(e.target.value))))}
                className="w-16 px-2 py-1 rounded" style={{ background: 'oklch(0.16 0.03 255)', border: '1px solid oklch(0.32 0.04 255)', color: 'oklch(0.85 0.01 250)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }} />
              <span style={subStyle}>桁</span>
            </div>
            <Check checked={fullFrames} onChange={() => setFullFrames(v => !v)} label="全フレームの生データを出力" hint="オフで最大600点に間引き（軽量）" />
          </SettingBox>
        </div>

        <DialogFooter className="mt-1">
          <button
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 rounded text-xs"
            style={{ fontFamily: 'Noto Sans JP, sans-serif', background: 'oklch(0.24 0.03 255)', color: 'oklch(0.72 0.01 250)', border: '1px solid oklch(0.32 0.04 255)' }}
          >
            キャンセル
          </button>
          <button
            onClick={handleExport}
            disabled={noColumns || rawRows.length === 0}
            className="px-4 py-1.5 rounded text-xs flex items-center gap-1.5"
            style={{ fontFamily: 'Noto Sans JP, sans-serif', background: noColumns || rawRows.length === 0 ? 'oklch(0.35 0.04 255)' : 'oklch(0.50 0.13 70)', color: 'white', border: '1px solid oklch(0.70 0.15 70)', opacity: noColumns || rawRows.length === 0 ? 0.5 : 1, cursor: noColumns || rawRows.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            <Download size={14} />
            そのまま出力
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
