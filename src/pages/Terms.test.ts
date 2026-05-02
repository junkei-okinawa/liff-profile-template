import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderTerms, cleanupTermsAutoLogoutTimer } from '../pages/Terms';
import { TERMS_UPDATED_AT } from '../shared-constants';
import liff from '@line/liff';

// Mock @line/liff
vi.mock('@line/liff', () => ({
  default: {
    isInClient: vi.fn(),
    isLoggedIn: vi.fn(),
    getContext: vi.fn(),
    getProfile: vi.fn(),
    getIDToken: vi.fn(),
    logout: vi.fn(),
  },
}));

// Mock marked and dompurify to avoid complex parsing in tests
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn().mockResolvedValue('<p>Mock Terms Content</p>'),
  },
}));

vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html) => html),
  },
}));

describe('Terms Page', () => {
  let container: HTMLElement;
  const mockUserId = 'U1234567890';
  const mockIdToken = 'mock-id-token';
  const mockApiBaseUrl = 'http://localhost:8080';

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    // Reset mocks
    vi.clearAllMocks();

    // Suppress console.error for expected errors
    vi.spyOn(console, 'error').mockImplementation(() => { });

    // Mock window.location (Profile.test.ts と同様。Unsubscribe.test.ts は reload のみ)
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn(), href: '' },
      writable: true,
    });
    window.location.href = '';

    // Setup environment variables
    (window as any)._env_ = {
      VITE_API_BASE_URL: mockApiBaseUrl
    };

    // Setup global fetch
    global.fetch = vi.fn();

    // Default LIFF mock setup
    (liff.isInClient as any).mockReturnValue(true);
    (liff.isLoggedIn as any).mockReturnValue(true);
    (liff.getContext as any).mockReturnValue({ userId: mockUserId });
    (liff.getIDToken as any).mockReturnValue(mockIdToken);
  });

  afterEach(() => {
    // fake timers を使ったテストで assertion 失敗時も確実に復元する
    vi.useRealTimers();
    cleanupTermsAutoLogoutTimer();
    document.body.removeChild(container);
    (window as any)._env_ = {};
  });

  it('renders terms content and checks agreement status (not agreed)', async () => {
    // Mock fetch for terms.md
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      // Mock fetch for status API (termsAcceptedAt なし = 未同意)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ termsAcceptedAt: null }),
      });

    await renderTerms(container);

    // Check if terms content is rendered
    expect(container.innerHTML).toContain('Mock Terms Content');

    // Check if status API was called with correct headers
    expect(global.fetch).toHaveBeenCalledWith(
      `${mockApiBaseUrl}/api/users/${mockUserId}/status`,
      expect.objectContaining({
        headers: {
          'Authorization': `Bearer ${mockIdToken}`
        }
      })
    );

    // Check if agree button is shown
    const agreeBtn = container.querySelector('#agree-btn');
    expect(agreeBtn).toBeInTheDocument();
    expect(agreeBtn).toHaveTextContent('規約に同意する');
  });

  it('shows agreed message when termsAcceptedAt equals TERMS_UPDATED_AT (boundary: no re-consent)', async () => {
    // TERMS_UPDATED_AT と同日の同意日は「ちょうど同意済み」= 再同意不要
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ termsAcceptedAt: TERMS_UPDATED_AT }),
      });

    await renderTerms(container);

    expect(container.innerHTML).toContain('規約に同意済みです');
    expect(container.querySelector('#agree-btn')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('利用規約が更新されました');
  });

  it('handles agreement action correctly', async () => {
    // Mock fetch for terms.md
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      // Mock fetch for status API (termsAcceptedAt なし = 未同意)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ termsAcceptedAt: null }),
      });

    await renderTerms(container);

    const agreeBtn = container.querySelector('#agree-btn') as HTMLButtonElement;
    expect(agreeBtn).toBeInTheDocument();

    // Mock fetch for agreement POST
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'success' }),
    });

    // Click agree button
    agreeBtn.click();

    // Wait for async operations (click handler is async)
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check if agreement API was called with correct headers
    expect(global.fetch).toHaveBeenCalledWith(
      `${mockApiBaseUrl}/api/users/${mockUserId}/agreement`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockIdToken}`
        },
        body: JSON.stringify({ agreed: true })
      })
    );

    // Check if UI updated
    expect(container.innerHTML).toContain('規約に同意済みです');
  });

  it('shows re-consent button when termsAcceptedAt is older than TERMS_UPDATED_AT', async () => {
    // Mock fetch for terms.md
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      // 利用規約更新日より古い同意日を返す
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          // TERMS_UPDATED_AT より 1 日前: 環境変数で更新日が変わっても相対的に「古い」ことを保証
          termsAcceptedAt: new Date(new Date(TERMS_UPDATED_AT).getTime() - 24 * 60 * 60 * 1000).toISOString(),
        }),
      });

    await renderTerms(container);

    // 再同意ボタンが表示される
    const agreeBtn = container.querySelector('#agree-btn');
    expect(agreeBtn).toBeInTheDocument();
    expect(agreeBtn).toHaveTextContent('更新された規約に同意する');

    // 更新通知メッセージが表示される
    expect(container.innerHTML).toContain('利用規約が更新されました');
  });

  it('shows agreed message when termsAcceptedAt is newer than TERMS_UPDATED_AT', async () => {
    // Mock fetch for terms.md
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      // 利用規約更新日より新しい同意日を返す
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          // TERMS_UPDATED_AT より 1 日後: 環境変数で更新日が変わっても相対的に「新しい」ことを保証
          termsAcceptedAt: new Date(new Date(TERMS_UPDATED_AT).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      });

    await renderTerms(container);

    // 同意済みメッセージが表示される
    expect(container.innerHTML).toContain('規約に同意済みです');
    expect(container.querySelector('#agree-btn')).not.toBeInTheDocument();
  });

  it('shows initial consent button (not re-consent notice) when termsAcceptedAt is null', async () => {
    // termsAcceptedAt が null の場合は同意日の記録がないため未同意扱いとする。
    // このケースでは「利用規約が更新されました」という再同意メッセージは表示されず、
    // 通常の初回同意ボタンのみが表示されることを検証する。
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ termsAcceptedAt: null }),
      });

    await renderTerms(container);

    const agreeBtn = container.querySelector('#agree-btn');
    expect(agreeBtn).toBeInTheDocument();
    expect(agreeBtn).toHaveTextContent('規約に同意する');
    // 再同意通知（利用規約更新メッセージ）は表示されない
    expect(container.innerHTML).not.toContain('利用規約が更新されました');
    expect(container.innerHTML).not.toContain('更新された規約に同意する');
  });

  it('shows initial consent button (not re-consent notice) when termsAcceptedAt is invalid date string', async () => {
    // termsAcceptedAt が truthy だが Invalid Date の場合は初回同意扱いとする。
    // データ不正時に「利用規約が更新されました」という誤った再同意通知を表示しないことを検証する。
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ termsAcceptedAt: 'not-a-date' }),
      });

    await renderTerms(container);

    const agreeBtn = container.querySelector('#agree-btn');
    expect(agreeBtn).toBeInTheDocument();
    expect(agreeBtn).toHaveTextContent('規約に同意する');
    // 再同意通知（データ不正なのに「利用規約が更新されました」）は表示されない
    expect(container.innerHTML).not.toContain('利用規約が更新されました');
    expect(container.innerHTML).not.toContain('更新された規約に同意する');
  });

  it('shows error if ID token is missing', async () => {
    (liff.getIDToken as any).mockReturnValue(null);

    // Mock fetch for terms.md
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('# Terms'),
    });

    await renderTerms(container);

    // Should show error in agreement section
    expect(container.innerHTML).toContain('同意状況の確認中にエラーが発生しました');
  });

  it('shows session expired message with auto-logout when status API returns 401', async () => {
    // status API が 401 を返した場合（LINE ID トークン期限切れ）、
    // 再読み込みではトークンが更新されないため自動ログアウトで対応する。
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

    await renderTerms(container);

    expect(container.innerHTML).toContain('セッションが切れました');
    expect(container.innerHTML).toContain('3秒後に自動ログアウトします');
    expect(container.innerHTML).toContain('再ログインしてください');
    const logoutBtn = container.querySelector('#session-logout-btn') as HTMLButtonElement;
    expect(logoutBtn).toBeInTheDocument();
    expect(logoutBtn).toHaveTextContent('今すぐログアウト');
    // 汎用エラーメッセージは表示されない
    expect(container.innerHTML).not.toContain('同意状況の確認中にエラーが発生しました');
    // ログアウトボタンをクリックするとログアウトしてルートへ遷移する
    (liff.isLoggedIn as any).mockReturnValue(true);
    logoutBtn.click();
    expect(liff.logout).toHaveBeenCalled();
    expect(window.location.href).toBe('/');
  });

  it('401: auto-logout fires after 3 seconds when button not clicked', async () => {
    vi.useFakeTimers();
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });
    (liff.isLoggedIn as any).mockReturnValue(true);

    await renderTerms(container);

    expect(window.location.href).toBe('');

    vi.advanceTimersByTime(3000);

    expect(liff.logout).toHaveBeenCalled();
    expect(window.location.href).toBe('/');
  });

  it('401: clicking logout button cancels auto-logout timer', async () => {
    vi.useFakeTimers();
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });
    (liff.isLoggedIn as any).mockReturnValue(true);

    await renderTerms(container);

    const logoutBtn = container.querySelector('#session-logout-btn') as HTMLButtonElement;
    logoutBtn.click();

    expect(liff.logout).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('/');

    // タイマーが経過しても logout が重複して呼ばれない
    vi.advanceTimersByTime(3000);
    expect(liff.logout).toHaveBeenCalledTimes(1);
  });

  it('401: logout button navigates to root even when not logged in', async () => {
    // isLoggedIn() === false でも href='/' への遷移は実行されることを確認
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });
    (liff.isLoggedIn as any).mockReturnValue(false);

    await renderTerms(container);

    const logoutBtn = container.querySelector('#session-logout-btn') as HTMLButtonElement;
    logoutBtn.click();

    expect(liff.logout).not.toHaveBeenCalled();
    expect(window.location.href).toBe('/');
  });

  it('401: cleanupTermsAutoLogoutTimer cancels timer before page navigation', async () => {
    // ページ遷移時に router が cleanup を呼ぶことでタイマーが止まり、
    // 別ページ描画後に logout が発火しないことを確認する回帰テスト
    vi.useFakeTimers();
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });
    (liff.isLoggedIn as any).mockReturnValue(true);

    await renderTerms(container);

    // router によるページ遷移を模擬: cleanup を呼ぶ
    cleanupTermsAutoLogoutTimer();

    // 3秒経過しても logout は発火しない
    vi.advanceTimersByTime(3000);
    expect(liff.logout).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('back button navigates to profile page via replaceState', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ termsAcceptedAt: new Date().toISOString() }),
      });

    await renderTerms(container);

    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    const backBtn = container.querySelector('#back-btn') as HTMLButtonElement;
    expect(backBtn).toBeInTheDocument();
    backBtn.click();

    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/profile/me');
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
  });
});
