/**
 * サンプルCSVファイル生成スクリプト
 * Session A: 朝セッション（高エンゲージメント・喜び優位）
 * Session B: 午後セッション（混合感情・集中度低め）
 */

import { writeFileSync } from 'fs';

// ---- 乱数ユーティリティ ----
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function gauss(rng, mu, sigma) {
  // Box-Muller
  const u1 = rng(), u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1 + 1e-12)) * Math.cos(2 * Math.PI * u2);
}

// ---- 感情・指標のカラム名 ----
const EMOTIONS = ['anger', 'contempt', 'disgust', 'fear', 'joy', 'sadness', 'surprise', 'sentimentality', 'confusion', 'neutral'];
const ACTION_UNITS = [
  'inner brow raise', 'brow raise', 'brow furrow', 'eye widen', 'cheek raise',
  'lid tighten', 'nose wrinkle', 'upper lip raise', 'dimpler', 'lip corner depressor',
  'chin raise', 'lip pucker', 'lip stretch', 'lip press', 'mouth open', 'jaw drop',
  'lip suck', 'eye closure', 'smile', 'smirk', 'blink', 'blink rate',
];

function generateCSV(config) {
  const {
    seed, rows, fps, startTimestamp,
    joyMu, engMu, valMu,
    sadMu, confMu, angerMu, surpriseMu,
    sentMu, contemptMu, disgustMu, fearMu,
  } = config;

  const rng = seededRandom(seed);
  const headers = [
    'time stamp',
    ...EMOTIONS,
    'engagement', 'valence', 'attention',
    ...ACTION_UNITS,
    'pitch', 'yaw', 'roll',
  ];

  const lines = [headers.join(',')];
  const dt = 1 / fps;

  // 感情ごとの状態（前フレーム値を持つことでスムーズな時系列を生成）
  let prev = {
    joy: joyMu, sadness: sadMu, confusion: confMu, anger: angerMu,
    surprise: surpriseMu, sentimentality: sentMu, contempt: contemptMu,
    disgust: disgustMu, fear: fearMu, neutral: 0.3,
    engagement: engMu, valence: valMu, attention: 0.7,
  };

  for (let i = 0; i < rows; i++) {
    const t = startTimestamp + i * dt;
    const pct = i / rows; // 0〜1で進捗

    // 時間変化パターン（セッション中盤に集中ピーク、終盤に疲労）
    const midBoost = Math.sin(pct * Math.PI);        // 中盤で最大
    const fatigue  = pct > 0.7 ? (pct - 0.7) * 1.5 : 0; // 終盤疲労

    // AR(1) スムージング係数 + ガウスノイズでリアルな揺らぎ
    const ar = 0.85;
    const update = (col, mu, sigma) => {
      const drift = mu + midBoost * sigma * 0.3 - fatigue * sigma * 0.5;
      const v = ar * prev[col] + (1 - ar) * drift + gauss(rng, 0, sigma * 0.15);
      return clamp(v, 0, 1);
    };

    const joy          = update('joy',          joyMu,       0.12);
    const sadness      = update('sadness',      sadMu,       0.08);
    const confusion    = update('confusion',    confMu,      0.10);
    const anger        = update('anger',        angerMu,     0.07);
    const surprise     = update('surprise',     surpriseMu,  0.09);
    const sentimentality = update('sentimentality', sentMu,  0.07);
    const contempt     = update('contempt',     contemptMu,  0.06);
    const disgust      = update('disgust',      disgustMu,   0.05);
    const fear         = update('fear',         fearMu,      0.06);

    // neutral は残りの補完
    const nonNeutralSum = joy + sadness + confusion + anger + surprise + sentimentality + contempt + disgust + fear;
    const neutral = clamp(1 - nonNeutralSum * 0.6, 0.05, 0.8);

    const engagement = clamp(ar * prev.engagement + (1 - ar) * (engMu - fatigue * 0.2) + gauss(rng, 0, 0.04), 0, 1);
    const valence    = clamp(ar * prev.valence    + (1 - ar) * valMu + gauss(rng, 0, 0.05), -1, 1);
    const attention  = clamp(ar * prev.attention  + (1 - ar) * (0.7 - fatigue * 0.15) + gauss(rng, 0, 0.04), 0, 1);

    prev = { joy, sadness, confusion, anger, surprise, sentimentality, contempt, disgust, fear, neutral, engagement, valence, attention };

    // Action Units（感情と相関したランダム値）
    const smile       = clamp(joy * 0.8 + gauss(rng, 0, 0.05), 0, 1);
    const browFurrow  = clamp((anger + confusion) * 0.5 + gauss(rng, 0, 0.04), 0, 1);
    const browRaise   = clamp(surprise * 0.7 + gauss(rng, 0, 0.04), 0, 1);
    const innerBrow   = clamp((sadness + fear) * 0.5 + gauss(rng, 0, 0.04), 0, 1);
    const eyeWiden    = clamp(surprise * 0.6 + gauss(rng, 0, 0.03), 0, 1);
    const cheekRaise  = clamp(joy * 0.6 + gauss(rng, 0, 0.03), 0, 1);
    const lidTighten  = clamp(anger * 0.5 + gauss(rng, 0, 0.03), 0, 1);
    const noseWrinkle = clamp((disgust + anger) * 0.4 + gauss(rng, 0, 0.03), 0, 1);
    const lipCorner   = clamp((sadness + contempt) * 0.4 + gauss(rng, 0, 0.03), 0, 1);
    const mouthOpen   = clamp(surprise * 0.5 + gauss(rng, 0, 0.03), 0, 1);
    const blink       = rng() < 0.05 ? 1 : 0;
    const blinkRate   = clamp(gauss(rng, 15, 3), 5, 30);
    const simpleAU    = () => clamp(gauss(rng, 0.1, 0.05), 0, 1);

    // Head pose（±の範囲で穏やかな揺らぎ）
    const pitch = clamp(gauss(rng, 5, 8), -30, 30);
    const yaw   = clamp(gauss(rng, 0, 10), -45, 45);
    const roll  = clamp(gauss(rng, 0, 5), -20, 20);

    const row = [
      t.toFixed(4),
      anger.toFixed(4), contempt.toFixed(4), disgust.toFixed(4), fear.toFixed(4),
      joy.toFixed(4), sadness.toFixed(4), surprise.toFixed(4), sentimentality.toFixed(4),
      confusion.toFixed(4), neutral.toFixed(4),
      engagement.toFixed(4), valence.toFixed(4), attention.toFixed(4),
      // Action Units
      innerBrow.toFixed(4), browRaise.toFixed(4), browFurrow.toFixed(4), eyeWiden.toFixed(4),
      cheekRaise.toFixed(4), lidTighten.toFixed(4), noseWrinkle.toFixed(4), simpleAU().toFixed(4),
      simpleAU().toFixed(4), lipCorner.toFixed(4),
      simpleAU().toFixed(4), simpleAU().toFixed(4), simpleAU().toFixed(4), simpleAU().toFixed(4),
      mouthOpen.toFixed(4), simpleAU().toFixed(4), simpleAU().toFixed(4), simpleAU().toFixed(4),
      smile.toFixed(4), simpleAU().toFixed(4), blink.toFixed(4), blinkRate.toFixed(2),
      // Head pose
      pitch.toFixed(4), yaw.toFixed(4), roll.toFixed(4),
    ];

    lines.push(row.join(','));
  }

  return lines.join('\n');
}

