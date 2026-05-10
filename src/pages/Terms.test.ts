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
    // 年齢確認も済んでいる場合に完了メッセージが表示されることを確認
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          termsAcceptedAt: TERMS_UPDATED_AT,
          ageVerifiedAt: new Date().toISOString(),
        }),
      });

    await renderTerms(container);

    expect(container.innerHTML).toContain('規約に同意・年齢確認済みです');
    expect(container.querySelector('#agree-btn')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('利用規約が更新されました');
  });

  it('handles agreement action correctly (age verified, terms pending)', async () => {
    // 年齢確認済みだが規約未同意のユーザーが同意ボタンをクリックする正常系
    // - ボタンは有効（ageVerifiedAt 設定済みのため）
    // - POST ボディに ageVerified: true が含まれる（hasAgeVerified=true のため）
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          termsAcceptedAt: null,
          ageVerifiedAt: new Date().toISOString(),
        }),
      });

    await renderTerms(container);

    const agreeBtn = container.querySelector('#agree-btn') as HTMLButtonElement;
    expect(agreeBtn).toBeInTheDocument();
    expect(agreeBtn).not.toBeDisabled();

    // Mock fetch for agreement POST
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'success' }),
    });

    // Click agree button
    agreeBtn.click();

    // Wait for async operations (click handler is async)
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check if agreement API was called with correct body (ageVerified: true because hasAgeVerified=true)
    expect(global.fetch).toHaveBeenCalledWith(
      `${mockApiBaseUrl}/api/users/${mockUserId}/agreement`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockIdToken}`
        },
        body: JSON.stringify({ agreed: true, ageVerified: true })
      })
    );

    // Check if UI updated to completion message
    expect(container.innerHTML).toContain('規約に同意・年齢確認済みです');
  });

  it('shows session expired auto-logout when agreement POST returns 401', async () => {
    // 利用規約を読んでいる間にトークンが切れて POST /agreement が 401 を返すケース
    // 年齢確認済み（ageVerifiedAt 設定）のためボタンは有効状態
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          termsAcceptedAt: null,
          ageVerifiedAt: new Date().toISOString(),
        }),
      });

    await renderTerms(container);

    const agreeBtn = container.querySelector('#agree-btn') as HTMLButtonElement;
    expect(agreeBtn).toBeInTheDocument();

    // POST /agreement が 401 を返す
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });
    (liff.isLoggedIn as any).mockReturnValue(true);

    agreeBtn.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    // セッション切れ UI に切り替わる
    expect(container.innerHTML).toContain('セッションが切れました');
    expect(container.innerHTML).toContain('3秒後に自動ログアウトします');
    // ページ上部に sticky バナーが表示される
    const topBanner = container.querySelector('#session-expired-top-banner') as HTMLElement;
    expect(topBanner).toBeInTheDocument();
    expect(topBanner).toHaveAttribute('role', 'alert');
    // 上部・下部両方にログアウトボタンがある
    expect(container.querySelector('#session-logout-btn-top')).toBeInTheDocument();
    expect(container.querySelector('#session-logout-btn')).toBeInTheDocument();
    // 「プロフィールに戻る」ボタンが非表示になる
    const backBtn = container.querySelector('#back-btn') as HTMLButtonElement;
    expect(backBtn).not.toBeVisible();
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
    // 利用規約更新日より新しい同意日かつ年齢確認済みの場合に完了メッセージが表示される
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          // TERMS_UPDATED_AT より 1 日後: 環境変数で更新日が変わっても相対的に「新しい」ことを保証
          termsAcceptedAt: new Date(new Date(TERMS_UPDATED_AT).getTime() + 24 * 60 * 60 * 1000).toISOString(),
          ageVerifiedAt: new Date().toISOString(),
        }),
      });

    await renderTerms(container);

    // 同意・年齢確認済みメッセージが表示される
    expect(container.innerHTML).toContain('規約に同意・年齢確認済みです');
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
    // ページ上部に sticky バナーが表示される
    const topBanner = container.querySelector('#session-expired-top-banner') as HTMLElement;
    expect(topBanner).toBeInTheDocument();
    // スクリーンリーダー向け role="alert" は上部バナーに付与されている
    expect(topBanner).toHaveAttribute('role', 'alert');
    expect(topBanner).toHaveAttribute('aria-live', 'assertive');
    // 上部バナーにログアウトボタンがある
    const topLogoutBtn = container.querySelector('#session-logout-btn-top') as HTMLButtonElement;
    expect(topLogoutBtn).toBeInTheDocument();
    expect(topLogoutBtn).toHaveTextContent('今すぐログアウト');
    // 下部にもログアウトボタンがある
    const logoutBtn = container.querySelector('#session-logout-btn') as HTMLButtonElement;
    expect(logoutBtn).toBeInTheDocument();
    expect(logoutBtn).toHaveTextContent('今すぐログアウト');
    // 汎用エラーメッセージは表示されない
    expect(container.innerHTML).not.toContain('同意状況の確認中にエラーが発生しました');
    // 401 時は「プロフィールに戻る」ボタンが非表示になる
    const backBtn = container.querySelector('#back-btn') as HTMLButtonElement;
    expect(backBtn).not.toBeVisible();
    // 下部ログアウトボタンをクリックするとログアウトしてルートへ遷移する
    (liff.isLoggedIn as any).mockReturnValue(true);
    logoutBtn.click();
    expect(liff.logout).toHaveBeenCalled();
    expect(window.location.href).toBe('/');
  });

  it('401: session expired UI moves focus to sticky top banner logout button for keyboard/a11y users', async () => {
    // agreementSection の innerHTML 差し替え後、フォーカスが sticky 上部バナーの
    // #session-logout-btn-top へ移動することを確認する。
    // 下部の #session-logout-btn へのフォーカスは長い利用規約コンテンツの末尾へ自動スクロールを
    // 引き起こすため、常にビューポート上部に表示されている上部バナーのボタンへフォーカスする。
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

    const topLogoutBtn = container.querySelector('#session-logout-btn-top') as HTMLButtonElement;
    expect(topLogoutBtn).toBeInTheDocument();
    expect(topLogoutBtn).toHaveFocus();
    // 下部ボタンも存在するが、フォーカスは上部バナーに移動している
    expect(container.querySelector('#session-logout-btn')).toBeInTheDocument();
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

  it('401: top banner logout button cancels timer and navigates to root', async () => {
    // 上部バナーのログアウトボタンでもタイマーキャンセル＆ルート遷移が正しく動作することを確認
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

    const topLogoutBtn = container.querySelector('#session-logout-btn-top') as HTMLButtonElement;
    expect(topLogoutBtn).toBeInTheDocument();
    topLogoutBtn.click();

    expect(liff.logout).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('/');

    // タイマーが経過しても logout が重複して呼ばれない
    vi.advanceTimersByTime(3000);
    expect(liff.logout).toHaveBeenCalledTimes(1);
  });

  it('401: top session expired banner is NOT shown in normal (non-401) render', async () => {
    // 通常表示（セッション切れなし）ではページ上部にバナーが表示されないことを確認
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

    expect(container.querySelector('#session-expired-top-banner')).not.toBeInTheDocument();
    expect(container.querySelector('#session-logout-btn-top')).not.toBeInTheDocument();
    // 通常の同意ボタンは表示される
    expect(container.querySelector('#agree-btn')).toBeInTheDocument();
  });

  it('401: doLogout is not called twice when timer fires and top/bottom buttons clicked simultaneously', async () => {
    // Terms には上部・下部の 2 ボタンがあるため、タイマー満了＋ボタン連打でも
    // liff.logout() が二重実行されないことを確認する
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

    // タイマー満了 → doLogout() 1回目
    vi.advanceTimersByTime(3000);
    expect(liff.logout).toHaveBeenCalledTimes(1);

    // 上部ボタン・下部ボタン連打 → hasLoggedOut ガードで skip
    const topBtn = container.querySelector('#session-logout-btn-top') as HTMLButtonElement;
    const bottomBtn = container.querySelector('#session-logout-btn') as HTMLButtonElement;
    topBtn.click();
    bottomBtn.click();
    expect(liff.logout).toHaveBeenCalledTimes(1); // 重複しない
  });

  it('age verification: agree button is disabled until checkbox is checked', async () => {
    // needsAge=true のとき同意ボタンが disabled で始まり、チェック後に有効化される
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ termsAcceptedAt: null, ageVerifiedAt: null }),
      });

    await renderTerms(container);

    const agreeBtn = container.querySelector('#agree-btn') as HTMLButtonElement;
    expect(agreeBtn).toBeInTheDocument();
    expect(agreeBtn).toBeDisabled();
    expect(agreeBtn).toHaveStyle({ cursor: 'not-allowed' });

    const ageCheck = container.querySelector('#age-check') as HTMLInputElement;
    expect(ageCheck).toBeInTheDocument();

    // チェックボックスにチェックを入れるとボタンが有効化される
    ageCheck.checked = true;
    ageCheck.dispatchEvent(new Event('change'));

    expect(agreeBtn).not.toBeDisabled();
    expect(agreeBtn).toHaveStyle({ cursor: 'pointer' });

    // ボタンをクリックすると ageVerified: true が /agreement に送信される
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'success' }),
    });

    agreeBtn.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(global.fetch).toHaveBeenCalledWith(
      `${mockApiBaseUrl}/api/users/${mockUserId}/agreement`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ agreed: true, ageVerified: true })
      })
    );
    expect(container.innerHTML).toContain('規約に同意・年齢確認済みです');
  });

  it('age verification: no checkbox shown when ageVerifiedAt is already set', async () => {
    // ageVerifiedAt が設定済みの場合はチェックボックスが表示されない
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          termsAcceptedAt: null,
          ageVerifiedAt: new Date().toISOString(),
        }),
      });

    await renderTerms(container);

    expect(container.querySelector('#age-check')).not.toBeInTheDocument();
    // ボタンは有効（年齢確認不要のため）
    const agreeBtn = container.querySelector('#agree-btn') as HTMLButtonElement;
    expect(agreeBtn).toBeInTheDocument();
    expect(agreeBtn).not.toBeDisabled();
    expect(agreeBtn).toHaveTextContent('規約に同意する');
  });

  it('age verification: shows age-only form for existing user (terms ok, age pending)', async () => {
    // 規約は同意済み・年齢確認のみ未完了の場合、年齢確認専用の通知とボタンが表示される
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Terms'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          termsAcceptedAt: new Date().toISOString(),
          ageVerifiedAt: null,
        }),
      });

    await renderTerms(container);

    // 年齢確認通知が表示される
    expect(container.innerHTML).toContain('年齢確認が必要です');
    // チェックボックスが表示される
    expect(container.querySelector('#age-check')).toBeInTheDocument();
    // ボタンラベルが「年齢確認する」
    const agreeBtn = container.querySelector('#agree-btn') as HTMLButtonElement;
    expect(agreeBtn).toHaveTextContent('年齢確認する');
    // 最初は無効
    expect(agreeBtn).toBeDisabled();
    // 再同意通知は表示されない
    expect(container.innerHTML).not.toContain('利用規約が更新されました');
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
