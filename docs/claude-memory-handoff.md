# Claude Code メモリ引き継ぎ（別環境への同期用）

> 目的: このリポジトリで作業した環境の Claude Code メモリを、別の作業環境の Claude Code メモリにも反映するための引き継ぎファイル。
> Claude のメモリは各PCのローカル（`~/.claude/projects/<project>/memory/`）にあり Git で同期されないため、ここに内容を転記して持ち運ぶ。
>
> **別環境での手順**: この内容を、その環境の Claude に「メモリへ追記して」と依頼する（または下記各ブロックを `memory/<name>.md` として保存し、`MEMORY.md` に1行ずつ索引を追加する）。既存の同名メモリがあれば重複させず統合すること。
>
> 最終更新: 2026-06-11

---

## MEMORY.md 索引（追加する行）

```
- [KSDV: 感情スコアにIQR外れ値検出を使わない](ksdv-no-iqr-outliers.md) — ゼロ過多分布のため誤判定。変化点検出を使う
- [KSDV: 変更時の5資料チェックリスト](ksdv-change-checklist.md) — ガイド/技術資料/規約/LP/タスクの更新要否を毎回確認
- [KSDV: フレーム単位検定は擬似反復](ksdv-frame-pseudoreplication.md) — 推論統計はNセッション/被験者単位が前提。実効n・SDで誠実対応
```

---

## メモリ① ksdv-no-iqr-outliers.md

```markdown
---
name: ksdv-no-iqr-outliers
description: KSDVで感情スコアにIQR法の外れ値検出を使わない設計判断と理由
metadata:
  type: project
---

KSDV（感情分析ダッシュボード）では、感情スコアに対するIQR法の外れ値検出を**採用しない**と判断した（2026-06、学術研究者向け機能の検討時）。

**Why:** 表情・感情データはゼロ過多分布（zero-inflated）。大半のフレームがほぼゼロで、トリガーにより短時間だけスパイクが出る。この分布ではQ1/Q3/IQRがほぼゼロに潰れ、上限フェンスもほぼゼロになり、正常な感情スパイクの大半が「外れ値」と誤判定される。「外れ値が多い＝信頼できないデータ」という誤解を与えるリスクがあった。

**How to apply:** 感情データの「意味のある瞬間」の検出は外れ値ではなく変化点検出（Change Points: グローバルSD×2.5）を使う。データ品質確認は face_detection_rate / emotion_detection_rate でカバー。外れ値が有効になり得るのは連続値（Engagement/Valence/Attention）・センサーアーティファクト・セッション間/被験者間比較で、これらは将来検討。詳細は技術説明資料の3.2.3に設計判断メモあり。

一度実装して削除した経緯あり（コミット 0c3965c）。同種の「正規分布前提の統計手法」を感情スコアに適用する際は同じ注意が必要。
```

---

## メモリ② ksdv-change-checklist.md

```markdown
---
name: ksdv-change-checklist
description: KSDVで機能開発・修正を行った際に整合性を確認すべき5資料のチェックリスト
metadata:
  type: feedback
---

KSDVで機能開発・修正など変更を行った場合、以下5つの資料・項目について更新要否を確認し、Yutakaさんに報告する。

1. **ユーザーガイド** — `KSDV_User-Guide.html`（リポジトリ直下 ＋ `client/public/` の両版を必ず同期）
2. **技術説明資料** — `KSDV（感情分析ダッシュボード）技術説明資料.md`
3. **利用規約・プライバシーポリシー** — `KSDV_terms.html`（＋ `client/public/` 同期）。法的文書。データ取扱い・収集・送信・保存が変わる時のみ要更新
4. **製品紹介ページ（LP）** — `client/public/KSDV_LP.html`。掲載済み機能の強化なら更新不要、新カテゴリ機能の追加時に検討
5. **タスク** — `TASK.md`。完了記録の追加・新規タスクの起票

**Why:** CLAUDE.mdの整合性ルールはガイドと技術資料の2つのみ対象。Yutakaさんは対外配布資料（LP・規約）とタスク管理も含めて漏れなく見たい。

**How to apply:** 変更後に各資料を実際に確認し「要更新／不要」を理由付きで報告する。勝手に大きく書き換えず、列名・数値の事実修正は提示とあわせて直してよい。ガイド更新時は2版を必ず同期。詳細ルールは [[ksdv-no-iqr-outliers]] のような設計判断もあわせて技術資料に残す。
```

---

## メモリ③ ksdv-frame-pseudoreplication.md

```markdown
---
name: ksdv-frame-pseudoreplication
description: KSDVのフレーム単位t検定は擬似反復であり、推論統計はNセッション基盤が前提
metadata:
  type: project
---

KSDVのA/B比較・区間比較の t検定／Mann-Whitney U は **n＝フレーム数（最大600）** を独立標本として扱っているが、連続フレームは強く自己相関する（AR1を算出している）。これは**擬似反復（pseudoreplication）**にあたり、平均差がわずかでも p<0.001 になりやすく有意差を過大評価する。

**Why:** 正しい推論統計の単位は「フレーム」ではなく「セッション／被験者」。[[ksdv-no-iqr-outliers]] と同種の「データ構造に合わない統計適用」の問題。

**How to apply:**
- フレーム単位の信頼区間・ANOVA は**追加しない**（誤りを増幅する）。
- 現バージョンの誠実な対応＝実効n `n_eff=n(1−r)/(1+r)`（r=AR1、`statisticsUtils.ts: effectiveSampleSize`）＋自己相関の警告、ばらつきは±SDエラーバー（SEではなくSD）で記述的に可視化。
- ANOVA/Kruskal-Wallis・テスト-再テスト信頼性(ICC)・群間比較は **任意Nセッション保持基盤（TASK.md Phase 4）が前提**。加えて群定義メタデータ・設計別検定・前提チェック/多重比較補正・十分なNが必要（基盤は必要条件であって十分条件ではない）。
- 実験計画メタデータは `sessionMeta.ts`（schema_version付き・localStorage・filenameキー）に記録済み。将来のファイル取込と共通スキーマ。

2026-06-10 実装（コミット 630c0fa）。設計判断は技術資料3.2.3に記録。
```
