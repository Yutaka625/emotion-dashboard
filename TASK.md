# TASK.md — KSDV 開発タスク管理

> 2026-06-03 更新: **未完了タスクを上部に集約**し、完了タスクを下部にまとめました。
> 状態は実コードを確認して判定しています。

---

# 🔲 未完了タスク（これから対応するもの）

## 🟠 中〜高優先度（UX の摩擦）
- [ ] **設定カードの折りたたみ／ツールチップを他セクションへ横展開**（Overview / Academic 等）
  - ※ 設定4カードの本体レイアウト統一（共通部品化）は完了済み
- [ ] **ComparisonSection の空状態に導線を追加**（`ComparisonSection.tsx` / `Home.tsx`）
  - 「比較用CSVを追加してください」だけで追加方法が不明 → ＋比較CSVボタンへの案内・矢印を追加
- [ ] **スムージング設定のα値スライダーを反転**（`SmoothingSettingsCard.tsx`）
  - 現在: 左=0.05（強）/ 右=0.90（弱）で直感と逆。「スムージング強度0〜100%」表記に

## 🟡 中優先度（一貫性・洗練度）
- [ ] **ホバー実装をCSSに統一**（`Sidebar.tsx` / `Home.tsx` ほか）
  - `onMouseEnter/Leave` のDOM直接操作を Tailwind `hover:` / CSS変数ベースへ
- [ ] **EMOTION_COLORS と CSS `.emotion-*` クラスの色を統一**（`types.ts` / `index.css`）
  - 同じ感情に異なるOKLCH値が2箇所で定義。`types.ts` を Single Source of Truth に
- [ ] **数値フォーマットの統一**（全セクション）
  - 感情スコア `.toFixed(3)` / Engagement・Valence・Attention `.toFixed(1)` に統一
  - 共通フォーマッタ `formatScore()` / `formatPct()` を `utils.ts` に追加
- [ ] **セクション切り替え時のフェードイン追加**（`Home.tsx` / `index.css`）
  - `display: none → block` の瞬時切替が唐突 → `@keyframes fade-in` で自然に

## 🟢 低優先度（後回し可）
- [ ] **モバイル対応**（サイドバーのドロワー化・グリッドのレスポンシブ確認）
- [ ] **アクセシビリティ（a11y）対応**（aria-label・フォーカスリング・グラフの role）
- [ ] **未使用アニメーションクラスの活用または削除**（`index.css` の `count-up` / `scan-line`）

## 機能拡張（次フェーズ候補）
- [ ] **KEY INSIGHTS Phase 2: フルセット・ルール拡張**
  - 遷移パターン・circumplex 象限の偏り・相関・頭部動作イベントの活用
  - 「もっと見る」で全インサイト展開、各カードから該当セクションへのジャンプ導線
- [ ] **CSV エクスポート Phase 3A（残）**
  - ※ TIME RANGE FILTER の「範囲CSV出力」は実装済み
  - 残: BASELINE SETTINGS に「補正後データを出力」ボタン、先頭にメタデータ行（区間・オフセット）、補正有無・日時を含むファイル名
- [ ] **Before/After AI 比較機能 Phase 3B（Claude API）**
  - `.env` に `ANTHROPIC_API_KEY`、`@anthropic-ai/sdk`、`POST /api/ai-compare`、`AiInsightSection.tsx`、ナビ追加
- [ ] **ベースライン補正 Phase 4 の残作業（細部の作り込み）** ※中核は完了（下記「完了済み」参照）
  - lift / zスコア モード時の特殊指標（engagement/valence/attention）グラフの軸ラベル・「—」の見せ方を
    感情グラフ並みに整える（現状は感情グラフほど作り込んでいない）
  - circumplex は補正の影響を valence/engagement の絶対値で受けない設計だが、補正中の解釈ガイド文言の補強
- [ ] **マルチ FaceID の拡張**
  - FaceID が多い場合（10+）のドロップダウン表示
  - FaceID ごとの感情比較グラフ（オーバーレイ表示）
  - FaceID に任意のラベル名を付ける機能
