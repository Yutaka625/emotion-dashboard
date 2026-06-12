/*
 * csvExport
 * CSV ダウンロード処理を1か所に集約する共通ユーティリティ。
 *
 * これまで各セクション（学術レポート / 時系列 / ベースライン補正 / 比較）が
 * それぞれ Blob 生成 → a 要素クリック → revokeObjectURL を個別に書いていたため、
 * BOM の有無やエスケープ処理が散らばっていた。ここに集約して挙動を揃える。
 */

/**
 * CSV のセル内文字列をダブルクォートで安全に囲む。
 * 値の中の `"` は `""` にエスケープする（CSV の標準仕様）。
 * カンマ・改行・前後空白を含む値でも壊れないようにする。
 */
export function csvQuote(s: string | number): string {
  return `"${String(s).replace(/"/g, '""')}"`;
}

/**
 * CSV 文字列をファイルとしてダウンロードさせる。
 * @param filename ダウンロード時のファイル名（例: "emotion_data_0-120s.csv"）
 * @param content  CSV 本文（行を改行で連結した文字列）
 * @param opts.bom  Excel の文字化け防止のため UTF-8 BOM を付けるか（既定 true）
 */
export function downloadCSV(
  filename: string,
  content: string,
  opts: { bom?: boolean } = {},
): void {
  const { bom = true } = opts;
  // 先頭に ﻿（BOM）を付けると Excel が UTF-8 として正しく開ける
  const body = bom ? '﻿' + content : content;
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.visibility = 'hidden';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
