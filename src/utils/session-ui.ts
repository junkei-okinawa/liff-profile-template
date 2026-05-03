// セッション切れ UI のコンテンツ（メッセージ＋ログアウトボタン）を生成する純粋関数。
// Terms・Unsubscribe 両ページから共用し、文言・スタイルの一元管理を保証する。
// 呼び出し側が role="alert" aria-live="assertive" のラッパーを付与すること。
export const buildSessionExpiredHtml = (btnId: string): string => `
    <p style="color: #e65c00; font-weight: bold; margin: 0 0 6px;">セッションが切れました。</p>
    <p style="color: #666; font-size: 0.9rem; margin: 0 0 12px;">3秒後に自動ログアウトします。再ログインしてください。</p>
    <button id="${btnId}" style="padding: 10px 20px; background: #06C755; color: white; border: none; border-radius: 5px; font-size: 0.9rem; cursor: pointer;">
        今すぐログアウト
    </button>
`;