- [ ] **データ保存・読み込み（localStorage）**
- [ ] **感情閾値設定機能**（実装前に仕様確定）
  - 閾値設定UI（検出最小値）／表示フィルタか統計補正かの仕様検討／ベースライン・FaceIDとの併用整理
- [ ] **学術研究者向け Phase 4**
  - 参加者間の感情平均グラフ（群平均±SD）／CSV一括インポート／統計サマリー出力／実験条件ラベル付け／外部刺激との同期
  - 統計検定表示: ※ A/B比較タブの **Welch t検定 + Cohen's d** は実装済み。残は Mann-Whitney U 検定・参加者群での検定

---

# ✅ 完了済みタスク

## 2026-06 セッション（UI/UX 改善・バグ修正 / main マージ済）
- **A/B比較タブに統計検定を追加**: Welch t検定 + Cohen's d（効果量）＋統計結果のCSVエクスポート
- **10秒テーブルの感情列順序を統一**: `NON_NEUTRAL_EMOTIONS` から動的生成（'困'→'混' 修正含む）
- **UXスコア異常値バグ修正**: `computeUXScores` の0-1正規化漏れ（デライト指数2496/100→正常化）＋5指標の説明を平易な日本語に
- **設定カード レイアウト統一の仕上げ**: `SettingBox` / `SettingSubLabel`（新規）で本体内部の余白・副見出し・ネストボックスを共通化
- **TIME RANGE FILTER カードをオレンジで統一**: 色帯・ラベル・スライダー・つまみ・ベースラインボタン・CSV出力ボタン
- **EVENT ANNOTATIONS のラベル色を青に統一**（他カードのアクセント色ルールに整合）
- **「ベースラインとして設定」ボタンの修正**: トグル化（点灯中に押すと解除）＋必ず生データから計算（補正後データで0化する不具合を修正）
- **概要タブの改善**: 記録時間を「M分S秒」表記に／総フレーム数の「frames」はみ出し修正／複数人(マルチFaceID)データのFPSをユニークなタイムスタンプ数で算出／ツールチップの可読性改善
- **感情分布カードの左端の色帯を削除**（くどさ解消、識別はドット・数値色・バーで担保）
- **全 Recharts ツールチップの文字色を明色固定**: 共通スタイル `lib/chartTooltip.ts`（新規）を全セクションに適用、独自実装の散布図ツールチップも対応
- **ベースライン補正 Phase 4（特殊指標補正・一貫化・品質可視化・堅牢化）**:
  - A: engagement/valence/attention を補正対象に追加（`BASELINE_SPECIAL_COLS`）。valence は signed のため lift では「—」。neutral は補正対象から除外
  - B: `special_stats` を補正後で再計算。circumplex/`ux_scores`/`affect_dynamics`/`correlation_matrix` は絶対値スケール前提のため再計算せず、Academic・UXリサーチに「補正対象外（絶対値）」警告バッジ（`AbsoluteScaleBadge` 新規）を表示
  - C: zscore に `MIN_SD` ガード（発散→「—」）。`BaselineSettingsCard` に mean±SD・フレーム数・区間警告（短い/高ばらつき）を追加
  - 併せて解釈ボックスのライトテーマ残りをダーク基調に統一

## ベースライン補正機能（feature/baseline）
- `BaselineContext` / `BaselineBanner` / `TimeseriesSection` の BASELINE SETTINGS UI・ゼロライン・区間ハイライト
- `csvAnalyzer.ts`: `computeBaselineOffsets` / `applyBaselineCorrection`
- `App.tsx` / `Home.tsx`: プロバイダー配置

## EMOTION TIME SERIES ラベル選択のリセット防止
- セクション切替時の選択リセットを修正（`switch` → CSS show/hide）
- デフォルト選択感情を変更

## TRANSITION MATRIX セル色コントラスト改善
- アルファ → 明度補間（oklch L 0.22→0.72）+ 平方根スケール

