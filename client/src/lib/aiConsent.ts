/**
 * aiConsent.ts
 * AIインサイト機能の同意状態を管理する。
 *
 * AI機能は集計データを端末外（Anthropic API）へ送信するため、
 * 通常のKSDV（ブラウザ完結・無送信）とは別に、利用者の明示同意を必須とする。
 * 同意フラグはバージョン付きで localStorage に保存し、規約改訂時は再同意を求める。
 * （送信されるのは集計指標のみ。生フレーム・顔座標・映像は送らない。）
 */

/** AI利用規約のバージョン。規約改訂時に上げると再同意が必要になる。 */
export const AI_CONSENT_VERSION = 1;

const STORAGE_KEY = 'ksdv.aiConsent';

interface StoredConsent {
  version: number;
  agreed_at: string;
}

/** 現行バージョンに同意済みか */
export function hasAiConsent(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as StoredConsent;
    return parsed.version === AI_CONSENT_VERSION;
  } catch {
    return false;
  }
}

/** 現行バージョンへの同意を記録する */
export function setAiConsent(): void {
  try {
    const value: StoredConsent = {
      version: AI_CONSENT_VERSION,
      agreed_at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // 永続化できない環境（プライベートモード等）では無視
  }
}

/** 同意を取り消す（テスト・設定リセット用） */
export function clearAiConsent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
