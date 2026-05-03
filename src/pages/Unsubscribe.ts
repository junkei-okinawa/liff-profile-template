import { marked } from 'marked';
import DOMPurify from 'dompurify';
import liff from '@line/liff';

// module スコープでセッション切れ自動ログアウトタイマーIDを保持する。
// ページ遷移時にルーターから cleanupUnsubscribeTimer() を呼ぶことで
// 別ページ描画後にタイマーが発火してしまう問題を防ぐ。
let _autoLogoutTimer: ReturnType<typeof setTimeout> | null = null;

// Global variable to track the interval so it can be cleaned up
let countdownInterval: ReturnType<typeof setInterval> | null = null;

export const cleanupUnsubscribeTimer = (): void => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (_autoLogoutTimer !== null) {
    clearTimeout(_autoLogoutTimer);
    _autoLogoutTimer = null;
  }
};

// 401（セッション切れ）時の共通 UI 表示関数。
// - role="alert" aria-live="assertive" でスクリーンリーダーに即時通知
// - 「キャンセルして戻る」ボタンを非表示にして期限切れセッションのまま遷移を防ぐ
// - 3秒後に自動ログアウト（module スコープタイマーで cleanup 可能）
const showSessionExpiredAndAutoLogout = (container: HTMLElement): void => {
  // 401 時は戻る導線を塞ぎ、期限切れセッションのまま Profile に戻れないようにする
  const backBtn = container.querySelector('#back-btn') as HTMLButtonElement | null;
  if (backBtn) {
    backBtn.style.display = 'none';
  }

  const unsubscribeAction = container.querySelector('#unsubscribe-action');
  if (unsubscribeAction) {
    unsubscribeAction.innerHTML = `
      <div role="alert" aria-live="assertive">
        <p style="color: #e65c00; font-weight: bold;">セッションが切れました。</p>
        <p style="color: #666; font-size: 0.9rem; margin-bottom: 12px;">3秒後に自動ログアウトします。再ログインしてください。</p>
        <button id="session-logout-btn" style="padding: 10px 20px; background: #06C755; color: white; border: none; border-radius: 5px; font-size: 0.9rem; cursor: pointer;">
          今すぐログアウト
        </button>
      </div>
    `;
  }

  const doLogout = () => {
    if (liff.isLoggedIn()) {
      liff.logout();
    }
    window.location.href = '/';
  };

  // module スコープのタイマーIDで保持し、ページ遷移時に cleanup 可能にする
  _autoLogoutTimer = setTimeout(() => {
    _autoLogoutTimer = null;
    doLogout();
  }, 3000);

  const sessionLogoutBtn = container.querySelector('#session-logout-btn');
  if (sessionLogoutBtn) {
    sessionLogoutBtn.addEventListener('click', () => {
      cleanupUnsubscribeTimer();
      doLogout();
    });
  }
};

// 退会処理に必要な userId と idToken を取得する。
// idToken が null（期限切れ）の場合は SESSION_EXPIRED エラーをスローする。
// context.userId が取れない外部ブラウザ環境では getProfile() でフォールバックするが、
// その前に idToken を確認し、失効済みなら SESSION_EXPIRED を優先してスローする。
// （getProfile() が失敗した場合、原因がトークン失効か別エラーかを区別できないため。）
const getUserIdAndToken = async (): Promise<{ userId: string; idToken: string }> => {
  let userId = '';

  if (liff.isInClient() || liff.isLoggedIn()) {
    const context = liff.getContext();
    userId = context?.userId || '';

    if (!userId) {
      // getProfile() を試みる前に idToken を確認する。
      // 外部ブラウザでトークンが失効している場合、getProfile() も失敗するが
      // その失敗を汎用エラーに変換してしまうとセッション切れ UI に到達できなくなるため、
      // トークン失効を先に検出して SESSION_EXPIRED をスローする。
      const earlyIdToken = liff.getIDToken();
      if (!earlyIdToken) {
        throw new Error('SESSION_EXPIRED');
      }
      try {
        const profile = await liff.getProfile();
        userId = profile.userId;
      } catch (e) {
        console.warn('Could not get userId from context or profile for unsubscribe', e);
        throw new Error('ユーザーIDの取得に失敗しました。LINEログイン状態を確認してください。');
      }
    }
  }

  if (!userId || userId.trim() === '') {
    throw new Error('無効なユーザーID: ユーザーIDを取得できませんでした。');
  }

  const idToken = liff.getIDToken();
  if (!idToken) {
    throw new Error('SESSION_EXPIRED');
  }

  return { userId, idToken };
};

