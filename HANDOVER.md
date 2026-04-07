# Personal OS — AI管理者向け引き継ぎドキュメント

> このドキュメントは、このプロジェクトを引き継ぐAIエージェント（Codex等）向けに
> システム構成・更新手順・Git運用方法を記述する。
> **最初に必ず `CLAUDE.md` を読むこと。**

---

## 1. システム全体構成

```
[オーナー]
  ↓ Google スプレッドシート（2種）に記録
  ↓
[Apps Script] apps-script/Code.js
  ↓ syncToPersonalOS() を毎朝3時自動実行
  ↓ PATCH /data → Cloudflare Workers KV に保存
  ↓
[Cloudflare Workers KV] — personal-os-api.drakunweb.workers.dev
  ↓ GET /data
  ↓
[GitHub Pages] — docs/index.html （唯一の成果物）
  ↓ ブラウザで表示（スマホ・PC対応 PWA）
```

### エンドポイント
| 項目 | 値 |
|------|---|
| API URL | `https://personal-os-api.drakunweb.workers.dev` |
| API Key | `drakunweb4567` |
| GET/PATCH | `/data` （X-API-Key ヘッダー必須） |
| GitHub Pages URL | `https://drakunweb.github.io/personal-os/` |

---

## 2. 主要ファイル一覧

| ファイル | 役割 |
|---------|------|
| `docs/index.html` | **唯一のフロントエンド**。HTML+CSS+JS がすべて1ファイル |
| `apps-script/Code.js` | Google Sheets → KV 同期スクリプト（clasp管理） |
| `CLAUDE.md` | プロジェクト運用ルール（必読） |
| `HANDOVER.md` | このファイル |

### スプレッドシート
| 名称 | ID | 用途 |
|------|-----|------|
| メインSS | `1cfx6ukLh1o9mYM44wouj6STHCUXNXuZHCZ2mPDGJbJY` | 健康・食事・筋トレ・GCal |
| Database_PerOS | `1_R6B4oH-Pt09PJ2J-6T7EqZVvmAimogXuaIFpqptM6w` | ニュース・副業求人・転職求人 |

---

## 3. データ構造（KV）

KVに保存されているJSONの主要キー：

```json
{
  "2025-04-08": {
    "weight": 72.0,
    "pfc": { "p": 130, "f": 55, "c": 180 },
    "foodSummary": { "protein": 130, "fat": 55, "carbon": 180, "calorie": 2100 },
    "meals": { "朝食": [...], "昼食": [...], "夕食": [...] },
    "training": [{ "name": "ベンチプレス", "sets": [...] }],
    "gcalEvents": { "2025-04-08": [{ "time": "09:00", "text": "打ち合わせ @work", "duration": 60 }] }
  },
  "newsItems": [...],
  "sidePosts": [...],
  "careerJobs": [...],
  "scheduleEvents": [...],
  "workTodos": [...],
  "ideas": [...],
  "habits": {...},
  "pfcTargets": { "p": 150, "f": 60, "c": 200, "kcal": 2200 }
}
```

---

## 4. シートの列構造（Apps Script マッピング）

### メインスプレッドシート
| シート名 | 列 |
|---------|---|
| `Food_data` | date / meal_type / category / food / protein / fat / carbon / calorie / memo |
| `Food_summary` | date / protein / fat / carbon / calorie / memo |
| `Training` | date / exercise / sets / reps / weight / memo |

### Database_PerOS (DB2)
| シート名 | 列 |
|---------|---|
| `news` | date / category / topic / about / url / what_for |
| `sidebis` | date / name / about / rate_or_salary / platform / url |
| `newjob` | date / name / about / rate_or_salary / platform / url |

---

## 5. Apps Script 運用

### デプロイ済みトリガー
- 毎朝 3:00 に `syncToPersonalOS()` が自動実行される
- 手動同期: Google Apps Script エディタから `syncToPersonalOS()` を実行

### ローカル開発（clasp）
```bash
cd apps-script
npm install -g @google/clasp  # clasp v3.3.0
clasp login                    # Googleアカウント認証
clasp push                     # Code.js をGASにアップロード
clasp pull                     # GASの最新版をローカルに取得
```

