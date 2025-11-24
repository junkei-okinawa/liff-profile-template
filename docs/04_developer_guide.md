# 04. 開発者ガイド

本ドキュメントは、アプリケーションの開発・保守担当者に向けたガイドである。

## 1. 開発環境のセットアップ

### 前提条件
- Node.js (v18以上推奨)
- npm

### インストール手順
プロジェクトのルートディレクトリ (`LIFF/`) で以下のコマンドを実行し、依存関係をインストールする。

```bash
npm install
```

## 2. 環境変数の設定

本プロジェクトでは、環境変数を `.env` ファイルで管理しているが、セキュリティ上の理由から `.env` はリポジトリに含まれていない。

以下のいずれかの方法で `.env` ファイルを作成すること。

### 方法A: 既存メンバーから共有してもらう
プロジェクトの既存メンバーから最新の `.env` ファイルを受け取り、`LIFF/` ディレクトリ直下に配置する。

### 方法B: テンプレートから作成する
`LIFF/` ディレクトリ直下にある `.env.template` をコピーして `.env` を作成し、必要な値を設定する。

```bash
cp .env.template .env
```

**設定値の取得元:**
- **LINE関連**: LINE Developers Console
- **Backend API関連**:
    - `VITE_API_BASE_URL`: `apps/ai-processor` のURL（ローカル開発時は `http://localhost:8080`）

**注意**: `.env` ファイルは Git 管理対象外（`.gitignore` に記述済み）です。リポジトリにはコミットしないでください。

`.env` ファイルの内容（例）:
```env
VITE_CHANNEL_ID=YOUR_LIFF_ID
VITE_CALLBACK_URL=http://localhost:3000/api/auth/callback/line
VITE_API_BASE_URL=http://localhost:8080
```

## 3. ローカル開発サーバーの起動

以下のコマンドで開発サーバーを起動する。

```bash
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスして動作を確認する。
※ LINEログインの動作確認には、LIFF IDの設定で `http://localhost:3000` を許可するか、ngrok等でhttps化する必要がある場合がある（本構成ではlocalhostでの動作を想定）。

## 4. ビルド

本番環境向けの静的ファイルを生成するには、以下のコマンドを実行する。

```bash
npm run build
```

生成されたファイルは `dist/` ディレクトリに出力される。

## 5. デプロイ

`dist/` ディレクトリの内容を任意の静的ホスティングサービス（Firebase Hosting, Vercel, Netlify等）にデプロイする。

例（Firebase Hosting）:
```bash
firebase deploy --only hosting
```

## 6. 注意事項

- `src/pages/Unsubscribe.ts` 内の退会処理には `TODO` コメントが残されている。バックエンドAPIとの連携が必要な場合はここに実装を追加すること。

## 7. 参考リファレンス

開発にあたっては、以下の公式リファレンスを参照すること。

- [LIFF v2 APIリファレンス](https://developers.line.biz/ja/reference/liff/)
- [LINE ログイン APIリファレンス](https://developers.line.biz/ja/reference/line-login/)