export const renderUnsubscribe = async (container: HTMLElement): Promise<void> => {
  container.innerHTML = '<div class="loading">読み込み中...</div>';

  try {
    const response = await fetch('/unsubscribe.md');
    if (!response.ok) {
      throw new Error('コンテンツの読み込みに失敗しました');
    }
    const text = await response.text();
    const parsedHtml = await marked.parse(text);
    const htmlContent = DOMPurify.sanitize(parsedHtml);

    const html = `
      <div class="terms-container">
        <div class="terms-content">
          ${htmlContent}
        </div>

        <div style="margin-top: 30px; text-align: center;">
          <div id="unsubscribe-action">
            <button id="unsubscribe-btn" style="padding: 12px 24px; background: #ff4d4f; color: white; border: none; border-radius: 5px; font-size: 1rem; cursor: pointer; margin-bottom: 20px;">
              退会する
            </button>
          </div>
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

    // 退会に必要な userId と idToken を取得する。
    // idToken が null（セッション切れ）の場合は自動ログアウト UI を表示して終了する。
    let userId = '';
    try {
      ({ userId } = await getUserIdAndToken());
    } catch (e: unknown) {
      const isSessionExpired = e instanceof Error && e.message === 'SESSION_EXPIRED';
      if (isSessionExpired) {
        showSessionExpiredAndAutoLogout(container);
      } else {
        console.error('Failed to get user info for unsubscribe', e);
        const unsubscribeAction = container.querySelector('#unsubscribe-action');
        if (unsubscribeAction) {
          unsubscribeAction.innerHTML = '<p style="color: red;">ユーザー情報の取得に失敗しました。</p>';
        }
      }
      return;
    }

    const unsubscribeBtn = document.getElementById('unsubscribe-btn');
    if (unsubscribeBtn) {
      unsubscribeBtn.onclick = async () => {
        // ボタン押下時に idToken を再取得する。
        // ページ表示後にトークンが期限切れになっている可能性があるため、
        // 保存済みの値ではなく最新の状態を確認する。
        const currentIdToken = liff.getIDToken();
        if (!currentIdToken) {
          showSessionExpiredAndAutoLogout(container);
          return;
        }

        // TODO: 退会API を呼び出す（userId・currentIdToken を使用）
        // const apiBaseUrl = config.apiBaseUrl;
        // const response = await fetch(`${apiBaseUrl}/api/users/${userId}`, {
        //   method: 'DELETE',
        //   headers: { 'Authorization': `Bearer ${currentIdToken}` }
        // });
        // if (response.status === 401) { showSessionExpiredAndAutoLogout(container); return; }
        // if (!response.ok) { throw new Error(`API Error: ${response.status}`); }

        // Navigate to completion page
        window.history.pushState({}, '', '/unsubscribe/complete');
        window.dispatchEvent(new Event('popstate'));
      };
    }

  } catch (error: unknown) {
    console.error('Unsubscribe page error:', error);
    container.innerHTML = `<div class="container"><p style="color:red">ページの表示中にエラーが発生しました。</p></div>`;
  }
};

export const renderUnsubscribeComplete = (container: HTMLElement): void => {
  // Clean up any existing interval before starting a new one
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

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

  countdownInterval = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      if (liff.isLoggedIn()) {
        liff.logout();
      }
      window.location.reload();
    } else {
      render();
    }
  }, 1000);
};
