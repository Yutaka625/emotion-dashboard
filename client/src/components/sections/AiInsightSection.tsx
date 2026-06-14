/**
 * DESIGN: Neuro-Signal Interface
 * AIインサイト（有償機能）セクション。
 *
 * 集計指標のみを /api/ai-insight へ送信し、Claude による解釈・所見・示唆を表示する。
 * - 生フレーム・顔座標は送らない（buildAiPayload が集計のみを抽出）。
 * - 初回利用時は AI専用の同意（別規約）を必須にする。
 * - 自動実行しない（コスト・同意のため、利用者の明示クリックで生成）。
 */

import { useState } from 'react';
import type { DashboardData } from '@/lib/types';
import CardHeader from '@/components/ui/CardHeader';
import { buildAiPayload, type AiPersona } from '@/lib/buildAiPayload';
import { hasAiConsent, setAiConsent } from '@/lib/aiConsent';
import { Sparkles, RotateCcw, Copy, Check, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';

interface Props {
  data: DashboardData;
}

interface Finding {
  title: string;
  detail: string;
  confidence?: 'low' | 'medium' | 'high';
  caveats?: string[];
}
interface InsightResult {
  summary?: string;
  findings?: Finding[];
  suggestions?: string[];
  limitations?: string[];
}
interface ApiResponse {
  model: string;
  persona: string;
  generated_at: string;
  insight: InsightResult;
}

const PERSONA_OPTIONS: { id: AiPersona; label: string; desc: string }[] = [
  { id: 'researcher', label: '研究者', desc: '再現性・効果量・前提を重視' },
  { id: 'ux', label: 'UXリサーチャー', desc: '摩擦・離脱・デライトと次の検証' },
  { id: 'marketer', label: 'マーケター', desc: '感情反応の根拠と施策判断' },
];

const CONFIDENCE_CFG = {
  high: { label: '確度: 高', color: 'oklch(0.70 0.16 160)', bg: 'oklch(0.70 0.16 160 / 0.12)' },
  medium: { label: '確度: 中', color: 'oklch(0.80 0.16 75)', bg: 'oklch(0.80 0.16 75 / 0.12)' },
  low: { label: '確度: 低', color: 'oklch(0.72 0.10 255)', bg: 'oklch(0.72 0.10 255 / 0.12)' },
} as const;

export default function AiInsightSection({ data }: Props) {
  const [persona, setPersona] = useState<AiPersona>('researcher');
  const [consented, setConsented] = useState<boolean>(() => hasAiConsent());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const payload = buildAiPayload(data, { persona, lang: 'ja' });
      const res = await fetch('/api/ai-insight', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? `生成に失敗しました（${res.status}）。`);
        return;
      }
      setResult(json as ApiResponse);
    } catch {
      setError('通信に失敗しました。接続を確認して再試行してください。');
    } finally {
      setLoading(false);
    }
  }

  function agreeAndGenerate() {
    setAiConsent();
    setConsented(true);
    void generate();
  }

  function copyResult() {
    if (!result) return;
    const ins = result.insight;
    const lines: string[] = [];
    if (ins.summary) lines.push(`【要約】\n${ins.summary}\n`);
    (ins.findings ?? []).forEach((f, i) => {
      lines.push(`【所見${i + 1}】${f.title}\n${f.detail}`);
      if (f.caveats?.length) lines.push(`注意: ${f.caveats.join(' / ')}`);
      lines.push('');
    });
    if (ins.suggestions?.length) lines.push(`【次のアクション】\n- ${ins.suggestions.join('\n- ')}\n`);
    if (ins.limitations?.length) lines.push(`【限界】\n- ${ins.limitations.join('\n- ')}`);
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const cardStyle = {
    background: 'oklch(0.22 0.04 255)',
    border: '1px solid oklch(0.30 0.04 255)',
    borderRadius: '14px',
    padding: '1.25rem 1.5rem',
  } as const;

  return (
    <div className="space-y-5">
      {/* セクション見出し */}
      <div>
        <div className="section-label" style={{ color: 'oklch(0.78 0.18 300)' }}>AI INSIGHT · BETA</div>
        <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: 'oklch(0.90 0.005 250)', marginTop: 2 }}>
          AIインサイト
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.82rem', color: 'oklch(0.66 0.015 255)', lineHeight: 1.7, marginTop: 6 }}>
          このセッションの集計指標をAI（Claude）が解釈し、所見・示唆・注意点を生成します。
          送信されるのは<strong style={{ color: 'oklch(0.80 0.008 250)' }}>集計済みの統計指標のみ</strong>で、映像・顔座標・個々のフレームは送信しません。
        </p>
      </div>

      {/* コントロール: ペルソナ選択 + 生成ボタン */}
      <div style={cardStyle}>
        <CardHeader
          label="GENERATE"
          title="解析の生成"
          info="読み手（ペルソナ）を選んで「生成」を押すと、集計指標をAIに送って所見を作成します。コストと同意のため自動実行はしません。"
        />

        <div className="mb-4">
          <div className="section-label mb-2">読み手（フレーミング）</div>
          <div className="flex flex-wrap gap-2">
            {PERSONA_OPTIONS.map((p) => {
              const on = persona === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPersona(p.id)}
                  title={p.desc}
                  className="px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: on ? 'oklch(0.30 0.10 300)' : 'oklch(0.26 0.03 255)',
                    border: `1px solid ${on ? 'oklch(0.55 0.18 300)' : 'oklch(0.33 0.04 255)'}`,
                    color: on ? 'oklch(0.86 0.14 300)' : 'oklch(0.70 0.015 255)',
                    fontFamily: 'Noto Sans JP, sans-serif',
                    fontWeight: on ? 700 : 500,
                    fontSize: '0.8rem',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {!consented ? (
          /* 同意ゲート（初回のみ） */
          <div
            style={{
              background: 'oklch(0.20 0.05 300 / 0.5)',
              border: '1px solid oklch(0.45 0.14 300)',
              borderRadius: '10px',
              padding: '1rem 1.1rem',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} style={{ color: 'oklch(0.80 0.16 300)' }} />
              <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.86rem', color: 'oklch(0.86 0.10 300)' }}>
                AI機能の利用に同意が必要です
              </span>
            </div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.72 0.015 255)', lineHeight: 1.75, marginBottom: '0.85rem' }}>
              本機能は通常のKSDV（無送信）と異なり、<strong style={{ color: 'oklch(0.84 0.008 250)' }}>集計指標を外部AIサービス（Anthropic Claude）へ送信</strong>します。
              映像・顔座標・個々のフレーム・被験者メタデータは送信しません。
              詳細は{' '}
              <a href="KSDV_AI-terms.html" target="_blank" rel="noopener noreferrer" style={{ color: 'oklch(0.82 0.14 300)', textDecoration: 'underline' }}>
                AIインサイト機能 利用規約（追補）
              </a>{' '}
              をご確認ください。
            </p>
            <button
              onClick={agreeAndGenerate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hbg"
              style={{
                background: 'oklch(0.45 0.16 300)',
                color: 'oklch(0.98 0.01 300)',
                fontFamily: 'Noto Sans JP, sans-serif',
                fontWeight: 700,
                fontSize: '0.84rem',
                ['--hbg']: 'oklch(0.45 0.16 300)',
                ['--hbg-h']: 'oklch(0.52 0.18 300)',
              } as React.CSSProperties}
            >
              <Sparkles size={15} />
              同意して生成する
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => void generate()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hbg"
              style={{
                background: loading ? 'oklch(0.30 0.06 300)' : 'oklch(0.45 0.16 300)',
                color: 'oklch(0.98 0.01 300)',
                fontFamily: 'Noto Sans JP, sans-serif',
                fontWeight: 700,
                fontSize: '0.84rem',
                opacity: loading ? 0.8 : 1,
                cursor: loading ? 'default' : 'pointer',
                ['--hbg']: loading ? 'oklch(0.30 0.06 300)' : 'oklch(0.45 0.16 300)',
                ['--hbg-h']: 'oklch(0.52 0.18 300)',
              } as React.CSSProperties}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : result ? <RotateCcw size={15} /> : <Sparkles size={15} />}
              {loading ? '生成中…' : result ? '再生成' : '生成する'}
            </button>
            {result && !loading && (
              <button
                onClick={copyResult}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg hbg"
                style={{
                  background: 'oklch(0.26 0.03 255)',
                  border: '1px solid oklch(0.33 0.04 255)',
                  color: 'oklch(0.74 0.015 255)',
                  fontFamily: 'Noto Sans JP, sans-serif',
                  fontSize: '0.78rem',
                  ['--hbg']: 'oklch(0.26 0.03 255)',
                  ['--hbg-h']: 'oklch(0.30 0.04 255)',
                } as React.CSSProperties}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'コピーしました' : '結果をコピー'}
              </button>
            )}
          </div>
        )}

        {error && (
          <div
            className="flex items-start gap-2 mt-3"
            style={{ background: 'oklch(0.30 0.12 25 / 0.2)', border: '1px solid oklch(0.55 0.18 25 / 0.5)', borderRadius: '8px', padding: '0.7rem 0.9rem' }}
          >
            <AlertTriangle size={15} style={{ color: 'oklch(0.72 0.18 25)', marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.8rem', color: 'oklch(0.82 0.10 25)' }}>{error}</span>
          </div>
        )}
      </div>

      {/* 結果表示 */}
      {result && (
        <div className="space-y-4">
          {/* メタ情報 */}
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.58 0.015 255)' }}>
            MODEL: {result.model} ／ {new Date(result.generated_at).toLocaleString('ja-JP')}
          </div>

          {/* 要約 */}
          {result.insight.summary && (
            <div style={cardStyle}>
              <CardHeader label="SUMMARY" title="要約" labelColor="oklch(0.78 0.18 300)" />
              <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.9rem', color: 'oklch(0.84 0.008 250)', lineHeight: 1.85 }}>
                {result.insight.summary}
              </p>
            </div>
          )}

          {/* 所見カード */}
          {(result.insight.findings ?? []).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.insight.findings!.map((f, i) => {
                const conf = CONFIDENCE_CFG[f.confidence ?? 'medium'];
                return (
                  <div key={i} style={{ ...cardStyle, padding: '1rem 1.15rem', borderLeft: `3px solid ${conf.color}` }}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.92rem', color: 'oklch(0.88 0.005 250)' }}>
                        {f.title}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded whitespace-nowrap"
                        style={{ background: conf.bg, color: conf.color, fontFamily: 'Roboto Mono, monospace', fontSize: '0.58rem', fontWeight: 700 }}
                      >
                        {conf.label}
                      </span>
                    </div>
                    <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.82rem', color: 'oklch(0.78 0.01 255)', lineHeight: 1.8 }}>
                      {f.detail}
                    </p>
                    {f.caveats?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {f.caveats.map((c, j) => (
                          <span
                            key={j}
                            style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', color: 'oklch(0.70 0.12 70)', background: 'oklch(0.70 0.12 70 / 0.1)', borderRadius: '5px', padding: '2px 7px' }}
                          >
                            ⚠ {c}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* 次のアクション */}
          {(result.insight.suggestions ?? []).length > 0 && (
            <div style={cardStyle}>
              <CardHeader label="NEXT STEPS" title="次に取りうるアクション（提案）" labelColor="oklch(0.74 0.16 160)" />
              <ul className="space-y-1.5" style={{ listStyle: 'none', padding: 0 }}>
                {result.insight.suggestions!.map((s, i) => (
                  <li key={i} className="flex items-start gap-2" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.84rem', color: 'oklch(0.80 0.01 255)', lineHeight: 1.75 }}>
                    <span style={{ color: 'oklch(0.74 0.16 160)', marginTop: 1 }}>▸</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 限界・注意 */}
          {(result.insight.limitations ?? []).length > 0 && (
            <div style={{ ...cardStyle, background: 'oklch(0.20 0.03 255)', borderColor: 'oklch(0.30 0.06 70 / 0.5)' }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} style={{ color: 'oklch(0.74 0.14 70)' }} />
                <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'oklch(0.78 0.12 70)' }}>
                  この解析の限界
                </span>
              </div>
              <ul className="space-y-1" style={{ listStyle: 'none', padding: 0 }}>
                {result.insight.limitations!.map((l, i) => (
                  <li key={i} style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.76rem', color: 'oklch(0.68 0.02 255)', lineHeight: 1.7 }}>
                    ・{l}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.7rem', color: 'oklch(0.56 0.015 255)', lineHeight: 1.7 }}>
            ※ 生成結果は1セッションの記述的観察に基づく参考情報です。因果やKPIを保証するものではなく、フレーム単位の指標は自己相関により実効サンプルが小さくなります。重要な判断は原データと併せて検証してください。
          </p>
        </div>
      )}
    </div>
  );
}
