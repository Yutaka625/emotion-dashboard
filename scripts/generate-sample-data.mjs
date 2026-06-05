/**
 * KSDV 解析機能テスト用サンプル感情ログ生成スクリプト（心sensor実データ準拠版）
 *
 * 役割: トップ画面の「サンプルで試す」ボタンが読み込むCSVを生成する。
 *   実際の心sensor出力に合わせ、以下を忠実に再現する:
 *     - 54列フォーマット（face id は2列目、末尾に landmark/bbox 等）
 *     - 値スケールは 0〜100（アプリも 0〜100 前提。csvAnalyzer の /100 処理に整合）
 *     - valence は符号付き（-100〜100）
 *     - 表情・感情は「低周期でランダム」に表出（普段はニュートラル優勢、
 *       時々イベント的に短く立ち上がる）。フレーム間のばらつきも大きい
 *     - タイムスタンプは不規則・低頻度（平均 約7fps、0.06〜0.4秒のゆらぎ）
 *     - blink rate は空欄（実データに合わせる）
 *
 * 実行: node scripts/generate-sample-data.mjs   （npm run gen:samples）
 *
 * 出力: sample-data/（ソース） と client/public/samples/（配信用）の両方
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_DIR = join(ROOT, 'sample-data');
const PUB_DIR = join(ROOT, 'client', 'public', 'samples');

// ── 実データの54列ヘッダー（順序・名称を厳守） ───────────────────
const HEADER = [
  'time stamp', 'face id',
  'anger', 'contempt', 'disgust', 'fear', 'joy', 'sadness', 'surprise', 'sentimentality', 'confusion', 'neutral',
  'engagement', 'valence', 'attention',
  'inner brow raise', 'brow raise', 'brow furrow', 'eye widen', 'cheek raise', 'lid tighten', 'nose wrinkle',
  'upper lip raise', 'dimpler', 'lip corner depressor', 'chin raise', 'lip pucker', 'lip stretch', 'lip press',
  'mouth open', 'jaw drop', 'lip suck', 'eye closure', 'smile', 'smirk', 'blink', 'blink rate',
  'pitch', 'yaw', 'roll', 'brightness', 'interocular distance',
  'topleft_x', 'topleft_y', 'bottomright_x', 'bottomright_y',
  'outer_right_eye_X', 'outer_right_eye_Y', 'outer_left_eye_X', 'outer_left_eye_Y',
  'nose_top_X', 'nose_top_Y', 'chin_top_X', 'chin_top_Y',
];

const NON_NEUTRAL = ['anger', 'contempt', 'disgust', 'fear', 'joy', 'sadness', 'surprise', 'sentimentality', 'confusion'];

// 感情ごとの valence 極性（-1〜+1）。valence の符号を決める
const VALENCE_POLARITY = {
  joy: 1.0, surprise: 0.4, sentimentality: 0.3,
  anger: -0.9, sadness: -0.8, fear: -0.7, disgust: -0.8, contempt: -0.6, confusion: -0.3,
};

// ── 決定的乱数（mulberry32） ───────────────────────────────────
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const f2 = (v) => v.toFixed(2);

/**
 * イベント列を生成する（低周期・ランダムな表情表出）。
 * @param rng 乱数
 * @param duration 秒
 * @param weights 感情→出現重み（events の偏り）
 * @param meanGap イベント平均間隔（秒）。大きいほど低頻度
 * @param fixedEvents 固定イベント（変化点デモ用）。指定時はそれを使う
 */
function scheduleEvents(rng, duration, weights, meanGap, fixedEvents) {
  if (fixedEvents) return fixedEvents;
  const emos = Object.keys(weights);
  const totalW = emos.reduce((s, e) => s + weights[e], 0);
  const pick = () => {
    let r = rng() * totalW;
    for (const e of emos) { r -= weights[e]; if (r <= 0) return e; }
    return emos[0];
  };
  const events = [];
  let t = 2 + rng() * meanGap;
  while (t < duration - 1) {
    const dur = 0.8 + rng() * 2.2;          // 0.8〜3.0秒の短い表出（マクロ表情の典型）
    const intensity = 50 + rng() * 45;      // ピーク 50〜95
    events.push({ start: t, end: t + dur, emo: pick(), intensity });
    // 次の表出まで十分に間隔をあける（低周期・ランダム）
    t += dur + meanGap * (0.6 + rng() * 0.9);
  }
  return events;
}

