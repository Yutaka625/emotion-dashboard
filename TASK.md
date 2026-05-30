# TASK.md — KSDV 開発タスク管理

## 完了済みタスク

### ✅ ベースライン補正機能（feature/baseline ブランチ）
- `BaselineContext`：ベースライン状態のグローバル管理
- `BaselineBanner`：補正中を画面上部にバナー表示
- `TimeseriesSection`：BASELINE SETTINGS UI・ゼロライン・区間ハイライト
- `csvAnalyzer.ts`：`computeBaselineOffsets` / `applyBaselineCorrection` 追加
- `App.tsx`・`Home.tsx`：プロバイダー配置

### ✅ EMOTION TIME SERIES ラベル選択のリセット防止
- セクション切り替え時に選択中感情がリセットされる問題を修正
- `Home.tsx`：`switch` 条件レンダリング → CSS show/hide（`display: none/block`）に変更
- デフォルト選択感情：怒り・悲しみ・驚き・嫌悪・恐怖・喜びに変更

### ✅ TRANSITION MATRIX セル色コントラスト改善
- アルファ（透過）ベース → 明度補間（oklch L: 0.22→0.72）方式に変更
- 平方根スケールで低頻度セルの差異を視認しやすく改善

### ✅ マルチ FaceID 対応（feature/multi-faceid ブランチ → main マージ済）
- `FaceIDContext`：FaceID 選択状態のグローバル管理 + `activeDashboardData` 計算
- `FaceIDSelector`：ヘッダーバー内チップ型セレクター UI
- `csvAnalyzer.ts`：`parseCSV` export、`computeDashboardData` 分離、FaceID 検出・グルーピング関数追加
- `types.ts`：`MultiFaceData` 型追加
- FaceID 列なし CSV は従来と完全同一動作

### ✅ Phase 2: ベースライン補正拡張（feature/phase2-baseline → main マージ済）
- `useCorrectedDashboardData` フック：補正後の emotion_stats / dominant_emotion / transitions / duration_stats を再計算
- `Home.tsx`：補正済みデータを全セクションに配信（hooks を early return より前に配置）
- `OverviewSection`：BASELINE CORRECTED バッジ表示
- `detectBaselineWindow()`：スライディングウィンドウでベースライン区間を自動検出
- `TimeseriesSection`：「自動検出」ボタン + Sonner トースト通知
- バグ修正：EMOTION TIME SERIES ツールチップに困惑（confusion）が表示されない問題を修正

---

## 進行中タスク

なし

---

## バックログ（次フェーズ候補）

### Phase 3A: CSV エクスポート機能
- [ ] `exportUtils.ts`：補正済み感情ログを CSV 生成・ダウンロードする関数
- [ ] `TimeseriesSection`：「補正後データを出力」ボタンを BASELINE SETTINGS に追加
- [ ] CSV 先頭にメタデータコメント行（ベースライン区間・オフセット値）を付与
- [ ] ファイル名に補正有無・日時を含める（例: `session_corrected_20260508.csv`）

### Phase 3B: Before/After AI 比較機能（Claude API）
- [ ] `.env`：`ANTHROPIC_API_KEY` を設定
- [ ] `@anthropic-ai/sdk` をインストール
- [ ] `server/index.ts`：`POST /api/ai-compare` エンドポイント追加
- [ ] `AiInsightSection.tsx`（新規）：AI 比較 UI（実行ボタン・ローディング・結果表示）
- [ ] `Sidebar.tsx` / `Home.tsx`：AI INSIGHT セクションをナビに追加
- [ ] ベースライン未設定時は案内メッセージを表示

### マルチ FaceID の拡張
- [ ] FaceID が多い場合（10+）のドロップダウン表示
- [ ] FaceID ごとの感情比較グラフ（オーバーレイ表示）
- [ ] FaceID に任意のラベル名を付ける機能

### UI 改善
- [ ] セッション間比較機能
- [ ] データ保存・読み込み（localStorage）

---

## UI/UX 改善バックログ
> 2026-05-30 全コンポーネントレビューで洗い出し。優先度順に記載。

### 🔴 高優先度（データ正確性・誤解招くUI）

- [ ] **KEY INSIGHTS の動的化**（`OverviewSection.tsx`）
  - 「困惑が支配的感情」「ネガティブなValenceは検出されず」などの文章がハードコードされており、どのCSVを読み込んでも変わらない
  - 実際の `dominant_emotion_counts` / `special_stats` から動的に生成する
  - 例: 主要感情・Valenceの傾向・Engagementピーク時刻などをデータドリブンに記述

- [ ] **サイドバーフッターの日時をデータから取得**（`Sidebar.tsx`）
  - `REC: 2025-12-17 / 16:14:31 JST` がハードコード
  - Props 経由でメタデータ（`meta.recording_date` / `meta.recording_time`）を受け取り表示する

