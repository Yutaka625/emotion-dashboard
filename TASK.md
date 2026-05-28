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

### Phase 4: 学術研究者向け機能
> 複数参加者データの集計・統計処理・論文執筆への接続を想定
- [ ] **参加者間の感情平均グラフ** — 複数人のCSVをまとめて読み込み、感情指標の群平均±SDを時系列で表示
- [ ] **CSV一括インポート** — フォルダ単位または複数ファイル同時アップロード対応
- [ ] **統計サマリー出力** — 平均・中央値・SD・最大値をCSV/Excelで書き出す
- [ ] **実験条件ラベル付け** — 参加者や試行に「条件A / 条件B」などラベルを付与して比較
- [ ] **外部刺激との同期** — スライド切替・音声などのタイムスタンプをCSVインポートしてグラフに重ねる
- [ ] **統計検定表示（参考値）** — t検定・Mann-Whitney U検定の結果をインライン表示（研究者向けオプション）
