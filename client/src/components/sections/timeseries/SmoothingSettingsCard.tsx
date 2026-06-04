/**
 * SmoothingSettingsCard
 * 時系列スムージング（平滑化）設定UI
 */

import { Activity } from 'lucide-react';
import type { SmoothingMethod } from '@/lib/smoothingUtils';
import CollapsibleCard from '@/components/ui/CollapsibleCard';
import SettingBox from '@/components/ui/SettingBox';
import SettingSubLabel from '@/components/ui/SettingSubLabel';

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
        <SettingSubLabel>SMOOTHING METHOD</SettingSubLabel>
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
        <SettingBox>
          <SettingSubLabel
            color="oklch(0.68 0.18 140)"
            action={
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', fontWeight: 700, color: 'oklch(0.88 0.005 250)' }}>
                {smoothingWindow} フレーム
                <span style={{ fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', marginLeft: '6px' }}>
                  (約 {(smoothingWindow / fpsAvg).toFixed(1)}秒)
                </span>
              </span>
            }
          >
            WINDOW SIZE
          </SettingSubLabel>
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
        </SettingBox>
      )}

      {/* EMA: 平滑化強度スライダー */}
      {smoothingMethod === 'ema' && (() => {
        // EMA の内部係数 α（0.05〜0.90）は「小さいほど平滑が強い」ため直感と逆。
        // UI では「平滑化強度 0〜100%」に反転して表示する（右ほど強い）。
        // 内部の α と smoothEMA の式は変更しないため、計算結果の互換性は保たれる。
        const A_MIN = 0.05;
        const A_MAX = 0.90;
        // 強度% → α（強度が高いほど α は小さい＝平滑が強い）
        const alphaFromStrength = (s: number) => A_MAX - (s / 100) * (A_MAX - A_MIN);
        // α → 強度%（表示・スライダー value 用）
        const strengthFromAlpha = (a: number) => Math.round((A_MAX - a) / (A_MAX - A_MIN) * 100);
        const strength = strengthFromAlpha(smoothingAlpha);
        return (
        <SettingBox>
          <SettingSubLabel
            color="oklch(0.68 0.18 140)"
            action={
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', fontWeight: 700, color: 'oklch(0.88 0.005 250)' }}>
                平滑化強度 {strength}%
                <span style={{ fontSize: '0.65rem', color: 'oklch(0.68 0.015 255)', marginLeft: '6px' }}>
                  {strength >= 70 ? '（強）' : strength >= 40 ? '（中程度）' : '（弱）'}
                </span>
              </span>
            }
          >
            SMOOTHING STRENGTH（平滑化強度）
          </SettingSubLabel>
          <input
            type="range"
            min={0} max={100} step={5}
            value={strength}
            onChange={e => setSmoothingAlpha(alphaFromStrength(Number(e.target.value)))}
            className="w-full"
            style={{ accentColor: 'oklch(0.68 0.18 140)' }}
          />
          <div className="flex justify-between mt-1">
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.60 0.015 255)' }}>0% (弱)</span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.60 0.015 255)' }}>50%</span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.60 0.015 255)' }}>100% (強)</span>
          </div>
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.66 0.015 255)', marginTop: '8px' }}>
            強度が高いほど平滑化が強くなります。EMAは時系列の「流れ」を重視した平滑化です。
          </p>
        </SettingBox>
        );
      })()}
    </CollapsibleCard>
  );
}