- [ ] **「LIVE DATA」バッジの文言修正**（`Sidebar.tsx`）
  - CSVの事後分析ツールなのに「LIVE DATA」は誤解を招く
  - 「ANALYZED」「SESSION DATA」など分析済みを示す表現に変更

### 🟠 中〜高優先度（UX の摩擦）

- [ ] **ヘッダーの重複UIを整理**（`Home.tsx`）
  - 「ファイル名 + ×ボタン」と「別のファイルボタン」が両方 `handleReset` を呼ぶ重複
  - どちらか一方に統合し、ヘッダー左側の要素数を削減する

- [ ] **TimeseriesSection のセクション切り替え後スクロール位置リセット**（`Home.tsx`）
  - セクション切り替え時に `main` のスクロール位置を先頭に戻す
  - `setActiveSection` 呼び出し時に `mainRef.current?.scrollTo(0, 0)` を追加

- [ ] **TimeseriesSection を子コンポーネントに分割**（`TimeseriesSection.tsx`）
  - 現在 1,573 行の巨大コンポーネント
  - `BaselineSettingsCard` / `SmoothingSettingsCard` / `EmotionChartsCard` / `EventAnnotationsCard` に分割

- [ ] **サイドバーアイコンの見直し**（`Sidebar.tsx`）
  - 「アクションユニット」の `Clock` → `Target` または `Scan` などに変更
  - 折りたたみ時にホバーでラベルが出るツールチップを追加

- [ ] **RadarChart のスケール表示を改善**（`OverviewSection.tsx`）
  - `mean * 10` スケールの意図が不明確
  - 軸に実際の値範囲を明示するか、スケーリングをやめて生の値を表示する

### 🟡 中優先度（一貫性・洗練度）

- [ ] **ホバー実装をCSSに統一**（`Sidebar.tsx` / `Home.tsx` ほか）
  - `onMouseEnter/Leave` でDOM直接操作するパターンをTailwindの `hover:` クラスまたはCSS変数ベースに統一

- [ ] **EMOTION_COLORS と CSS `.emotion-*` クラスの色を統一**（`types.ts` / `index.css`）
  - 同じ感情に異なるOKLCH値が2箇所で定義されている
  - `types.ts` を Single Source of Truth にして CSS側を削除または同期する

- [ ] **数値フォーマットの統一**（全セクション）
  - 感情スコア: `.toFixed(3)` に統一
  - Engagement / Valence / Attention: `.toFixed(1)` に統一
  - 共通のフォーマッタ関数 `formatScore()` / `formatPct()` を `utils.ts` に追加

- [ ] **セクション切り替え時のフェードイン追加**（`Home.tsx` / `index.css`）
  - `display: none → block` が瞬時切り替えで唐突
  - `@keyframes fade-in` + `animation: fade-in 0.15s ease-out` で自然なトランジション

- [ ] **スムージング設定のα値スライダーを反転**（`TimeseriesSection.tsx`）
  - 現在: 左=0.05（強）/ 右=0.90（弱）で直感と逆
  - スライダーを「スムージング強度（0〜100%）」として内部でαに逆算、または左右を反転

- [ ] **ComparisonSection の空状態に導線を追加**（`ComparisonSection.tsx` / `Home.tsx`）
  - 「比較用CSVを追加してください」だけで追加方法が不明
  - ヘッダーの「＋比較CSV」ボタンを指し示す説明または矢印を追加

### 🟢 低優先度（後回し可）

- [ ] **モバイル対応**（全体）
  - サイドバーをモバイル幅でオーバーレイ型ドロワーに切り替え
  - 主要なグリッドのレスポンシブ対応確認

- [ ] **アクセシビリティ（a11y）対応**（全体）
  - 全アイコンボタンに `aria-label` を追加
  - キーボードフォーカスリングをデザインに合わせてカスタム
  - recharts グラフに `role="img"` と `aria-label` を追加

- [ ] **未使用アニメーションクラスの活用または削除**（`index.css`）
  - `count-up` / `scan-line` クラスが定義されているが未使用
  - 数値カードのマウントアニメーションなどに活用するか、不要なら削除

### Phase 4: 学術研究者向け機能
> 複数参加者データの集計・統計処理・論文執筆への接続を想定
- [ ] **参加者間の感情平均グラフ** — 複数人のCSVをまとめて読み込み、感情指標の群平均±SDを時系列で表示
- [ ] **CSV一括インポート** — フォルダ単位または複数ファイル同時アップロード対応
- [ ] **統計サマリー出力** — 平均・中央値・SD・最大値をCSV/Excelで書き出す
- [ ] **実験条件ラベル付け** — 参加者や試行に「条件A / 条件B」などラベルを付与して比較
- [ ] **外部刺激との同期** — スライド切替・音声などのタイムスタンプをCSVインポートしてグラフに重ねる
- [ ] **統計検定表示（参考値）** — t検定・Mann-Whitney U検定の結果をインライン表示（研究者向けオプション）
