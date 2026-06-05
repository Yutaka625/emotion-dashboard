# TASK.md — KSDV 開発タスク管理

> 2026-06-03 更新: **未完了タスクを上部に集約**し、完了タスクを下部にまとめました。
> 状態は実コードを確認して判定しています。

---

# 🔲 未完了タスク（これから対応するもの）

## 🟢 低優先度（後回し可）
- [ ] **マルチFaceIDオーバーレイに実時間（秒）表示トグルを追加**（任意）: 現状は各顔の登場区間を0〜100%に正規化した「進行率」表示（意味の説明はUI・ガイドに追加済み）。秒表示も選べるようにする案。ただし顔ごとに登場時刻・長さが異なり、秒では映像内の同じ瞬間に揃わない点に注意
- [ ] **モバイル対応**（サイドバーのドロワー化・グリッドのレスポンシブ確認）
- [ ] **アクセシビリティ（a11y）対応**（aria-label・フォーカスリング・グラフの role）
- [ ] **未使用アニメーションクラスの活用または削除**（`index.css` の `count-up` / `scan-line`）

## 機能拡張（次フェーズ候補）
- [ ] **利用規約・プライバシーポリシーの同意フロー（クリックラップ）**
  - 文書は作成済み（`KSDV_terms.html` ＝アプリ内リンク先、`client/public/` と同期）
  - 初回利用時に「利用規約・プライバシーポリシーに同意する」チェック＋ボタンの同意ゲートを表示
  - **同意状態は localStorage にフラグ保存のみ**（同意日時・規約バージョン等）。サーバーには一切保存しない設計を維持
  - 規約バージョンを更新したら再同意を求められるよう、保存フラグにバージョンを含める
  - アプリ内（DropZone / 上部バー）に `KSDV_terms.html` へのリンクも併せて設置（ガイドリンクと同様の体裁）
- [ ] **KEY INSIGHTS Phase 2: フルセット・ルール拡張**
  - 遷移パターン・circumplex 象限の偏り・相関・頭部動作イベントの活用
  - 「もっと見る」で全インサイト展開、各カードから該当セクションへのジャンプ導線
- [ ] **Before/After AI 比較機能 Phase 3B（Claude API）**
  - `.env` に `ANTHROPIC_API_KEY`、`@anthropic-ai/sdk`、`POST /api/ai-compare`、`AiInsightSection.tsx`、ナビ追加
- [ ] **データ保存・読み込み（localStorage）**
- [ ] **感情閾値設定機能**（実装前に仕様確定）
  - 閾値設定UI（検出最小値）／表示フィルタか統計補正かの仕様検討／ベースライン・FaceIDとの併用整理
- [ ] **学術研究者向け Phase 4（残作業）**
  - ※ **Mann-Whitney U 検定**・**統計サマリー出力** は実装済み（下記「完了済み」参照）
  - 残: **参加者間の感情平均グラフ（群平均±SD）＋ 複数セッション一括インポート** — 要: 任意Nセッションを保持する新規基盤（現状は1セッション内マルチFaceID と A/B 2セッションのみ）
  - 残: **実験条件ラベル付け ＋ 外部刺激との同期** — イベント注釈機能（`EventsContext` / `EventAnnotationsCard`）の拡張
  - 残: **参加者群での検定** — 上記Nセッション基盤の上で Welch / Mann-Whitney を群適用

---

# ✅ 完了済みタスク

## 2026-06-05 セッション（確認事項対応：高・中優先度＋Circumplex方法論）
利用者レビューで挙がった確認事項のうち、高・中優先度の8件を是正（残りの①時間正規化の説明追加のみ未完了→上部に再掲）。

**高優先度（バグ修正）**
- **③ 散布図の色＝支配的感情**: `scatter_eng_val` の各点に `dominant` から色・感情名を付与（凡例の「N/A」解消）。あわせて Valence 軸ドメインを `[25,100]`→`[-100,100]`（符号付き）に修正し、負のValence点のクリップを解消（`EngagementValenceSection.tsx`）
- **④ 特殊指標レベル分布が空**: 描画側の参照キーを生成側の実キー（`'Very Low (0-20)'`〜）に整合（旧 `very_low` 等で全バー0だった）
- **⑦ 感情慣性(AR1)の非表示**: 「感情動態指標の比較」から慣性を分離し、AR1専用カード（Y軸 −1〜1・ゼロライン・符号で色分け）を新設（`EmotionsSection.tsx`）
- **⑧ 学術分析のハードコード文**: 「Fearの変動性が最も高い」等＋4つの解釈カードを実データ駆動化（SD/AR1最大の指標・Engagement相関最大の感情・最多Circumplex象限を動的選択。FACS AU説明はfear/surpriseのみ。マジックナンバー3371除去）（`AcademicSection.tsx`）

