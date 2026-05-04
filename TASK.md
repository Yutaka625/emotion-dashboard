# TASK.md — emoSense 開発タスク管理

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

### ✅ マルチ FaceID 対応（feature/multi-faceid ブランチ）
- `FaceIDContext`：FaceID 選択状態のグローバル管理 + `activeDashboardData` 計算
- `FaceIDSelector`：ヘッダーバー内チップ型セレクター UI
- `csvAnalyzer.ts`：`parseCSV` export、`computeDashboardData` 分離、FaceID 検出・グルーピング関数追加
- `types.ts`：`MultiFaceData` 型追加
- FaceID 列なし CSV は従来と完全同一動作

---

## 進行中タスク

なし

---

## バックログ（次フェーズ候補）

### Phase 2: ベースライン補正の拡張
- [ ] 自動検知ロジック（スライディングウィンドウ）＋トースト通知
- [ ] OverviewSection の感情カードに補正前後の値を並列表示
- [ ] Engagement/Valence 特殊指標への補正適用
- [ ] レンジ正規化（STEP 2 のラジオ選択機能）

### マルチ FaceID の拡張
- [ ] FaceID が多い場合（10+）のドロップダウン表示
- [ ] FaceID ごとの感情比較グラフ（オーバーレイ表示）
- [ ] FaceID に任意のラベル名を付ける機能

### UI 改善
- [ ] PDF/PNG エクスポート機能
- [ ] セッション間比較機能
- [ ] データ保存・読み込み（localStorage）
