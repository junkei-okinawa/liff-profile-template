# 03. 設計書

## 1. アーキテクチャ構成

本アプリケーションは、**Single Page Application (SPA)** として構築されている。
ビルドツールには **Vite** を採用し、言語は **TypeScript** を使用する。

### 技術スタック
- **Frontend Framework**: Vanilla JS / TypeScript (No heavy framework like React/Vue, simple DOM manipulation)
- **Build Tool**: Vite
- **SDK**:
    - `@line/liff`: LINEログインおよびプロフィール取得
    - `marked`: Markdownレンダリング
- **CSS**: Vanilla CSS
- **Backend**:
    - `apps/ai-processor`: ユーザー同意状況管理API (FastAPI)

## 2. ディレクトリ構成

```
LIFF/
├── public/
│   ├── terms.md          # 利用規約コンテンツ (Markdown)
│   └── unsubscribe.md    # 退会確認コンテンツ (Markdown)
├── src/
│   ├── pages/
│   │   ├── Profile.ts    # プロフィール画面ロジック
│   │   ├── Terms.ts      # 利用規約画面ロジック
│   │   └── Unsubscribe.ts# 退会画面ロジック
│   ├── main.ts           # エントリーポイント・ルーティング
│   ├── style.css         # グローバルスタイル
│   └── vite-env.d.ts     # 型定義
├── index.html            # エントリーHTML
├── package.json          # 依存関係定義
├── tsconfig.json         # TypeScript設定
├── vite.config.js        # Vite設定
└── .env                  # 環境変数 (Git管理外)
```

## 3. 画面遷移設計 (ルーティング)

`src/main.ts` にて `window.location.pathname` に基づく簡易ルーティングを実装している。

| パス | 画面 | 説明 |
| :--- | :--- | :--- |
| `/` | プロフィール | `/profile/me` へリダイレクト |
| `/profile/:id` | プロフィール | ユーザー情報を表示。`:id` が `me` の場合はログインユーザーを表示。 |
| `/terms-of-use` | 利用規約 | 利用規約を表示。同意ボタンを含む。 |
| `/unsubscribe` | 退会確認 | 退会確認文言と「退会する」ボタンを表示。 |
| `/unsubscribe/complete` | 退会完了 | 退会完了メッセージとカウントダウンを表示後、ログアウト。 |
| `/api/auth/callback/line` | コールバック | LINEログイン後のコールバック用。プロフィールへリダイレクト。 |

## 4. データ設計 (Firestore)

**注意**: LIFFアプリからFirestoreへの直接アクセスは行わない。全てのデータ操作は `apps/ai-processor` のAPIを経由する。

### Users Collection (`users`)
ユーザーごとの同意状況等を管理する。

| Document ID | Field Name | Type | Description |
| :--- | :--- | :--- | :--- |
| `{userId}` | `terms_accepted_at` | Timestamp | 利用規約に同意した日時。未同意の場合はフィールドが存在しないかnull。 |

## 5. API設計 (Backend)

`apps/ai-processor` が提供するAPIエンドポイント。

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/users/{userId}/status` | 規約同意状況を取得する。 |
| POST | `/api/users/{userId}/agreement` | 規約に同意する。 |

## 5. 環境変数

`.env` ファイルにて管理する。

| 変数名 | 説明 |
| :--- | :--- |
| `VITE_CHANNEL_ID` | LIFF ID (LINE Developersコンソールで取得) |
| `VITE_CALLBACK_URL` | LINEログイン後のコールバックURL |
| `VITE_API_BASE_URL` | バックエンドAPIのベースURL (例: `http://localhost:8080`) |
