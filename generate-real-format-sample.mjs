/**
 * 実ファイル形式に完全準拠した比較用サンプルCSV生成スクリプト
 *
 * 元ファイル: 2025-12-17-16-14-31-000-00.csv
 *   - 感情スケール: 0〜12程度（%）、neutral 75〜99.6%
 *   - valence: ほぼ 0.00（無感情）
 *   - engagement: 激しいスパイク型（0.33〜94%）
 *   - fear/anger/surprise が主役
 *
 * 比較用ファイル: 2025-12-17-17-30-00-000-00.csv
 *   - 同じ日の90分後セッション（全54列同一構造）
 *   - joy/sentimentality が主役
 *   - valence: ポジティブ（10〜50%）
 *   - engagement: 緩やかな上昇型（more sustained）
 *   - 認知負荷低め: confusion/fear 少ない
 */

import { writeFileSync } from 'fs';

// ---- 乱数（シード付き LCG） ----
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function gauss(rng, mu, sigma) {
  const u1 = rng() + 1e-12, u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// AR(1) 更新: 前フレームの値を α で引き継ぎ、ノイズを加える
function ar1Update(prev, mu, sigma, alpha, rng, lo = 0, hi = 100) {
  const v = alpha * prev + (1 - alpha) * mu + gauss(rng, 0, sigma);
  return clamp(v, lo, hi);
}

// ---- ヘッダー（元ファイルと完全一致） ----
const HEADER = [
  'time stamp', 'face id',
  'anger', 'contempt', 'disgust', 'fear', 'joy', 'sadness', 'surprise', 'sentimentality', 'confusion', 'neutral',
  'engagement', 'valence', 'attention',
  'inner brow raise', 'brow raise', 'brow furrow', 'eye widen', 'cheek raise',
  'lid tighten', 'nose wrinkle', 'upper lip raise', 'dimpler', 'lip corner depressor',
  'chin raise', 'lip pucker', 'lip stretch', 'lip press', 'mouth open', 'jaw drop',
  'lip suck', 'eye closure', 'smile', 'smirk', 'blink', 'blink rate',
  'pitch', 'yaw', 'roll',
  'brightness', 'interocular distance',
  'topleft_x', 'topleft_y', 'bottomright_x', 'bottomright_y',
  'outer_right_eye_X', 'outer_right_eye_Y', 'outer_left_eye_X', 'outer_left_eye_Y',
  'nose_top_X', 'nose_top_Y', 'chin_top_X', 'chin_top_Y',
];

function fmt(v, d = 2) {
  if (v === '' || v === null || v === undefined) return '';
  return Number(v).toFixed(d);
}

// ---- メイン生成関数 ----
function generateComparisonCSV() {
  const rng = makeRng(9999);
  const DURATION = 270;   // 270秒（4.5分）元ファイルの278秒に近い
  const FPS = 12.5;       // 元ファイルの約12fps
  const TOTAL_FRAMES = Math.round(DURATION * FPS);

  // 前フレームの状態（AR(1)用）
  let state = {
    anger: 0.15, contempt: 0.18, disgust: 0.03, fear: 0.15,
    joy: 0.5, sadness: 0.12, surprise: 0.08, sentimentality: 0.08, confusion: 0.08,
    neutral: 98.5,
    engagement: 0.33, valence: 5.0, attention: 92.0,
    // Action units
    innerBrow: 0.3, browRaise: 2.0, browFurrow: 0.1, eyeWiden: 2.0,
    cheekRaise: 0.5, lidTighten: 0.5, noseWrinkle: 0.02, upperLipRaise: 0.05,
    dimpler: 0.3, lipCorner: 0.05, chinRaise: 0.0, lipPucker: 0.2,
    lipStretch: 0.3, lipPress: 0.0, mouthOpen: 2.0, jawDrop: 3.0,
    lipSuck: 0.0, eyeClosure: 0.01, smile: 0.5, smirk: 0.0,
    // Head pose
    pitch: 5.0, yaw: -3.0, roll: -2.0,
    // Face coords (stable around a face position)
    faceX: 255, faceY: 115,
  };

  // 「喜び・エンゲージメント高」スパイクのスケジュール
  // 元ファイルと同様に定期的なピークを作る
  const joySpikes = [
    { center: 15, width: 4, joy: 5.0, eng: 70, val: 45 },
    { center: 40, width: 3, joy: 3.5, eng: 55, val: 35 },
    { center: 65, width: 5, joy: 6.2, eng: 82, val: 55 },
    { center: 90, width: 4, joy: 4.8, eng: 65, val: 40 },
    { center: 120, width: 6, joy: 7.5, eng: 88, val: 62 },
    { center: 145, width: 3, joy: 4.0, eng: 60, val: 38 },
    { center: 170, width: 5, joy: 5.5, eng: 75, val: 50 },
    { center: 195, width: 4, joy: 3.8, eng: 58, val: 32 },
    { center: 220, width: 6, joy: 6.8, eng: 79, val: 58 },
    { center: 248, width: 4, joy: 5.2, eng: 68, val: 44 },
  ];

  // sentimentality スパイク（元ファイルにはなかった要素）
  const sentSpikes = [
    { center: 30, width: 3, sent: 3.0, eng: 40, val: 28 },
    { center: 80, width: 4, sent: 4.5, eng: 55, val: 35 },
    { center: 135, width: 3, sent: 3.5, eng: 48, val: 30 },
    { center: 200, width: 4, sent: 4.0, eng: 52, val: 32 },
    { center: 260, width: 3, sent: 3.2, eng: 45, val: 28 },
  ];

  function getSpikeEffect(t, spikes, key) {
    let maxEffect = 0;
    for (const spike of spikes) {
      const d = Math.abs(t - spike.center);
      if (d < spike.width * 2.5) {
        const effect = Math.exp(-d * d / (2 * spike.width * spike.width));
        if (effect > maxEffect) maxEffect = effect * (spike[key] || 0);
      }
    }
    return maxEffect;
  }

  const lines = [HEADER.join(',')];
  let t = 0.075;

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const pct = i / TOTAL_FRAMES; // 0〜1 セッション進捗

    // ---- スパイク効果 ----
    const joyEffect = getSpikeEffect(t, joySpikes, 'joy');
    const engJoy    = getSpikeEffect(t, joySpikes, 'eng');
    const valJoy    = getSpikeEffect(t, joySpikes, 'val');
    const sentEffect = getSpikeEffect(t, sentSpikes, 'sent');
    const engSent   = getSpikeEffect(t, sentSpikes, 'eng');
    const valSent   = getSpikeEffect(t, sentSpikes, 'val');

    const spikeActive = joyEffect > 0.15 || sentEffect > 0.15;
    const totalEngSpike = Math.max(engJoy, engSent);
    const totalValSpike = Math.max(valJoy, valSent);

    // ---- ベースライン目標値（時間変化: 後半はやや疲労） ----
    const fatigue = pct > 0.7 ? (pct - 0.7) * 1.5 : 0;
    const baseMood = 1 - fatigue * 0.3;

    // ---- 感情 AR(1) 更新 ----
    const joyTarget  = spikeActive ? joyEffect * 1.2 : 0.4 * baseMood;
    const sentTarget = spikeActive ? sentEffect : 0.25 * baseMood;
    const fearTarget = spikeActive ? joyEffect * 0.15 : 0.12; // 喜びの時は少し恐れも（驚き的な）
    const surpriseTarget = spikeActive ? joyEffect * 0.5 : 0.07;

    state.joy          = ar1Update(state.joy,          joyTarget,   0.06, 0.88, rng, 0.01, 10);
    state.sentimentality = ar1Update(state.sentimentality, sentTarget, 0.04, 0.88, rng, 0.00, 8);
    state.surprise     = ar1Update(state.surprise,     surpriseTarget, 0.08, 0.85, rng, 0.01, 12);
    state.fear         = ar1Update(state.fear,         fearTarget,  0.05, 0.90, rng, 0.01, 5);
    state.anger        = ar1Update(state.anger,        0.15,        0.04, 0.92, rng, 0.01, 3);
    state.contempt     = ar1Update(state.contempt,     0.18,        0.01, 0.96, rng, 0.10, 0.25);
    state.disgust      = ar1Update(state.disgust,      0.03,        0.02, 0.94, rng, 0.01, 0.8);
    state.sadness      = ar1Update(state.sadness,      0.10,        0.02, 0.94, rng, 0.01, 1.0);
    state.confusion    = ar1Update(state.confusion,    0.06,        0.03, 0.93, rng, 0.01, 1.5);

    // neutral は残り（100 - Σ感情）
    const nonNeutralSum = state.joy + state.sentimentality + state.surprise + state.fear
      + state.anger + state.contempt + state.disgust + state.sadness + state.confusion;
    state.neutral = clamp(100 - nonNeutralSum, 70, 99.9);

    // ---- 特殊指標 ----
    const engTarget = spikeActive ? totalEngSpike : 0.33 + 5 * baseMood * (rng() < 0.05 ? 3 : 1);
    state.engagement = ar1Update(state.engagement, engTarget, 1.5, 0.85, rng, 0.33, 96);
    state.valence    = ar1Update(state.valence, spikeActive ? totalValSpike : 3.0 * baseMood, 1.2, 0.87, rng, 0.0, 80);
    state.attention  = ar1Update(state.attention, 92 - fatigue * 10, 1.5, 0.92, rng, 50, 99);

    // ---- アクションユニット（感情に相関） ----
    const joyRatio = state.joy / 7; // 0〜1
    state.smile        = ar1Update(state.smile,        joyRatio * 8,  0.4, 0.88, rng, 0, 50);
    state.cheekRaise   = ar1Update(state.cheekRaise,   joyRatio * 5,  0.3, 0.88, rng, 0, 30);
    state.dimpler      = ar1Update(state.dimpler,      joyRatio * 4,  0.3, 0.88, rng, 0, 20);
    state.mouthOpen    = ar1Update(state.mouthOpen,    state.surprise * 12, 2, 0.85, rng, 0, 100);
    state.jawDrop      = ar1Update(state.jawDrop,      state.surprise * 10, 2, 0.85, rng, 0, 100);
    state.eyeWiden     = ar1Update(state.eyeWiden,     state.surprise * 3,  1, 0.87, rng, 0, 30);
    state.browRaise    = ar1Update(state.browRaise,    state.surprise * 4 + state.joy * 0.5, 1, 0.87, rng, 0, 30);
    state.browFurrow   = ar1Update(state.browFurrow,   state.anger * 0.5 + state.fear * 0.3, 0.03, 0.94, rng, 0, 5);
    state.innerBrow    = ar1Update(state.innerBrow,    state.fear * 0.8 + state.sadness * 0.5, 0.1, 0.92, rng, 0, 5);
    state.lidTighten   = ar1Update(state.lidTighten,   state.anger * 0.5, 0.5, 0.90, rng, 0, 20);
    state.noseWrinkle  = ar1Update(state.noseWrinkle,  state.disgust * 0.1, 0.02, 0.95, rng, 0, 2);
    state.upperLipRaise= ar1Update(state.upperLipRaise, state.disgust * 0.1 + state.joy * 0.1, 0.02, 0.95, rng, 0, 2);
    state.lipCorner    = ar1Update(state.lipCorner,    state.sadness * 0.2, 0.02, 0.95, rng, 0, 3);
    state.lipPucker    = ar1Update(state.lipPucker,    1.5, 0.2, 0.94, rng, 0, 10);
    state.lipStretch   = ar1Update(state.lipStretch,   joyRatio * 2, 0.2, 0.93, rng, 0, 15);
    state.eyeClosure   = ar1Update(state.eyeClosure,   0.1, 0.03, 0.97, rng, 0, 5);
    state.smirk        = ar1Update(state.smirk,        0.01, 0.01, 0.98, rng, 0, 2);

    // 静的に近いAU
    const chinRaise    = clamp(gauss(rng, 0.02, 0.01), 0, 0.5);
    const lipPress     = clamp(gauss(rng, 0.0, 0.01), 0, 0.5);
    const lipSuck      = clamp(gauss(rng, 0.0, 0.01), 0, 0.5);

    // blink: 約5%のフレームで瞬き(=1.0)、blink rateは12
    const isBlink = rng() < 0.05;
    const blink     = isBlink ? 1.0 : 0.0;
    const blinkRate = isBlink ? 12.00 : '';   // 元ファイルに倣い空欄

    // ---- 頭部姿勢 ----
    state.pitch = ar1Update(state.pitch, 5.0, 0.8, 0.96, rng, -15, 25);
    state.yaw   = ar1Update(state.yaw,  -3.0, 1.0, 0.95, rng, -20, 15);
    state.roll  = ar1Update(state.roll, -2.0, 0.5, 0.97, rng, -10, 10);

    // ---- 顔座標（安定した位置で微小変動） ----
    state.faceX = ar1Update(state.faceX, 255, 1.5, 0.97, rng, 230, 280);
    state.faceY = ar1Update(state.faceY, 135, 1.2, 0.97, rng, 100, 175);
    const faceW = clamp(gauss(rng, 155, 3), 145, 165);
    const faceH = faceW * 1.08;
    const tlX = state.faceX;
    const tlY = state.faceY;
    const brX = tlX + faceW;
    const brY = tlY + faceH;
    const iod = clamp(gauss(rng, 100, 3), 88, 115);

    // 目・鼻・顎の相対座標
    const reX = tlX + faceW * 0.28, reY = tlY + faceH * 0.36;
    const leX = tlX + faceW * 0.72, leY = reY;
    const nX  = tlX + faceW * 0.50, nY  = tlY + faceH * 0.50;
    const cX  = tlX + faceW * 0.50, cY  = tlY + faceH * 0.75;

    const brightness = clamp(gauss(rng, 89.5, 0.5), 87, 92);

    // ---- 行を組み立て ----
    const row = [
      fmt(t, 3),          // time stamp
      '0',                // face id
      fmt(state.anger, 2), fmt(state.contempt, 2), fmt(state.disgust, 2), fmt(state.fear, 2),
      fmt(state.joy, 2),  fmt(state.sadness, 2),   fmt(state.surprise, 2), fmt(state.sentimentality, 2),
      fmt(state.confusion, 2), fmt(state.neutral, 2),
      fmt(state.engagement, 2), fmt(state.valence, 2), fmt(state.attention, 2),
      // AUs
      fmt(state.innerBrow, 2), fmt(state.browRaise, 2), fmt(state.browFurrow, 2),
      fmt(state.eyeWiden, 2),  fmt(state.cheekRaise, 2), fmt(state.lidTighten, 2),
      fmt(state.noseWrinkle, 2), fmt(state.upperLipRaise, 2), fmt(state.dimpler, 2),
      fmt(state.lipCorner, 2), fmt(chinRaise, 2), fmt(state.lipPucker, 2),
      fmt(state.lipStretch, 2), fmt(lipPress, 2), fmt(state.mouthOpen, 2), fmt(state.jawDrop, 2),
      fmt(lipSuck, 2), fmt(state.eyeClosure, 2), fmt(state.smile, 2), fmt(state.smirk, 2),
      fmt(blink, 2),
      blinkRate !== '' ? fmt(blinkRate, 2) : '',
      // Head pose
      fmt(state.pitch, 2), fmt(state.yaw, 2), fmt(state.roll, 2),
      // Face metadata
      fmt(brightness, 2), fmt(iod, 2),
      fmt(tlX, 2), fmt(tlY, 2), fmt(brX, 2), fmt(brY, 2),
      fmt(reX, 2), fmt(reY, 2), fmt(leX, 2), fmt(leY, 2),
      fmt(nX,  2), fmt(nY,  2), fmt(cX,  2), fmt(cY,  2),
    ];

    lines.push(row.join(','));

    // 次フレームの時刻（元ファイルと同様の約0.075-0.08秒間隔、ときどき小さなギャップ）
    t += rng() < 0.02 ? 0.15 + rng() * 0.1 : 0.075 + rng() * 0.01;
  }

  return lines.join('\n');
}

// ---- 出力 ----
const csv = generateComparisonCSV();
const outDir  = 'C:/Users/yutak/OneDrive/Desktop';
const outPath = `${outDir}/2025-12-17-17-30-00-000-00.csv`;
writeFileSync(outPath, csv, 'utf-8');

const lines = csv.split('\n');
const lastLine = lines[lines.length - 1].split(',');
const lastTime = parseFloat(lastLine[0]);

console.log(`✅ 生成完了: ${outPath}`);
console.log(`   行数: ${lines.length - 1} (ヘッダー除く)`);
console.log(`   列数: ${lines[0].split(',').length}`);
console.log(`   時間: 0.075s → ${lastTime.toFixed(3)}s (${(lastTime / 60).toFixed(1)}分)`);
console.log('');
console.log('比較の特徴:');
console.log('  元ファイル(16:14): fear/anger/surprise 主役、valence≈0、スパイク激しい');
console.log('  比較ファイル(17:30): joy/sentimentality 主役、valenceポジティブ(+)、engagement穏やか');
