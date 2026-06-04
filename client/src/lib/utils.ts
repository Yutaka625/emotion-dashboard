import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── 数値フォーマット共通関数 ───────────────────────────────
// 表示の桁数を全セクションで統一するための共通フォーマッタ。
// 同じ種類の値が場所によって 1〜4 桁とバラバラだった問題を解消する。

/** 感情スコア（各感情の 0〜100 値）の表示。小数3桁で統一 */
export function formatScore(v: number): string {
  return v.toFixed(3);
}

/** Engagement / Valence / Attention（%指標）の表示。小数1桁で統一 */
export function formatPct(v: number): string {
  return v.toFixed(1);
}
