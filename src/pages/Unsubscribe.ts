import { marked } from 'marked';
import liff from '@line/liff';

export const renderUnsubscribe = async (container: HTMLElement): Promise<void> => {
  container.innerHTML = '<div class="loading">読み込み中...</div>';

  try {
    const response = await fetch('/unsubscribe.md');
    if (!response.ok) {
      throw new Error('コンテンツの読み込みに失敗しました');
    }
    const text = await response.text();
    const htmlContent = marked.parse(text);

    const html = `
      <div class="terms-container">
        <div class="terms-content">
          ${htmlContent}
        </div>
        
        <div style="margin-top: 30px; text-align: center;">
          <button id="unsubscribe-btn" style="padding: 12px 24px; background: #ff4d4f; color: white; border: none; border-radius: 5px; font-size: 1rem; cursor: pointer; margin-bottom: 20px;">
            退会する
          </button>
          <br>
          <button id="back-btn" style="padding: 10px 20px; background: #eee; color: #333; border: none; border-radius: 5px; font-size: 0.9rem; cursor: pointer;">
            キャンセルして戻る
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;

    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.onclick = () => {
        window.history.back();
      };
    }

    const unsubscribeBtn = document.getElementById('unsubscribe-btn');
    if (unsubscribeBtn) {
      unsubscribeBtn.onclick = () => {
        // TODO: 退会処理を実装する
        // 退会処理が完了したら、後続の退会完了画面への遷移を実行する
        // Navigate to completion page
        window.history.pushState({}, '', '/unsubscribe/complete');
        window.dispatchEvent(new Event('popstate'));
      };
    }

  } catch (error: any) {
    container.innerHTML = `<div class="container"><p style="color:red">エラー: ${error.message}</p></div>`;
  }
};

export const renderUnsubscribeComplete = (container: HTMLElement): void => {
  let countdown = 3;

  const render = () => {
    container.innerHTML = `
            <div class="container" style="text-align: center; padding-top: 50px;">
                <h1 style="color: #333; margin-bottom: 20px;">退会が完了しました</h1>
                <p style="color: #666; font-size: 1.1rem;">ご利用ありがとうございました。</p>
                <p style="color: #888; margin-top: 30px; font-size: 0.9rem;">
                    <span style="font-weight: bold; color: #ff4d4f; font-size: 1.2rem;">${countdown}</span> 秒後にログアウトします...
                </p>
            </div>
        `;
  };

  render();

  const interval = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(interval);
      if (liff.isLoggedIn()) {
        liff.logout();
      }
      window.location.reload();
    } else {
      render();
    }
  }, 1000);
};
