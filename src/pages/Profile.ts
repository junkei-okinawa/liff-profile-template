import liff from '@line/liff';

interface Profile {
  displayName: string;
  statusMessage?: string;
  pictureUrl?: string;
  userId?: string;
}

// module スコープで自動ログアウトタイマーIDを保持する。
// ページ遷移時にルーターから cleanupProfileAutoLogoutTimer() を呼ぶことで
// 別ページ描画後にタイマーが発火してしまう問題を防ぐ。
let _autoLogoutTimer: ReturnType<typeof setTimeout> | null = null;

export const cleanupProfileAutoLogoutTimer = (): void => {
  if (_autoLogoutTimer !== null) {
    clearTimeout(_autoLogoutTimer);
    _autoLogoutTimer = null;
  }
};

// Utility function to escape HTML to prevent XSS
const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const renderProfile = async (container: HTMLElement): Promise<void> => {
  container.innerHTML = '<div class="loading">プロフィールを読み込み中...</div>';

  try {
    let profile: Profile;

    // Use LIFF data
    if (liff.isInClient() || liff.isLoggedIn()) {
      try {
        // Requirement: Use LINE ID from login for profile display
        // We can get basic info from getProfile
        const liffProfile = await liff.getProfile();
        profile = {
          displayName: liffProfile.displayName,
          statusMessage: liffProfile.statusMessage,
          pictureUrl: liffProfile.pictureUrl,
          userId: liffProfile.userId
        };
      } catch (e) {
        console.error('Failed to get profile', e);
        throw new Error('プロフィールの取得に失敗しました');
      }
    } else {
      // Should have been handled by main.ts login redirect, but just in case
      throw new Error('ログインしていません');
    }

    const pictureHtml = profile.pictureUrl
      ? `<img src="${escapeHtml(profile.pictureUrl)}" alt="Profile" class="profile-image">`
      : `<div class="profile-image" style="display:flex;align-items:center;justify-content:center;font-size:2rem;color:#888;">?</div>`;

    const html = `
      <div class="profile-header">
        ${pictureHtml}
        <h1 class="profile-name">${escapeHtml(profile.displayName)}</h1>
        <div class="profile-status">${escapeHtml(profile.statusMessage || '')}</div>
      </div>
      
      <div class="info-card">
        <div class="info-item">
          <span class="info-label">ユーザーID</span>
          <span class="info-value">${escapeHtml(profile.userId || 'N/A')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">言語</span>
          <span class="info-value">${escapeHtml(liff.getAppLanguage() || 'ja')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">OS</span>
          <span class="info-value">${escapeHtml(liff.getOS() || 'web')}</span>
        </div>
      </div>
      
      <div style="text-align:center; margin-top: 30px;">
        <a href="/terms-of-use" style="color: #666; text-decoration: none; font-size: 0.9rem;">利用規約</a>
        <span style="margin: 0 10px; color: #ccc;">|</span>
        <a href="/unsubscribe" style="color: #666; text-decoration: none; font-size: 0.9rem;">退会する</a>
        <br><br>
        <button id="logout-btn" style="padding: 8px 16px; background: #ff4d4f; color: white; border: none; border-radius: 5px; font-size: 0.9rem; cursor: pointer;">ログアウト</button>
      </div>
    `;

    container.innerHTML = html;

    const link = container.querySelector('a[href="/terms-of-use"]') as HTMLAnchorElement;
    if (link) {
      link.onclick = (e: MouseEvent) => {
        e.preventDefault();
        window.history.pushState({}, '', '/terms-of-use');
        window.dispatchEvent(new Event('popstate'));
      };
    }

    const unsubscribeLink = container.querySelector('a[href="/unsubscribe"]') as HTMLAnchorElement;
    if (unsubscribeLink) {
      unsubscribeLink.onclick = (e: MouseEvent) => {
        e.preventDefault();
        window.history.pushState({}, '', '/unsubscribe');
        window.dispatchEvent(new Event('popstate'));
      };
    }

    const logoutBtn = container.querySelector('#logout-btn') as HTMLButtonElement;
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        if (liff.isLoggedIn()) {
          liff.logout();
          window.location.href = '/';
        }
      };
    }

  } catch (error: unknown) {
    console.error('Profile rendering error:', error);
    container.innerHTML = `
      <div class="container">
        <p style="color:red">プロフィールの読み込みに失敗しました。</p>
        <p style="color:#666; font-size:0.9rem;">3秒後に自動ログアウトします。再ログインしてください。</p>
        <div style="text-align:center; margin-top: 16px;">
          <button id="error-logout-btn" style="padding: 8px 16px; background: #ff4d4f; color: white; border: none; border-radius: 5px; font-size: 0.9rem; cursor: pointer;">今すぐログアウト</button>
        </div>
      </div>`;

    const doLogout = () => {
      if (liff.isLoggedIn()) {
        liff.logout();
      }
      window.location.href = '/';
    };

    // 3秒後に自動ログアウト。ボタン押下時はタイマーをキャンセルして即実行。
    // module スコープの _autoLogoutTimer に保持することで、
    // ページ遷移時に cleanupProfileAutoLogoutTimer() でキャンセル可能にする。
    _autoLogoutTimer = setTimeout(() => {
      _autoLogoutTimer = null;
      doLogout();
    }, 3000);

    const errorLogoutBtn = container.querySelector('#error-logout-btn') as HTMLButtonElement;
    if (errorLogoutBtn) {
      errorLogoutBtn.onclick = () => {
        cleanupProfileAutoLogoutTimer();
        doLogout();
      };
    }
  }
};
