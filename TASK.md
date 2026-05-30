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

### ✅ 時系列スムージング機能（feature/timeseries-smoothing → main マージ済）
- `smoothingUtils.ts`：SMA（単純移動平均）/ EMA（指数移動平均）実装
- `TimeseriesSection`：SMOOTHING SETTINGS UI（手法選択・ウィンドウサイズ・αスライダー）
- 元データは保持したまま表示のみ平滑化

### ✅ UI/UX 改善バッチ（2026-05-30 / main マージ済）

**🔴 高優先度（完了）**
- `OverviewSection.tsx`：KEY INSIGHTS カードを実データから動的生成（主要感情・Engagement・Valence）
- `Sidebar.tsx`：フッターの録音日時を `meta.recording_date / recording_time` から動的表示
- `Sidebar.tsx`：「LIVE DATA」→「SESSION DATA」に変更、OverviewSection バッジを「ANALYZED」に変更

**🟠 中〜高優先度（完了）**
- `Home.tsx`：「ファイル名＋×」と「別のファイル」ボタンを Upload+ファイル名+× の1ボタンに統合
- `Home.tsx`：`mainRef` + `handleSectionChange` でセクション切り替え時に `scrollTo(0, 0)` を実行
- `TimeseriesSection.tsx`：1,573行 → 約250行に削減、4サブコンポーネントに分割
  - `BaselineSettingsCard.tsx`：ベースライン設定UI
  - `SmoothingSettingsCard.tsx`：スムージング設定UI
  - `EmotionChartsCard.tsx`：感情チャート（5タブ）＋特殊指標
  - `EventAnnotationsCard.tsx`：イベントアノテーション＋統計比較
- `Sidebar.tsx`：アクションユニットアイコン `Clock` → `Scan` に変更、折りたたみ時ホバーツールチップ追加
- `OverviewSection.tsx`：RadarChart の `mean × 10` スケールを廃止し生の平均値を表示

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

## UI/UX 改善バックログ（残タスク）
> 🔴高優先・🟠中〜高優先は 2026-05-30 に完了済み。以下は未着手分。

### 🟠 中〜高優先度（UX の摩擦）

- [ ] **学術的分析セクションの印刷／PDF 出力修正**（`AcademicSection.tsx` / `index.css`）
  - 「印刷 / PDF」ボタンをクリックするとブラウザのプリンター画面が開くが、プレビューが空白またはレイアウト崩れになる
  - 原因候補: `overflow: hidden` / `display: none` の印刷時未解除、oklch カラーの印刷非対応、recharts SVG の印刷描画タイミング
  - `@media print` スタイルを追加し、サイドバー非表示・グラフ可視・余白調整を行う
  - `window.print()` 前に `document.title` をセッション名に変更してデフォルトファイル名を整える

- [ ] **TIME RANGE FILTER スライダーの操作感修正**（`TimeseriesSection.tsx`）
  - 現在: range input が2本独立しており、左ハンドルが右ハンドルを追い越せる・ドラッグ感が重い
  - デュアルハンドル対応の単一スライダー（`rc-slider` 等）に置き換えるか、min/max の相互制約ロジックを追加
  - ドラッグ中リアルタイムプレビュー・数値入力欄との双方向同期を維持すること

- [ ] **TIME RANGE FILTER / BASELINE SETTINGS / SMOOTHING SETTINGS / EVENT ANNOTATIONS のレイアウト・UI/UX 改善**（`TimeseriesSection.tsx` 配下の各カード）
  - 各カードの情報密度・余白・フォントサイズが不均一
  - グループ内でヘッダー高さ・ラベルスタイル・ボタンサイズを統一する
  - カード間の視覚的な優先順位（よく使う操作が上・詳細設定は下）を整理する

- [ ] **サイドバー ナビアイコンカラーの統一**（`Sidebar.tsx`）
  - 「UXリサーチ」項目のみ、非選択時にも `oklch(0.65 0.18 300)` の紫色がアイコンに付いている
  - `highlight` フラグはテキスト色に留め、アイコン色は他項目と同様に非選択時は `oklch(0.55 0.015 255)`（グレー）に統一する

- [ ] **説明文をツールチップに格納**（各セクション・カード）
  - 各カード下部・ラベル横の説明文がレイアウトを圧迫している
  - `title` 属性またはカスタムツールチップコンポーネントに格納し、デフォルト非表示にする
  - 対象: SmoothingSettingsCard の説明段落、BaselineSettingsCard のステップ説明など

- [ ] **セクション／カードの折りたたみトグル追加**（各セクション・`Home.tsx`）
  - 使用頻度の低い設定カード（BASELINE SETTINGS・SMOOTHING SETTINGS 等）を折りたたんで画面を広く使いたい
  - 各カードヘッダー右端に `ChevronDown/Up` ボタンを追加し、`useState` で本体 `div` を show/hide
  - 折りたたみ状態は `localStorage` に保存して再訪時も維持する（任意）

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

- [ ] **スムージング設定のα値スライダーを反転**（`SmoothingSettingsCard.tsx`）
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

### 感情閾値設定機能
> 適用範囲・UXについて十分な検討が必要。実装前に仕様を固めること。
- [ ] **閾値設定UIの追加**（`OverviewSection.tsx` / `TimeseriesSection.tsx` ほか）
  - 各感情スコアに「検出とみなす最小値」の閾値を設定できるようにする
  - 閾値未満のフレームを「無感情」扱いにするか、単にグラフ表示を薄くするかを選択できる
- [ ] **適用範囲の仕様検討**（設計フェーズ）
  - 閾値を「表示フィルタ」として使う（統計には影響しない）か、「データ補正」として使う（統計も変わる）かを決定する
  - ベースライン補正・FaceID 選択との組み合わせ時の挙動を整理する
  - 感情ごとに個別設定 vs 全感情一律設定のどちらが実用的か検討する

### Phase 4: 学術研究者向け機能
> 複数参加者データの集計・統計処理・論文執筆への接続を想定
- [ ] **参加者間の感情平均グラフ** — 複数人のCSVをまとめて読み込み、感情指標の群平均±SDを時系列で表示
- [ ] **CSV一括インポート** — フォルダ単位または複数ファイル同時アップロード対応
- [ ] **統計サマリー出力** — 平均・中央値・SD・最大値をCSV/Excelで書き出す
- [ ] **実験条件ラベル付け** — 参加者や試行に「条件A / 条件B」などラベルを付与して比較
- [ ] **外部刺激との同期** — スライド切替・音声などのタイムスタンプをCSVインポートしてグラフに重ねる
- [ ] **統計検定表示（参考値）** — t検定・Mann-Whitney U検定の結果をインライン表示（研究者向けオプション）