/** ある時刻 t における、進行中イベントの寄与（emo→0..1の係数）を返す */
function eventContribution(events, t) {
  let best = null;
  for (const ev of events) {
    if (t >= ev.start && t <= ev.end) {
      // 三角波で立ち上がり/立ち下がり（急峻）
      const mid = (ev.start + ev.end) / 2;
      const half = (ev.end - ev.start) / 2;
      const ramp = 1 - Math.abs(t - mid) / half;
      const w = clamp(ramp, 0, 1);
      if (!best || w * ev.intensity > best.w * best.intensity) best = { emo: ev.emo, w, intensity: ev.intensity };
    }
  }
  return best;
}

/** 1人分のフレーム行を生成する */
function buildFaceRows(opts) {
  const { rng, timeline, faceId, weights, meanGap, engBase, calmNeutral, geometry, fixedEvents, calmNoise = 1.5 } = opts;
  const events = scheduleEvents(rng, timeline[timeline.length - 1], weights, meanGap, fixedEvents);
  const rows = [];

  // 頭部姿勢のゆっくりしたドリフト用位相
  const phP = rng() * 6.28, phY = rng() * 6.28, phR = rng() * 6.28;

  for (const t of timeline) {
    const row = {};
    row['time stamp'] = t.toFixed(3);
    row['face id'] = String(faceId);

    // 全感情を一旦低ノイズで埋める（普段はほぼ0＝ニュートラル基準）
    for (const e of NON_NEUTRAL) row[e] = clamp(rng() * 2.2, 0, 100);

    // 進行中イベントがあれば、その感情を立ち上げる
    const ev = eventContribution(events, t);
    let activeEmo = null, activeVal = 0;
    if (ev) {
      const peak = ev.intensity * ev.w;
      const jit = (rng() - 0.5) * 12;       // フレーム間の大きなばらつき
      activeVal = clamp(peak + jit, 0, 100);
      row[ev.emo] = activeVal;
      activeEmo = ev.emo;
    }

    // neutral: 表出が強いほど下がる（相補的）。普段は高め
    const maxNN = Math.max(...NON_NEUTRAL.map(e => row[e]));
    const neutralBase = calmNeutral - maxNN * 0.9 + (rng() - 0.5) * calmNoise * 2;
    row['neutral'] = clamp(neutralBase, 0, 100);

    // engagement: 表出時に上昇
    row['engagement'] = clamp(engBase + (activeEmo ? activeVal * 0.45 : 0) + (rng() - 0.5) * 14, 0, 100);

    // valence: 進行中感情の極性 × 強度（符号付き）＋ わずかな負バイアス
    let valence = -4 + (rng() - 0.5) * 8;
    if (activeEmo) valence += (VALENCE_POLARITY[activeEmo] ?? 0) * activeVal;
    row['valence'] = clamp(valence, -100, 100);

    // attention: 常に高め、時々低下
    row['attention'] = clamp(92 + (rng() - 0.5) * 10 - (rng() < 0.05 ? rng() * 40 : 0), 0, 100);

    // ---- Action Units（0-100・表情に連動） ----
    const joyV = row['joy'], angerV = row['anger'], confV = row['confusion'], surV = row['surprise'];
    const au = (base) => clamp(base + (rng() - 0.5) * 6, 0, 100);
    row['inner brow raise'] = au(2 + surV * 0.3 + confV * 0.2);
    row['brow raise'] = au(2 + surV * 0.5);
    row['brow furrow'] = au(2 + angerV * 0.5 + confV * 0.4);
    row['eye widen'] = au(2 + surV * 0.6 + (row['fear']) * 0.4);
    row['cheek raise'] = au(5 + joyV * 0.7);
    row['lid tighten'] = au(10 + rng() * 40);
    row['nose wrinkle'] = au(3 + (row['disgust']) * 0.5);
    row['upper lip raise'] = au(2 + (row['disgust']) * 0.4);
    row['dimpler'] = au(rng() * 5);
    row['lip corner depressor'] = au(2 + (row['sadness']) * 0.4);
    row['chin raise'] = au(rng() * 6);
    row['lip pucker'] = au(rng() * 5);
    row['lip stretch'] = au(rng() * 6);
    row['lip press'] = au(2 + (row['anger']) * 0.2);
    row['mouth open'] = au(5 + (row['surprise']) * 0.4 + rng() * 10);
    row['jaw drop'] = au(2 + (row['surprise']) * 0.3);
    row['lip suck'] = au(rng() * 4);
    row['eye closure'] = au(rng() * 8);
    row['smile'] = au(5 + joyV * 0.9);
    row['smirk'] = au(rng() * 5);
    row['blink'] = au(rng() < 0.1 ? 60 + rng() * 40 : rng() * 3);
    row['blink rate'] = '';   // 実データに合わせて空欄

    // ---- 頭部姿勢（度・ゆっくりドリフト＋ノイズ） ----
    row['pitch'] = f2(Math.sin(t * 0.3 + phP) * 6 + (rng() - 0.5) * 6);
    row['yaw'] = f2(Math.sin(t * 0.25 + phY) * 8 + (rng() - 0.5) * 7);
    row['roll'] = f2(Math.sin(t * 0.2 + phR) * 4 + (rng() - 0.5) * 5);

    // ---- 撮影・幾何情報（顔ごとにほぼ一定＋微小ジッター） ----
    row['brightness'] = f2(geometry.brightness + (rng() - 0.5) * 4);
    row['interocular distance'] = f2(geometry.iod + (rng() - 0.5) * 6);
    const jx = (rng() - 0.5) * 4, jy = (rng() - 0.5) * 4;
    const g = geometry;
    row['topleft_x'] = f2(g.tlx + jx); row['topleft_y'] = f2(g.tly + jy);
    row['bottomright_x'] = f2(g.brx + jx); row['bottomright_y'] = f2(g.bry + jy);
    row['outer_right_eye_X'] = f2(g.rex + jx); row['outer_right_eye_Y'] = f2(g.rey + jy);
    row['outer_left_eye_X'] = f2(g.lex + jx); row['outer_left_eye_Y'] = f2(g.ley + jy);
    row['nose_top_X'] = f2(g.nx + jx); row['nose_top_Y'] = f2(g.ny + jy);
    row['chin_top_X'] = f2(g.cx + jx); row['chin_top_Y'] = f2(g.cy + jy);

    // 数値列を2桁に整形（time stamp / face id / blink rate は除く）
    for (const k of NON_NEUTRAL) row[k] = f2(row[k]);
    row['neutral'] = f2(row['neutral']); row['engagement'] = f2(row['engagement']);
    row['valence'] = f2(row['valence']); row['attention'] = f2(row['attention']);

    rows.push(row);
  }
  return rows;
}