### シートにデータを追加した後の反映フロー
1. Google スプレッドシートに行を追加
2. GASの `syncToPersonalOS()` を実行（または翌朝3時を待つ）
3. アプリの🔄更新ボタンを押す → KVから最新データを取得

---

## 6. フロントエンド更新手順

### 基本手順（HTML編集 → 反映）

```bash
# 1. ファイルを編集
#    /docs/index.html のみ編集する（他のファイルは触らない）

# 2. ローカル確認（任意）
#    open docs/index.html でブラウザ確認

# 3. Git commit & push
git add docs/index.html
git commit -m "変更内容を日本語で簡潔に記述"
git push origin main
# → GitHub Pages が自動でデプロイ（1〜2分で反映）
```

### 重要な設計ルール
- **1ファイル原則**: すべてのUI・ロジックは `docs/index.html` に収める
- **localStorage ＋ リモート同期**: データは `loadData()` / `saveData()` で管理
- **PATCH方式**: KVへの書き込みは必ずPATCH（ディープマージ）。PUTは使わない
- **日付キー**: `todayKey()` が返す `"YYYY-MM-DD"` 形式をキーとして使用

### タブ構成（TAB_ORDER）
```javascript
const TAB_ORDER = ['today','schedule','health','gym','meal','study','work',
                   'goals','finance','side','career','shopping','style','ideas','weekly','news','aiagent'];
```
プライマリタブ（常時表示）: 今日・記録・筋トレ・食事・勉強・仕事 + ☰メニュー

---

## 7. Git 運用ルール

### ブランチ戦略
- **`main` ブランチのみ使用**（GitHub Pages は `main/docs` から配信）
- 作業ブランチは不要（シンプルに main に直接 push）

### コミットメッセージ規則（日本語）
```
機能追加: フェイスライン改善セクションを健康タブに追加
修正: カロリー合計の計算をシート連携に合わせる
削除: ニュース・副業・転職の手動追加フォームを削除
改善: ニュースカードをタップで記事を開けるよう変更
```

### やってはいけないこと
- `git push --force`（履歴を壊す）
- `docs/` 以外のファイルをコミットに含める（node_modules等）
- `.env` や APIキーをコミット

---

## 8. よくある作業パターン

### ① タブに新しいセクションを追加する
1. `docs/index.html` 内で `id="tab-XXX"` のdivを探す
2. その中に `.section-title` + `.card` でHTMLを追加
3. 必要なら対応するJS関数を追加
4. `initApp()` 内でレンダリングを呼ぶ

### ② スプレッドシートの新しいシートを同期する
1. `apps-script/Code.js` に `syncNewSheet()` 関数を追加
2. `syncToPersonalOS()` の末尾で呼ぶ
3. KVのJSONキーと `docs/index.html` のJS側を対応させる
4. `clasp push` でGASにアップロード

### ③ データ構造を変更する
1. Apps Script側の `syncXxx()` でJSONキーを変更
2. `docs/index.html` の `loadData()` / `renderXxx()` 側も対応させる
3. 古いデータとの互換性に注意（`?? defaultValue` パターン推奨）

---

## 9. トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| データが反映されない | KVとローカルのズレ | 🔄更新ボタンを押す |
| GASエラー `Invalid time value` | Sheets日付がDateオブジェクト | `excelDateToISO()` は対応済み |
| タイムラインの位置ズレ | `tl-overlay-layer` の高さ計算 | `TL_HOUR_H * (TL_END-TL_START+1)` を確認 |
| GitHub Pagesに反映されない | pushが失敗 or Pages設定 | `git log` と Pages設定（`/docs`フォルダ）を確認 |
| APIが401を返す | X-API-Keyヘッダー漏れ | `API_KEY = 'drakunweb4567'` を確認 |

---

## 10. 連絡先・アカウント情報

| 項目 | 備考 |
|------|------|
| GitHub | drakunweb / personal-os |
| Cloudflare Workers | personal-os-api.drakunweb.workers.dev |
| Google Account | GAS・Sheets・GCal連携済み |

---

*最終更新: 2026-04-08 | 作成: Claude Code*
