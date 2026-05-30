/**
 * SmoothingSettingsCard
 * 時系列スムージング（平滑化）設定UI
 */

import { Activity } from 'lucide-react';
import type { SmoothingMethod } from '@/lib/smoothingUtils';
import CollapsibleCard from '@/components/ui/CollapsibleCard';

interface Props {
  smoothingMethod: SmoothingMethod;
  setSmoothingMethod: (m: SmoothingMethod) => void;
  smoothingWindow: number;
  setSmoothingWindow: (v: number) => void;
  smoothingAlpha: number;
  setSmoothingAlpha: (v: number) => void;
  /** fps: SMA ウィンドウサイズの「秒換算」表示に使用 */
  fpsAvg: number;
}

export default function SmoothingSettingsCard({
  smoothingMethod, setSmoothingMethod,
  smoothingWindow, setSmoothingWindow,
  smoothingAlpha, setSmoothingAlpha,
  fpsAvg,
}: Props) {
  return (
    <CollapsibleCard
      label="SMOOTHING SETTINGS"
      labelColor="oklch(0.68 0.18 140)"
      title="時系列スムージング（平滑化）"
      info="フレーム間のノイズを低減してトレンドを見やすくします。元データは保持されます。"
      borderLeftColor="oklch(0.68 0.18 140)"
      storageKey="ksdv.collapse.smoothing"
      badge={smoothingMethod !== 'none' ? (
        <span style={{
          fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem',
          background: 'oklch(0.68 0.18 140 / 0.15)', border: '1px solid oklch(0.68 0.18 140 / 0.4)',
          color: 'oklch(0.68 0.18 140)', padding: '3px 10px', borderRadius: '4px',
        }}>
          ⚡ 平滑化適用中
        </span>
      ) : null}
    >
      {/* 手法選択ボタン */}
      <div className="mb-4">
        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', marginBottom: '8px', letterSpacing: '0.06em' }}>
          SMOOTHING METHOD
        </div>
        <div className="flex gap-2 flex-wrap">
          {([
            { id: 'none', label: 'なし',              desc: '元データをそのまま表示' },
            { id: 'sma',  label: '移動平均 (SMA)',     desc: '前後N点の単純平均' },
            { id: 'ema',  label: '指数移動平均 (EMA)', desc: '最近の値を重視した平滑化' },
          ] as const).map(opt => (
            <button
              key={opt.id}
              onClick={() => setSmoothingMethod(opt.id)}
              className="px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-1.5"
              title={opt.desc}
              style={{
                fontFamily: 'Noto Sans JP, sans-serif',
                fontWeight: smoothingMethod === opt.id ? 700 : 400,
                background: smoothingMethod === opt.id ? 'oklch(0.68 0.18 140 / 0.18)' : 'oklch(0.22 0.04 255)',
                color: smoothingMethod === opt.id ? 'oklch(0.78 0.20 140)' : 'oklch(0.68 0.015 255)',
                border: `1px solid ${smoothingMethod === opt.id ? 'oklch(0.68 0.18 140 / 0.5)' : 'oklch(0.28 0.04 255)'}`,
              }}
            >
              <Activity size={12} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* SMA: ウィンドウサイズスライダー */}
      {smoothingMethod === 'sma' && (
        <div className="p-3 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.28 0.04 255)' }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.68 0.18 140)', letterSpacing: '0.06em' }}>
              WINDOW SIZE
            </span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', fontWeight: 700, color: 'oklch(0.88 0.005 250)' }}>
              {smoothingWindow} フレーム
              <span style={{ fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', marginLeft: '6px' }}>
                (約 {(smoothingWindow / fpsAvg).toFixed(1)}秒)
              </span>
            </span>
          </div>
          <input
            type="range"
            min={3} max={61} step={2}
            value={smoothingWindow}
            onChange={e => setSmoothingWindow(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: 'oklch(0.68 0.18 140)' }}
          />
          <div className="flex justify-between mt-1">
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.60 0.015 255)' }}>3 (弱)</span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.60 0.015 255)' }}>31</span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.60 0.015 255)' }}>61 (強)</span>
          </div>
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.66 0.015 255)', marginTop: '8px' }}>
            前後のフレームを平均します。値が大きいほど滑らかになりますが、ピークが低くなります。
          </p>
        </div>
      )}

      {/* EMA: alpha スライダー */}
      {smoothingMethod === 'ema' && (
        <div className="p-3 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.28 0.04 255)' }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.68 0.18 140)', letterSpacing: '0.06em' }}>
              SMOOTHING FACTOR (α)
            </span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', fontWeight: 700, color: 'oklch(0.88 0.005 250)' }}>
              α = {smoothingAlpha.toFixed(2)}
              <span style={{ fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', marginLeft: '6px' }}>
                {smoothingAlpha < 0.2 ? '（強平滑）' : smoothingAlpha < 0.5 ? '（中程度）' : '（弱平滑）'}
              </span>
            </span>
          </div>
          <input
            type="range"
            min={0.05} max={0.90} step={0.05}
            value={smoothingAlpha}
            onChange={e => setSmoothingAlpha(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: 'oklch(0.68 0.18 140)' }}
          />
          <div className="flex justify-between mt-1">
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.60 0.015 255)' }}>0.05 (強)</span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.60 0.015 255)' }}>0.45</span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.60 0.015 255)' }}>0.90 (弱)</span>
          </div>
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.66 0.015 255)', marginTop: '8px' }}>
            αが小さいほど平滑度が高くなります。EMAは時系列の「流れ」を重視した平滑化です。
          </p>
        </div>
      )}
    </CollapsibleCard>
  );
}