/** 不規則・低頻度なタイムライン（平均約7fps）を作る */
function irregularTimeline(rng, duration) {
  const ts = [];
  let t = 0.05 + rng() * 0.05;
  while (t < duration) {
    ts.push(t);
    t += 0.06 + rng() * 0.28;   // 0.06〜0.34秒（平均≈0.2秒）
  }
  return ts;
}
/** 規則的タイムライン（マルチFaceID用・全員同一時刻） */
function regularTimeline(duration, fps) {
  const ts = []; const dt = 1 / fps;
  for (let i = 0; i * dt < duration; i++) ts.push(+(i * dt).toFixed(3));
  return ts;
}

function toCsv(rows) {
  const lines = [HEADER.join(',')];
  for (const r of rows) lines.push(HEADER.map(h => r[h]).join(','));
  return lines.join('\n') + '\n';
}
function writeBoth(filename, content) {
  writeFileSync(join(SRC_DIR, filename), content);
  writeFileSync(join(PUB_DIR, filename), content);
  console.log(`wrote  ${filename}  (${content.trim().split('\n').length - 1} rows)`);
}

// 顔の幾何（実データの座標感に近い3パターン）
const GEO = {
  center: { brightness: 85, iod: 120, tlx: 900, tly: 140, brx: 1015, bry: 270, rex: 960, rey: 168, lex: 1037, ley: 168, nx: 995, ny: 196, cx: 1000, cy: 265 },
  left:   { brightness: 87, iod: 86,  tlx: 551, tly: 237, brx: 674, bry: 368, rex: 567, rey: 268, lex: 653, ley: 261, nx: 617, ny: 298, cx: 618, cy: 368 },
  right:  { brightness: 73, iod: 73,  tlx: 248, tly: 100, brx: 341, bry: 197, rex: 260, rey: 118, lex: 333, ley: 125, nx: 295, ny: 147, cx: 290, cy: 197 },
};