**中優先度（UX改善）**
- **② A/B詳細タブ切替**: 比較データがある時、ヘッダーに「表示中 A/B」トグルを追加。詳細タブの表示セッションを切替（比較タブの dataA は常にA固定）。B表示中はFaceIDセレクター/品質バナーを非表示（`Home.tsx`）
- **⑤ Valence表示の追加**: 特殊指標タブを Engagement／Valence の2ブロック化。Engagementカードを明示ラベル化＋Valenceの統計4カード・レベル分布・相関を新設（ガイド既記載の機能に実装が追いついた）
- **⑥ 相関係数の説明**: Engagement／Valence 相関に「ピアソン相関係数（−1〜+1）」の説明文を追加・見出しを具体化
- **⑨ 感情出現率の閾値明示**: 「設定された閾値」→実値（スコア0.3／0〜100スケール・低めの閾値）を表示（`EmotionsSection.tsx`）

**Circumplex 方法論の是正**
- 象限分割を**セッション中央値→固定中立点（Engagement=50／Valence=0）**に変更（`csvAnalyzer.ts`）。中央値分割は構造上どのデータも各象限≈25%になり情報量が失われ、「絶対値スケール前提（補正対象外）」という本指標の扱いとも矛盾していたため。特殊指標タブの解釈文もデータ駆動化（最多象限を動的選択）。ガイドに分割方法を明記

**① マルチFaceID 時間正規化の説明追加**
- オーバーレイ見出しに ⓘ ツールチップ＋本文で「横軸の％＝各顔の登場区間の進行率（0%＝初出、100%＝最後、実時間の同一瞬間ではない）」を明記（`MultiFaceComparisonSection.tsx`）。ガイドにも同趣旨を追記。※ 実時間（秒）トグルは任意の将来課題として上部に再掲

**クリーンアップ／資料**
- 未使用の `EngagementSection.tsx` / `ValenceSection.tsx`（Home.tsx 未import）を削除
- KEY INSIGHTSカードの `border`/`borderLeft`/`borderLeftWidth` 混在による React 警告を解消（4辺個別指定に。`OverviewSection.tsx`）
- ガイド（`KSDV_User-Guide.html` ＋ `client/public/` 同期）に A/Bトグル・感情慣性ピル・出現率閾値0.3・Circumplex固定分割を追記

## 2026-06-05 セッション（比較タイムライン多指標）
- **比較タイムラインオーバーレイの多指標対応**: 比較タブの ENGAGEMENT TIMELINE OVERLAY を「指標選択式」に拡張。
  Engagement / Valence / Attention ＋ 非ニュートラル9感情から1指標を選び、A（実線）/ B（破線）で時間正規化オーバーレイ。
  指標選択ピル追加・見出し/凡例を動的化（`ComparisonSection.tsx`）

## 2026-06-05 セッション（マルチFaceID 拡張）
- **マルチFaceID 拡張一式**:
  - **ノイズフィルタ＋品質可視化**: 少フレームの FaceID（既定: 総フレームの5%未満 or 3秒未満）を
    ノイズとして既定で除外。検出/除外数を品質バナーで明示。「全員」集計も除外後で再計算（denoise）
  - **しきい値を可変に**: 判定を読み込み時固定ではなく `FaceIDContext` がしきい値から動的算出。
    マルチFaceIDセクションで %未満・秒未満を調整可能（既定に戻す付き）。「微小なIDも表示」トグル
  - **FaceID ごとの感情オーバーレイ**: 指標ピル（engagement/valence/attention＋9感情）で1指標を選び、
    各顔の時系列を時間正規化して重ね描画（色=EVENT_PALETTE、凡例=ラベル名）
  - **FaceID ラベル名**: 顔に任意名を付与（localStorage・ファイル名キーで永続化）。セレクター/凡例に反映
  - **再現性**: 学術CSVレポートに `## FACE FILTERING`（判定基準・kept/excluded の ID＋フレーム数）を記録
  - 新規: `FaceQualityBanner.tsx` / `MultiFaceComparisonSection.tsx`、サイドバーに「マルチFaceID」ナビ
  - 検証用に multiface サンプルへ短命なノイズ顔（FaceID 3）を追加
  - ※ 旧「10+ 個別選択ドロップダウン」は方針変更により実装せず（ノイズ除去で不要化）

