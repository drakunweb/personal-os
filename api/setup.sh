#!/bin/bash
# Personal OS API — Cloudflare Workers セットアップスクリプト

set -e

export PATH="/opt/homebrew/bin:$PATH"

echo "=== Personal OS API Setup ==="
echo ""

# 1. wrangler インストール
echo "📦 Wrangler CLIをインストール中..."
npm install
echo "✅ Wrangler インストール完了"
echo ""

# 2. Cloudflare ログイン
echo "🔑 Cloudflareにログイン..."
echo "ブラウザが開きます。Cloudflareアカウントでログインしてください。"
npx wrangler login
echo ""

# 3. KV Namespace 作成
echo "🗄️  KV Namespaceを作成中..."
KV_OUTPUT=$(npx wrangler kv namespace create "PERSONAL_OS_KV" 2>&1)
echo "$KV_OUTPUT"
KV_ID=$(echo "$KV_OUTPUT" | grep -o '"id": "[^"]*"' | grep -o '[a-f0-9]\{32\}' | head -1)

if [ -z "$KV_ID" ]; then
  echo "⚠️  KV IDの自動取得に失敗しました。上の出力から id をコピーして wrangler.toml の REPLACE_WITH_KV_ID に貼り付けてください。"
else
  echo "✅ KV ID: $KV_ID"
  # wrangler.toml を自動更新
  sed -i.bak "s/REPLACE_WITH_KV_ID/$KV_ID/" wrangler.toml
  rm -f wrangler.toml.bak
  echo "✅ wrangler.toml を更新しました"
fi
echo ""

# 4. APIキーをセキュアに設定
echo "🔐 APIキーを設定します..."
echo "以下でランダムなAPIキーを生成します。メモしておいてください。"
API_KEY=$(openssl rand -hex 32)
echo ""
echo "=============================="
echo "  生成されたAPIキー:"
echo "  $API_KEY"
echo "=============================="
echo ""
echo "このキーをダッシュボードの設定に貼り付けてください。"
echo "$API_KEY" | npx wrangler secret put API_KEY
echo ""

# 5. デプロイ
echo "🚀 Workerをデプロイ中..."
npx wrangler deploy
echo ""
echo "=== セットアップ完了 ==="
echo ""
echo "APIキー: $API_KEY"
echo "URL: https://personal-os-api.drakunweb.workers.dev"
echo ""
echo "動作確認:"
echo "  curl https://personal-os-api.drakunweb.workers.dev/health"