## マルチ FaceID 対応（feature/multi-faceid → main）
- `FaceIDContext` / `FaceIDSelector` / `csvAnalyzer` の検出・グルーピング / `types.ts` の `MultiFaceData`
- FaceID 列なし CSV は従来と完全同一動作

## Phase 2: ベースライン補正拡張（feature/phase2-baseline → main）
- `useCorrectedDashboardData`（補正後の各種統計を再計算）
- 補正済みデータの全セクション配信 / BASELINE CORRECTED バッジ / `detectBaselineWindow()` 自動検出＋トースト
- ツールチップに困惑が出ない問題を修正

## 時系列スムージング機能（feature/timeseries-smoothing → main）
- `smoothingUtils.ts`（SMA/EMA）、SMOOTHING SETTINGS UI、元データ保持

## UI/UX 改善バッチ（2026-05-30 / main）
- KEY INSIGHTS 動的生成 / サイドバー録音日時・ラベル変更 / ファイル操作1ボタン化 / セクション切替で先頭スクロール
- `TimeseriesSection` を4サブコンポーネントに分割（1,573→約250行）
- サイドバーAUアイコン変更・折りたたみツールチップ / RadarChart の ×10 スケール廃止

## ベースライン補正 Phase 1: signed モード（2026-05-30 / main）
- 0クランプを `clampNegatives` で切替可能化 → 後に撤廃 / signed トグルUI / モード別サブタイトル

## UI/UX 改善バッチ②（2026-05-30 / main）
- サイドバー アイコン・テキスト色の統一 / 印刷・PDF出力のライトテーマ対応
- TIME RANGE FILTER スライダーの操作感修正（`.range-thumb`・0.1秒刻み・リセット）
- 設定カードの折りたたみトグル + 説明ツールチップ（`CollapsibleCard` / `InfoTooltip` 新規、4カードに適用）

## KEY INSIGHTS Phase 1: インサイトエンジン（2026-05-30）
- `lib/insightEngine.ts`（純粋関数）: 9ルールを score 降順評価 → 上位4枚、tone別アイコン・左ボーダー

## ベースライン補正の再設計 Phase 2/3（2026-05-31）
- `computeBaselineOffsets`（平均/中央値 + per-emotion `{offset, sd}`）/ `applyBaselineCorrection`（absolute/deviation/lift/zscore）
- `BaselineContext` を `centerMethod` + `displayMode` に刷新 / `BaselineSettingsCard` のセレクター
- 仕上げ①: モード別Y軸ラベル・単位サフィックス・NaN→「—」/ ヒートマップ「データなし」表示
- 仕上げ②: 変化率(lift%) を `LIFT_MIN_BASELINE(0.1)` で実用安定化（μ<0.1 は「—」）

## 既存バグ修正: 時系列の time 絶対タイムスタンプ問題（2026-05-31）
- `computeDashboardData` でソート直後に time を 0 基点へ正規化 → グラフ空問題を解消

## UI 改善
- セッション間比較機能（`ComparisonSection`：A/B 並列比較・差分・統計検定）

---

## 調査メモ（ベースライン補正の根拠）
- 標準手法はKSDV同様「ベースライン区間の平均（or 中央値）を減算」で一致
- 負値は signed 保持が鉄則：「正=活動増加／負=活動減少」（facial EMG文献）
- 補正の効果は実証済み：Valenceと自己申告の相関 r=0.71（補正なし）→ r=0.87（補正あり）
- 出典: Frontiers/PMC 2026「Facial obstructions and baseline correction shape affective computing's detection of emotion–behavior relationships」(PMC12935594) ほか

### 表示モード（実装済み）
| モード | 計算 | 値域 | 対象ユーザー |
|--------|------|------|------------|
| ① 絶対値（デフォルト） | 補正なし | 0〜100 | 一般ユーザー |
| ② ベースライン偏差（signed） | `x − μ` | 負値あり | 研究者 |
| ③ 変化率（lift %） | `(x − μ) / μ × 100` | ±% | マーケター |
| ④ Zスコア | `(x − μ) / σ` | SD単位 | 研究者 |
