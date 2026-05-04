# PLAN.md — emoSense アーキテクチャ・設計方針

## プロジェクト概要

Affdex（Affectiva）の感情認識 CSV ログを可視化する Web ダッシュボード。
ブラウザ完結型（サーバー不要）。

**技術スタック:**
- React 19 + TypeScript + Vite
- TailwindCSS 4
- Recharts 2.15.2（グラフ）
- React Context API（グローバル状態管理）

---

## ディレクトリ構成

```
client/src/
├── components/
│   ├── sections/          # 各ダッシュボードセクション（7種）
│   ├── BaselineBanner.tsx # ベースライン補正中バナー
│   ├── DropZone.tsx       # CSV アップロード UI
│   ├── FaceIDSelector.tsx # FaceID チップセレクター
│   ├── FaceScanIcon.tsx   # アイコンコンポーネント
│   └── Sidebar.tsx        # ナビゲーション
├── contexts/
│   ├── BaselineContext.tsx # ベースライン補正状態
│   ├── FaceIDContext.tsx   # マルチ FaceID 状態
│   └── ThemeContext.tsx    # テーマ（現在は dark 固定）
├── lib/
│   ├── csvAnalyzer.ts     # CSV パース＆統計計算エンジン
│   └── types.ts           # 全型定義
└── pages/
    └── Home.tsx           # メインページ
```

---

## データフロー

```
CSV ファイル
  ↓ DropZone.tsx（ファイル読み取り）
  ↓ parseCSV()             … 生の行配列に変換
  ↓ detectFaceIdColumn()   … FaceID 列を検出
  ↓ groupRowsByFaceId()    … FaceID 別に行をグルーピング
  ↓ computeDashboardData() … 各 FaceID 用 + 全体用を事前計算
  ↓
MultiFaceData → FaceIDContext → activeDashboardData
  ↓
Home.tsx（displayData として各セクションに props で渡す）
  ↓
7 つのセクションコンポーネント（data: DashboardData）
```

---

## 状態管理設計

### グローバル状態（Context）

| Context | 役割 | 状態 |
|---|---|---|
| `FaceIDContext` | 複数 FaceID の選択状態 | `selectedFaceIds`, `activeDashboardData` |
| `BaselineContext` | ベースライン補正の状態 | `baselineOffsets`, `isBaselineActive` |
| `ThemeContext` | カラーテーマ | `theme` |

### ローカル状態（Component）

各セクションが独立して持つ状態（タブ選択、時間レンジ、感情選択など）は
コンポーネントの `useState` で管理。

**重要: セクション切り替えで状態リセットを防ぐため、`Home.tsx` では
全セクションを常時マウントし `display: none/block` で表示を切り替える。**

---

## CSVAnalyzer 設計

### 公開関数一覧

| 関数 | 用途 |
|---|---|
| `analyzeCSV(csvText, filename)` | エントリーポイント（従来互換） |
| `parseCSV(text)` | 生行配列に変換 |
| `computeDashboardData(rows, filename)` | 行配列 → DashboardData（マルチ FaceID 対応用） |
| `detectFaceIdColumn(headers)` | FaceID 列名を検出 |
| `groupRowsByFaceId(rows, col)` | FaceID 別にグルーピング |
| `computeBaselineOffsets(points, start, end)` | ベースラインオフセット計算 |
| `applyBaselineCorrection(points, offsets)` | ベースライン補正適用（非破壊） |

---

## UI/UX 設計原則

- **デザインシステム:** `oklch` カラー空間（ダークテーマ固定）
- **フォント:** `Noto Sans JP`（日本語）+ `Roboto Mono`（数値・コード）
- **ヘッダーバー:** グローバルな操作（FaceID 選択、ファイル変更）を集約
- **サイドバー:** セクション間ナビゲーションのみ
- **FaceID 列なし CSV:** 機能を完全に隠蔽し、従来と同一 UX を維持

---

## ブランチ戦略

| ブランチ | 内容 |
|---|---|
| `main` | 安定版 |
| `feature/baseline` | ベースライン補正 + TRANSITION MATRIX 改善 |
| `feature/multi-faceid` | マルチ FaceID 対応 |

新機能は `feature/` ブランチで開発後、動作確認済みのものを `main` にマージする。