// ---- Session A: 朝 (10:30) — 喜び・高エンゲージメント ----
const sessionA = generateCSV({
  seed: 42,
  rows: 1800,          // 30fps × 60秒 × 1分 = 1分... 実際は rows/fps = duration
  fps: 15,             // 15fps × 120秒 = 1800行 → 2分
  startTimestamp: 1705282200.0,  // 2025-01-15 10:30:00 JST
  joyMu: 0.42,
  sadMu: 0.04,
  confMu: 0.06,
  angerMu: 0.03,
  surpriseMu: 0.08,
  sentMu: 0.12,
  contemptMu: 0.02,
  disgustMu: 0.02,
  fearMu: 0.02,
  engMu: 0.65,
  valMu: 0.50,
});

// ---- Session B: 午後 (14:45) — 混合・疲労・集中低下 ----
const sessionB = generateCSV({
  seed: 137,
  rows: 1500,          // 15fps × 100秒 ≈ 1.67分
  fps: 15,
  startTimestamp: 1705297500.0,  // 2025-01-15 14:45:00 JST
  joyMu: 0.15,
  sadMu: 0.12,
  confMu: 0.22,
  angerMu: 0.08,
  surpriseMu: 0.05,
  sentMu: 0.05,
  contemptMu: 0.07,
  disgustMu: 0.04,
  fearMu: 0.04,
  engMu: 0.38,
  valMu: -0.15,
});

const outDir = 'C:/Users/yutak/claude-work/emotion-dashboard/sample-data';
import { mkdirSync } from 'fs';
try { mkdirSync(outDir, { recursive: true }); } catch {}

const pathA = `${outDir}/session-A_2025-01-15-10-30-00.csv`;
const pathB = `${outDir}/session-B_2025-01-15-14-45-00.csv`;

writeFileSync(pathA, sessionA, 'utf-8');
writeFileSync(pathB, sessionB, 'utf-8');

console.log(`✅ Session A → ${pathA}`);
console.log(`   rows: 1800, fps: 15, duration: ~120s`);
console.log(`   特徴: 喜び優位 (joy≈0.42), 高エンゲージメント (eng≈0.65), ポジティブ valence (+0.50)`);
console.log('');
console.log(`✅ Session B → ${pathB}`);
console.log(`   rows: 1500, fps: 15, duration: ~100s`);
console.log(`   特徴: 混乱優位 (conf≈0.22), 低エンゲージメント (eng≈0.38), ネガティブ valence (-0.15)`);
