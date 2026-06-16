/*
 * DESIGN: Neuro-Signal Interface
 * Locked Biz-tier AI insights section
 */

import { Bot, KeyRound, Lock, Sparkles } from 'lucide-react';
import CardHeader from '@/components/ui/CardHeader';

const cardStyle = {
  background: 'oklch(0.22 0.04 255)',
  border: '1px solid oklch(0.32 0.05 255)',
  borderRadius: '10px',
  padding: '1.25rem',
};

const skeletonLine = (width: string) => (
  <div
    className="rounded-full"
    style={{
      width,
      height: '10px',
      background: 'linear-gradient(90deg, oklch(0.30 0.04 255), oklch(0.36 0.05 255), oklch(0.30 0.04 255))',
    }}
  />
);

export default function AIInsightsSection() {
  return (
    <div className="space-y-6">
      <div>
        <div className="section-label mb-1">AI INSIGHTS</div>
        <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.88 0.005 250)' }}>
          AIインサイト
        </h2>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.68 0.015 255)', marginTop: '0.25rem' }}>
          Gemini APIによる感情ログの自動要約・改善仮説・注目区間抽出を予定しています。
        </p>
      </div>

      <div style={cardStyle}>
        <CardHeader
          label="GEMINI INSIGHT ENGINE"
          title="AI解析インサイト"
          tier="biz"
          info="将来のBizティア機能として、Gemini APIを使った解析コメント、改善仮説、注目シーン抽出を提供予定です。"
        />

        <div className="flex flex-col items-center justify-center text-center py-10">
          <div
            className="flex items-center justify-center rounded-full mb-5"
            style={{
              width: '72px',
              height: '72px',
              background: 'oklch(0.28 0.08 60)',
              border: '1px solid oklch(0.58 0.16 60)',
              boxShadow: '0 0 28px oklch(0.58 0.16 60 / 0.18)',
            }}
          >
            <Lock size={30} style={{ color: 'oklch(0.82 0.17 60)' }} />
          </div>

          <h3 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.15rem', color: 'oklch(0.90 0.005 250)', marginBottom: '0.5rem' }}>
            この機能は現在ロックされています
          </h3>
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.68 0.015 255)', lineHeight: 1.8, maxWidth: '560px' }}>
            AIインサイトはBizティア向けの将来機能です。現段階では解析は実行できませんが、今後Gemini APIと連携してセッション全体の要約や改善ポイントを自動生成する予定です。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Sparkles, label: 'セッション要約', lines: ['86%', '64%', '72%'] },
            { icon: Bot, label: '改善仮説', lines: ['74%', '92%', '58%'] },
            { icon: KeyRound, label: 'Gemini API連携', lines: ['68%', '80%', '52%'] },
          ].map(({ icon: Icon, label, lines }) => (
            <div
              key={label}
              className="rounded-lg p-4"
              style={{ background: 'oklch(0.18 0.04 255)', border: '1px solid oklch(0.28 0.04 255)', opacity: 0.72 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Icon size={15} style={{ color: 'oklch(0.78 0.18 60)' }} />
                <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'oklch(0.78 0.18 60)' }}>
                  {label}
                </span>
              </div>
              <div className="space-y-2.5">
                {lines.map(width => (
                  <div key={width}>{skeletonLine(width)}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