mkdirSync(SRC_DIR, { recursive: true });
mkdirSync(PUB_DIR, { recursive: true });

// ① 基本サンプル（単一・約120秒・ポジティブ寄りで喜び表出が多め）
{
  const rng = makeRng(20260605);
  const rows = buildFaceRows({
    rng, timeline: irregularTimeline(rng, 120), faceId: 0,
    weights: { joy: 5, surprise: 2, sentimentality: 1.5, confusion: 1, sadness: 0.7 },
    meanGap: 11, engBase: 48, calmNeutral: 96, geometry: GEO.center,
  });
  writeBoth('basic_joy_120s.csv', toCsv(rows));
}

// ② 比較用B（単一・約100秒・低エンゲージ／ネガティブ寄り）— A/B比較の相手
{
  const rng = makeRng(20260607);
  const rows = buildFaceRows({
    rng, timeline: irregularTimeline(rng, 100), faceId: 0,
    weights: { confusion: 4, sadness: 3, anger: 1.5, fear: 1.2, contempt: 1 },
    meanGap: 13, engBase: 30, calmNeutral: 95, geometry: GEO.center,
  });
  writeBoth('contrast_confusion_100s.csv', toCsv(rows));
}

// ③ ベースライン補正＋変化点デモ（単一・90秒）
//    冒頭30秒は静穏（イベントなし・低ノイズ）→ その後に強い表出を数回
{
  const rng = makeRng(20260606);
  const fixedEvents = [
    { start: 40, end: 44, emo: 'joy', intensity: 95 },
    { start: 58, end: 61, emo: 'anger', intensity: 90 },
    { start: 72, end: 75, emo: 'surprise', intensity: 92 },
    { start: 82, end: 86, emo: 'sadness', intensity: 85 },
  ];
  const rows = buildFaceRows({
    rng, timeline: irregularTimeline(rng, 90), faceId: 0,
    weights: {}, meanGap: 99, engBase: 24, calmNeutral: 97, calmNoise: 0.5,
    geometry: GEO.center, fixedEvents,
  });
  writeBoth('baseline_changepoints_90s.csv', toCsv(rows));
}

// ④ マルチFaceID（3人・60秒・15fps規則的／同一時刻に3行）
{
  const timeline = regularTimeline(60, 15);
  const faces = [
    { faceId: 0, seed: 20260611, weights: { joy: 5, surprise: 2, sentimentality: 1 }, meanGap: 10, engBase: 52, calmNeutral: 95, geometry: GEO.left },
    { faceId: 1, seed: 20260612, weights: { confusion: 4, sadness: 3, fear: 1.2 }, meanGap: 13, engBase: 30, calmNeutral: 94, geometry: GEO.center },
    { faceId: 2, seed: 20260613, weights: { surprise: 2, joy: 1.5, confusion: 1 }, meanGap: 15, engBase: 58, calmNeutral: 96, geometry: GEO.right },
  ];
  // 各顔の行を生成 → 時刻ごとに face0,1,2 の順で並べる（実データの並びに合わせる）
  const perFace = faces.map(f => buildFaceRows({
    rng: makeRng(f.seed), timeline, faceId: f.faceId,
    weights: f.weights, meanGap: f.meanGap, engBase: f.engBase, calmNeutral: f.calmNeutral, geometry: f.geometry,
  }));
  const rows = [];
  for (let i = 0; i < timeline.length; i++) for (const pf of perFace) rows.push(pf[i]);
  writeBoth('multiface_3people_60s.csv', toCsv(rows));
}

console.log('\n✅ サンプル生成完了（心sensor実データ準拠・0〜100スケール・54列）→ client/public/samples/');
