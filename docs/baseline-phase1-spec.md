# ベースライン補正 Phase 1 実装仕様
> 策定: 2026-05-30 (Claude Opus 4)
> 実装: Sonnet へ引き継ぎ

## 背景・目的

現状の `applyBaselineCorrection` は `Math.max(0, x - offset)` でマイナス値を0に丸めている。
研究文献（Frontiers/PMC 2026, PMC12935594）によると、ベースライン以下の値（感情の抑制）は
意味のある情報であり、signed（符号付き）で保持するのが標準手法。

**方針:** 「クランプするか／signedか」をトグルで切り替えられるようにする。
デフォルトはクランプON（既存ユーザーへの影響なし）。研究者がOFFにできる。

---

## 変更ファイル一覧（5ファイル）

### 1. `client/src/contexts/BaselineContext.tsx`

**追加する状態:**
```ts
clampNegatives: boolean        // デフォルト true（0丸め）
setClampNegatives: (v: boolean) => void
```

- `BaselineContextType` インターフェースに追記
- `useState(true)` で初期化
- `value` オブジェクトに追加
- `clearBaseline` でリセット不要（ユーザー設定として維持）

---

### 2. `client/src/lib/csvAnalyzer.ts` — `applyBaselineCorrection`

**変更箇所（717〜730行付近）:**

```ts
// 変更前
export function applyBaselineCorrection(
  points: TimeseriesPoint[],
  offsets: BaselineOffsets
): TimeseriesPoint[] {
  return points.map(p => {
    const corrected = { ...p };
    for (const col of BASELINE_EMOTION_COLS) {
      corrected[col] = Math.max(0, p[col] - offsets[col]);  // 0クランプ
    }
    return corrected;
  });
}

// 変更後
export function applyBaselineCorrection(
  points: TimeseriesPoint[],
  offsets: BaselineOffsets,
  clampNegatives: boolean = true  // ← 追加。デフォルトtrueで既存呼び出しの互換を保つ
): TimeseriesPoint[] {
  return points.map(p => {
    const corrected = { ...p };
    for (const col of BASELINE_EMOTION_COLS) {
      const v = p[col] - offsets[col];
      corrected[col] = clampNegatives ? Math.max(0, v) : v;  // ← 分岐
    }
    return corrected;
  });
}
```

JSDocコメントも更新:
- 「マイナスは0に丸める」→「clampNegatives=true のときのみマイナスを0に丸める」

---

### 3. `client/src/hooks/useCorrectedDashboardData.ts`

**変更箇所（80〜158行）:**

```ts
// 変更前
const { isBaselineActive, baselineOffsets } = useBaseline();
// ...
applyBaselineCorrection(data.timeseries_full, baselineOffsets)

// 変更後
const { isBaselineActive, baselineOffsets, clampNegatives } = useBaseline();
// ...
applyBaselineCorrection(data.timeseries_full, baselineOffsets, clampNegatives)
```

`useMemo` の依存配列に `clampNegatives` を追加:
```ts
}, [data, isBaselineActive, baselineOffsets, clampNegatives]);
```

---

### 4. `client/src/components/sections/timeseries/BaselineSettingsCard.tsx`

STEP 3（適用/解除ボタン）の**直下**に、補正適用中（`isBaselineActive === true`）のときだけ表示するトグルUIを追加:

```
┌─────────────────────────────────────────────────────┐
│ BASELINE CORRECTION MODE                            │
│ ┌───────────────────────┐ ┌────────────────────┐   │
│ │ ✓ 0に丸める（一般）   │ │  マイナスも表示    │   │
│ │   値域: 0〜100         │ │  （研究者向け）    │   │
│ └───────────────────────┘ └────────────────────┘   │
│ ℹ マイナス＝平常時より感情が抑制された状態を示します │
└─────────────────────────────────────────────────────┘
```

- `const { clampNegatives, setClampNegatives } = useBaseline()` を追加
- 2ボタンのセグメント型（既存の手法選択ボタンと同じスタイル）
- signed選択時のみ補足文を表示

---

### 5. `client/src/components/sections/timeseries/EmotionChartsCard.tsx`

**変更箇所（163〜165行付近）のサブタイトルを条件分岐:**

```ts
// useBaseline から clampNegatives を取得
const { baselineRange, isBaselineActive, clampNegatives } = useBaseline();

// signed モード判定
const isSignedMode = isBaselineActive && !clampNegatives;

// サブタイトル（167行付近）
<div style={{ ... }}>
  {isSignedMode
    ? '感情スコアのベースラインからの変化（0=平常時 / 正=増加 / 負=抑制）'
    : '感情スコアの時系列グラフ'
  }
</div>
```

Y軸ドメイン（208〜209行）: **変更不要。** recharts が自動でマイナス域を描画するため。
ゼロ基準線 `renderBaselineZeroLine()`: **変更不要。** 既に実装済み。

---

### 付随修正: `client/src/components/sections/OverviewSection.tsx`

**RadarChart のデータ生成部分のみ**（`emotion_stats[e].mean` がマイナスになり得るため）:

```ts
// 変更前（mean がマイナスになると RadarChart が崩れる）
{ subject: ..., value: emotion_stats[e]?.mean || 0 }

// 変更後（表示用のみクリップ。統計値自体は変えない）
{ subject: ..., value: Math.max(0, emotion_stats[e]?.mean ?? 0) }
```

---

## 動作確認チェックリスト（実装者向け）

| # | 確認内容 | 期待値 |
|---|---------|--------|
| 1 | CSV読込 → ベースライン自動検出 → 適用 | 従来と同じ動作（クランプON） |
| 2 | トグルを「マイナスも表示」に切り替え | オーバーレイ折れ線にマイナス域が出る |
| 3 | ゼロ基準線（BASELINE=0）の表示 | signed時に確認できる |
| 4 | サブタイトルの言い換え | signed時に「ベースラインからの変化（0=平常時…）」に変わる |
| 5 | RadarChart が崩れないこと | signed時でも0以上で描画される |
| 6 | トグルを「0に丸める」に戻す | 従来の折れ線に復帰 |
| 7 | 遷移・継続時間タブが壊れないこと | 変更なしで正常動作 |
| 8 | TypeScript エラーなし | `npx tsc --noEmit` がパスする |

---

## スコープ外（Phase 2以降）

- 補正方式の選択（中央値減算・Zスコア）
- 変化率（lift %）モード
- engagement / valence / attention への補正拡張
- ヒートマップ・積み上げエリアの負値対応の精緻化
