# LIFF Profile Template

LINE Front-end Framework (LIFF) を利用した、ユーザープロフィール閲覧および利用規約同意管理アプリケーションのテンプレートです。

## 機能

- **LINEログイン**: LIFF SDKを使用したシームレスなログイン。
- **プロフィール表示**: ユーザーのLINEプロフィール情報の表示。
- **利用規約管理**: Markdownで記述された規約の表示と、Firestoreを使用した同意状態の管理。
- **退会機能**: 退会フロー（確認画面 -> 完了画面 -> 自動ログアウト）の実装。

## ドキュメント

詳細な仕様や手順については、`docs/` ディレクトリ内のドキュメントを参照してください。

1.  [要件定義書 (Requirements)](docs/01_requirements.md)
2.  [ユースケース図 (Use Cases)](docs/02_usecases.md)
3.  [設計書 (Design)](docs/03_design.md)
4.  [開発者ガイド (Developer Guide)](docs/04_developer_guide.md)
5.  [オペレーションガイド (Operation Guide)](docs/05_operation_guide.md)

## クイックスタート

### 前提条件

- Node.js (v18+)
- npm

### インストール

```bash
npm install
```

### 環境設定

`.env.template` をコピーして `.env` を作成し、必要な値を設定してください。

```bash
cp .env.template .env
```

詳細は [開発者ガイド](docs/04_developer_guide.md) を参照してください。

### 開発サーバーの起動

```bash
npm run dev
```

`http://localhost:3000` でアプリケーションが起動します。

## テスト

本プロジェクトでは `Vitest` を使用してテストを行います。

### ユニットテスト・統合テストの実行

```bash
# ウォッチモードで実行
npm run test

# CIモードで実行（一回のみ実行）
npm run test:ci
```

### E2Eテストの実行

Playwrightを使用したE2Eテストを実行します。

```bash
npx playwright test
```

## 技術スタック

- **Frontend**: TypeScript, Vanilla JS (No Framework)
- **Build Tool**: Vite
- **SDK**: LINE LIFF SDK, Firebase SDK
- **Style**: Vanilla CSS
