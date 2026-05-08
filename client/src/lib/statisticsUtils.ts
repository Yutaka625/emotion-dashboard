/**
 * statisticsUtils.ts
 * 学術研究向け統計計算ユーティリティ
 * 外部ライブラリ不要 - p値はAbramowitz & Stegunの多項式近似で実装
 */

import type { TimeseriesPoint } from './types';

// ---- 基本統計 ----

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
}

function std(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

// ---- t分布のCDF近似（Abramowitz & Stegun, 26.7.8） ----

/**
 * 正規分布の累積分布関数（0に関する対称性を利用）
 * 精度: |error| < 7.5×10⁻⁸
 */
function normalCDF(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1.0 + sign * y);
}

/**
 * t分布の両側p値を計算する
 * df=自由度, 大きいdfではt→z（正規分布）に収束する性質を利用
 * @param t  t統計量（絶対値）
 * @param df 自由度
 * @returns  両側p値 [0, 1]
 */
export function tDistPValue(t: number, df: number): number {
  if (df <= 0 || !isFinite(t)) return 1;
  const absT = Math.abs(t);

  // df が十分大きい場合（>200）は正規近似
  if (df > 200) {
    return 2 * (1 - normalCDF(absT));
  }

  // 不完全ベータ関数の近似による t 分布 CDF
  // I_x(a, b) ≈ regularized incomplete beta function
  // x = df / (df + t²), a = df/2, b = 0.5
  const x = df / (df + absT * absT);
  const ibeta = incompleteBeta(x, df / 2, 0.5);
  return ibeta; // 両側p値
}

/**
 * 正則化不完全ベータ関数の近似 I_x(a, b)
 * Lentz の連分数展開（Numerical Recipes より）
 */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x < 0 || x > 1) return 0;
  if (x === 0) return 0;
  if (x === 1) return 1;

  // 対称性: I_x(a,b) = 1 - I_{1-x}(b,a)
  const flip = x > (a + 1) / (a + b + 2);
  if (flip) return 1 - incompleteBeta(1 - x, b, a);

  // log(beta(a,b)) = lgamma(a) + lgamma(b) - lgamma(a+b)
  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;

  // 連分数展開（Lentz法）
  const MAX_ITER = 200;
  const EPS = 1e-10;
  let f = 1.0;
  let C = 1.0;
  let D = 1.0 - (a + b) * x / (a + 1);
  D = Math.abs(D) < EPS ? EPS : D;
  D = 1 / D;
  f = D;

  for (let m = 1; m <= MAX_ITER; m++) {
    // 偶数項
    let numerator = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    D = 1 + numerator * D;
    D = Math.abs(D) < EPS ? EPS : D;
    C = 1 + numerator / C;
    C = Math.abs(C) < EPS ? EPS : C;
    D = 1 / D;
    f *= C * D;
    // 奇数項
    numerator = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    D = 1 + numerator * D;
    D = Math.abs(D) < EPS ? EPS : D;
    C = 1 + numerator / C;
    C = Math.abs(C) < EPS ? EPS : C;
    D = 1 / D;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < EPS) break;
  }

  return front * f;
}

/** Lanczosの近似によるlog-Gamma関数 */
function logGamma(z: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z - 1;
  let y = x + 5.5;
  let tmp = (x + 0.5) * Math.log(y) - y;
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { x++; ser += c[j] / x; }
  return tmp + Math.log(2.5066282746310005 * ser);
}

// ---- Welch の t 検定 ----

export interface TTestResult {
  meanA: number;
  meanB: number;
  stdA: number;
  stdB: number;
  nA: number;
  nB: number;
  t: number;
  df: number;
  p: number;
  cohensD: number;
  significance: '***' | '**' | '*' | 'n.s.';
  effectSize: '大' | '中' | '小' | '極小';
}

/**
 * Welch の独立2標本t検定
 * @param a 標本A
 * @param b 標本B
 */
export function welchTTest(a: number[], b: number[]): TTestResult {
  const nA = a.length;
  const nB = b.length;
  const meanA = mean(a);
  const meanB = mean(b);
  const varA = variance(a);
  const varB = variance(b);
  const stdA = std(a);
  const stdB = std(b);

  // t統計量
  const se = Math.sqrt(varA / nA + varB / nB);
  const t = se === 0 ? 0 : (meanA - meanB) / se;

  // Welch-Satterthwaiteの自由度
  const num = (varA / nA + varB / nB) ** 2;
  const den = (varA / nA) ** 2 / (nA - 1) + (varB / nB) ** 2 / (nB - 1);
  const df = den === 0 ? 1 : num / den;

  const p = tDistPValue(t, df);

  // Cohen's d（プールされたSD）
  const pooledSD = Math.sqrt(((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2));
  const d = pooledSD === 0 ? 0 : (meanA - meanB) / pooledSD;

  return {
    meanA: +meanA.toFixed(4),
    meanB: +meanB.toFixed(4),
    stdA: +stdA.toFixed(4),
    stdB: +stdB.toFixed(4),
    nA,
    nB,
    t: +t.toFixed(3),
    df: +df.toFixed(1),
    p: +p.toFixed(4),
    cohensD: +d.toFixed(3),
    significance: p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'n.s.',
    effectSize: Math.abs(d) >= 0.8 ? '大' : Math.abs(d) >= 0.5 ? '中' : Math.abs(d) >= 0.2 ? '小' : '極小',
  };
}

// ---- 区間データ抽出 ----

export type EmotionKey = 'anger' | 'contempt' | 'disgust' | 'fear' | 'joy' | 'sadness' | 'surprise' | 'sentimentality' | 'confusion';

export const TESTABLE_EMOTIONS: EmotionKey[] = [
  'anger', 'contempt', 'disgust', 'fear', 'joy',
  'sadness', 'surprise', 'sentimentality', 'confusion',
];

/**
 * タイムスタンプの範囲でデータを抽出する
 */
export function extractSegmentValues(
  timeseries: TimeseriesPoint[],
  startSec: number,
  endSec: number,
  emotion: EmotionKey
): number[] {
  return timeseries
    .filter(p => p.time >= startSec && p.time <= endSec)
    .map(p => p[emotion])
    .filter(v => !isNaN(v));
}

/**
 * 2区間の全感情について t 検定を実行する
 */
export function compareSegments(
  timeseries: TimeseriesPoint[],
  segA: { start: number; end: number; name: string },
  segB: { start: number; end: number; name: string }
): Record<EmotionKey, TTestResult> {
  const results: Partial<Record<EmotionKey, TTestResult>> = {};
  for (const emotion of TESTABLE_EMOTIONS) {
    const a = extractSegmentValues(timeseries, segA.start, segA.end, emotion);
    const b = extractSegmentValues(timeseries, segB.start, segB.end, emotion);
    if (a.length < 2 || b.length < 2) {
      // データ不足の場合はダミー値
      results[emotion] = {
        meanA: 0, meanB: 0, stdA: 0, stdB: 0, nA: a.length, nB: b.length,
        t: 0, df: 0, p: 1, cohensD: 0,
        significance: 'n.s.', effectSize: '極小',
      };
    } else {
      results[emotion] = welchTTest(a, b);
    }
  }
  return results as Record<EmotionKey, TTestResult>;
}