## 2026-06-05 セッション（公開準備・ドキュメント整備）
- **解析機能テスト用サンプル＋トップ画面のサンプル読込ボタン（2-a/2-b）**: 心sensor実データ準拠（54列・0〜100スケール・valence符号付き・不規則低頻度サンプリング・低周期でランダムな表出）のサンプル4本を生成スクリプト方式で作成（`scripts/generate-sample-data.mjs`、`npm run gen:samples`）。トップ画面に4ボタン（基本／A/B比較／ベースライン+変化点／マルチFaceID）を設置し、`public/samples` から読み込んで解析画面へ遷移（`DropZone.tsx` / `Home.tsx`）
- **トップ画面に利用規約・プライバシーポリシーのリンクを追加**: D&D画面の「使い方ガイドを見る」直下に `KSDV_terms.html` を新規タブで開くリンクを設置（`DropZone.tsx`）。無償公開前の確認用
- **ベースライン補正 Phase 4 の残作業（細部の作り込み）**: 特殊指標グラフ（engagement/valence/attention）を感情グラフ並みに整備（補正モード別サブタイトル・Y軸ラベル・自動ドメイン・ゼロライン・lift時Valenceの「—」常設注記）。Circumplex に補正対象外バッジ＋補正中の解釈ガイド文言を追加（`EmotionChartsCard.tsx` / `EngagementValenceSection.tsx`）
- **利用規約・プライバシーポリシー（無償トライアル版）作成**: 利用規約（全21条）＋プライバシーポリシー（全9項）を統合HTML化（`KSDV_terms.html` ＋ `client/public/` 同期）。法務レビュー反映済み
- **ガイドのHTML一本化・リネーム・整合性ルール化**: 画面ガイドMDを `KSDV_User-Guide.html` に統合・リネーム、旧MD削除。アプリ更新時にガイド／技術資料の整合性を確認するルールを `CLAUDE.md` に明文化

## 2026-06 セッション（機能拡張: エクスポート・統計）
- **CSV エクスポート Phase 3A（補正後データ出力）**: BASELINE SETTINGS に「補正後データを出力」ボタンを追加。先頭にメタデータ（補正区間・中心・表示モード・出力日時）＋各指標の offset/sd、続けて補正後の全フレーム（time＋感情＋engagement/valence/attention、AUは補正対象外のため除外）。BOM付き。ファイル名に中心・モード・区間・日時を含む（`BaselineSettingsCard.tsx`）
- **Mann-Whitney U 検定（ノンパラメトリック）**: `statisticsUtils.ts` に `rank`（タイ平均順位）＋ `mannWhitneyU`（タイ補正つき正規近似・両側p値・効果量はランク二列相関 r）を追加。A/B比較タブに「Welch t検定 / Mann-Whitney U」トグルを追加し、median/U/z/p/r の列に切替（`ComparisonSection.tsx`）
- **統計サマリー出力**: A/B比較のCSVエクスポートを拡充。メタデータ＋記述統計＋Welch＋Mann-Whitney の4セクションを1ファイルに、BOM付き・日時入りファイル名で出力
- **バグ修正: `normalCDF` の標準正規化漏れ**: `0.5·(1+erf(x))` になっていた（`/√2` 欠落）ため標準正規CDFとして誤り。`erf(x/√2)` に修正。大標本（df>200）の Welch t検定 p値と Mann-Whitney の正規近似p値が正しくなる（`statisticsUtils.ts`）

## 2026-06 セッション（一貫性・洗練度バッチ）
- **感情色を EMOTION_COLORS に一本化（SSOT）**: `index.css` の未使用かつ値がズレていた `.emotion-*` / `.bg-emotion-*`（22行）を削除。`types.ts` の `EMOTION_COLORS` を唯一の根拠に
- **セクション切替フェードイン**: `@keyframes fade-in` + `.section-fade-in` を追加し、`Home.tsx` の各セクション wrapper に付与。display:none↔block の切替ごとに再生（状態は保持）
- **数値フォーマット統一**: `utils.ts` に `formatScore()`（感情スコア=小数3桁）/ `formatPct()`（Engagement・Valence・Attention=小数1桁）を追加し、Overview/Emotions/Comparison/EngagementValence の該当表示を置換（相関・時間・占有率は対象外）
- **ホバー実装をCSSに統一**: `onMouseEnter/Leave` のDOM直接操作（24箇所/10ファイル）を全廃。`index.css` に共通クラス（`.row-hover` / CSS変数ベースの `.hbg`・`.hfg`・`.hbd` / `.nav-item[data-active]`）を定義し、動的値はCSS変数で受け渡し。条件付き2箇所（サイドバーナビの選択判定・Timeseries行のイベント色背景）も変換

## 2026-06 セッション（UX の摩擦 解消バッチ）
- **折りたたみ／ツールチップを Overview・Academic へ横展開**: 各重いチャート・表カードを `CollapsibleCard` 化（▲▼トグル＋ⓘツールチップ＋localStorage で開閉永続化）。既存のインライン説明文は維持し ⓘ に補足を追加。Hero の小さな数値カードは対象外
- **ComparisonSection の空状態に導線を追加**: 「比較用CSVを追加してください」の一文を、機能説明＋「＋比較用CSVを選択」ボタン（直接ファイル選択を起動）＋右上ボタンへの矢印つき案内ブロックに刷新（`Home.tsx`）
- **スムージングα値スライダーを「平滑化強度 0〜100%」に反転**: 右ほど強い直感的UIに（内部 α と `smoothEMA` の式は不変＝計算互換。`SmoothingSettingsCard.tsx` のみ変更）

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
