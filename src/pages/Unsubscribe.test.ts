import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderUnsubscribe, renderUnsubscribeComplete, cleanupUnsubscribeTimer } from '../pages/Unsubscribe';
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

// Mock marked and dompurify
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn().mockResolvedValue('<p>Mock Unsubscribe Content</p>'),
  },
}));

vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html) => html),
  },
}));

describe('Unsubscribe Page', () => {
  let container: HTMLElement;
  const mockUserId = 'U1234567890';
  const mockIdToken = 'mock-id-token';

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    // Reset mocks
    vi.clearAllMocks();

    // Suppress console.error / console.warn for expected errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Setup global fetch
    global.fetch = vi.fn();

    // Mock window methods
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn(), href: '' },
      writable: true,
    });
    window.location.href = '';

    // Default LIFF mock setup
    (liff.isInClient as any).mockReturnValue(true);
    (liff.isLoggedIn as any).mockReturnValue(true);
    (liff.getContext as any).mockReturnValue({ userId: mockUserId });
    (liff.getIDToken as any).mockReturnValue(mockIdToken);
  });

  afterEach(() => {
    // fake timers を使ったテストで assertion 失敗時も確実に復元する
    vi.useRealTimers();
    cleanupUnsubscribeTimer();
    document.body.removeChild(container);
  });

  describe('renderUnsubscribe', () => {
    it('renders unsubscribe content', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      expect(container.innerHTML).toContain('Mock Unsubscribe Content');
      expect(container.querySelector('#unsubscribe-action')).toBeInTheDocument();
      expect(container.querySelector('#unsubscribe-btn')).toBeInTheDocument();
      expect(container.querySelector('#back-btn')).toBeInTheDocument();
    });

    it('handles back button', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      const backSpy = vi.spyOn(window.history, 'back');
      const backBtn = container.querySelector('#back-btn') as HTMLButtonElement;
      backBtn.click();

      expect(backSpy).toHaveBeenCalled();
    });

    it('handles unsubscribe button (navigation to complete)', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      const pushStateSpy = vi.spyOn(window.history, 'pushState');
      const unsubscribeBtn = container.querySelector('#unsubscribe-btn') as HTMLButtonElement;
      unsubscribeBtn.click();

      expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/unsubscribe/complete');
    });

    it('shows error on fetch failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
      });

      await renderUnsubscribe(container);

      expect(container.innerHTML).toContain('ページの表示中にエラーが発生しました');
    });

    it('shows session expired when idToken is null at page load', async () => {
      // ページ表示時点でトークンが期限切れ → セッション切れ UI を表示する
      (liff.getIDToken as any).mockReturnValue(null);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      expect(container.innerHTML).toContain('セッションが切れました');
      expect(container.innerHTML).toContain('3秒後に自動ログアウトします');
      expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
      const logoutBtn = container.querySelector('#session-logout-btn') as HTMLButtonElement;
      expect(logoutBtn).toBeInTheDocument();
      expect(logoutBtn).toHaveTextContent('今すぐログアウト');
      // 「キャンセルして戻る」ボタンが非表示になる
      const backBtn = container.querySelector('#back-btn') as HTMLButtonElement;
      expect(backBtn).not.toBeVisible();
      // 退会ボタンは表示されない（action エリアが差し替わっている）
      expect(container.querySelector('#unsubscribe-btn')).not.toBeInTheDocument();
    });

    it('falls back to getProfile when context.userId is empty and renders normally', async () => {
      // 外部ブラウザ環境: getContext().userId が空 → getProfile() でフォールバック成功
      (liff.getContext as any).mockReturnValue({ userId: '' });
      (liff.getProfile as any).mockResolvedValue({ userId: mockUserId });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      // 正常描画: 退会ボタンが表示される
      expect(container.querySelector('#unsubscribe-btn')).toBeInTheDocument();
      expect(container.querySelector('#session-logout-btn')).not.toBeInTheDocument();
    });

    it('shows session expired when context.userId is empty and idToken is null (external browser + expired token)', async () => {
      // 外部ブラウザかつトークン失効: getProfile() より先に SESSION_EXPIRED をスロー
      (liff.getContext as any).mockReturnValue({ userId: '' });
      (liff.getIDToken as any).mockReturnValue(null);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      // getProfile() は呼ばれない
      expect(liff.getProfile).not.toHaveBeenCalled();
      // セッション切れ UI が表示される
      expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
      expect(container.innerHTML).toContain('セッションが切れました');
    });

    it('shows user info error when context.userId is empty and getProfile fails (non-session reason)', async () => {
      // 外部ブラウザかつ idToken は有効だが getProfile が別の理由で失敗
      (liff.getContext as any).mockReturnValue({ userId: '' });
      (liff.getProfile as any).mockRejectedValue(new Error('Network error'));
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      // 汎用エラーが表示され、セッション切れ UI は表示されない
      expect(container.innerHTML).toContain('ユーザー情報の取得に失敗しました');
      expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
    });

    it('shows session expired when idToken becomes null at button click time', async () => {
      // ページ読み込み時はトークンあり → ボタン押下時に期限切れ
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      // ボタン押下前にトークンを null に差し替える
      (liff.getIDToken as any).mockReturnValue(null);

      const unsubscribeBtn = container.querySelector('#unsubscribe-btn') as HTMLButtonElement;
      unsubscribeBtn.click();

      expect(container.innerHTML).toContain('セッションが切れました');
      expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
      expect(container.querySelector('#session-logout-btn')).toBeInTheDocument();
      const backBtn = container.querySelector('#back-btn') as HTMLButtonElement;
      expect(backBtn).not.toBeVisible();
    });

    it('401: auto-logout fires after 3 seconds when button not clicked', async () => {
      vi.useFakeTimers();
      (liff.getIDToken as any).mockReturnValue(null);
      (liff.isLoggedIn as any).mockReturnValue(true);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      expect(window.location.href).toBe('');

      vi.advanceTimersByTime(3000);

      expect(liff.logout).toHaveBeenCalled();
      expect(window.location.href).toBe('/');
    });

    it('401: clicking logout button cancels auto-logout timer', async () => {
      vi.useFakeTimers();
      (liff.getIDToken as any).mockReturnValue(null);
      (liff.isLoggedIn as any).mockReturnValue(true);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      const logoutBtn = container.querySelector('#session-logout-btn') as HTMLButtonElement;
      logoutBtn.click();

      expect(liff.logout).toHaveBeenCalledTimes(1);
      expect(window.location.href).toBe('/');

      // タイマーが経過しても logout が重複して呼ばれない
      vi.advanceTimersByTime(3000);
      expect(liff.logout).toHaveBeenCalledTimes(1);
    });

    it('401: logout button navigates to root even when not logged in', async () => {
      (liff.getIDToken as any).mockReturnValue(null);
      (liff.isLoggedIn as any).mockReturnValue(false);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      const logoutBtn = container.querySelector('#session-logout-btn') as HTMLButtonElement;
      logoutBtn.click();

      expect(liff.logout).not.toHaveBeenCalled();
      expect(window.location.href).toBe('/');
    });

    it('401: cleanupUnsubscribeTimer cancels auto-logout timer before page navigation', async () => {
      // ページ遷移時に router が cleanup を呼ぶことでタイマーが止まり、
      // 別ページ描画後に logout が発火しないことを確認する回帰テスト
      vi.useFakeTimers();
      (liff.getIDToken as any).mockReturnValue(null);
      (liff.isLoggedIn as any).mockReturnValue(true);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      // router によるページ遷移を模擬: cleanup を呼ぶ
      cleanupUnsubscribeTimer();

      // 3秒経過しても logout は発火しない
      vi.advanceTimersByTime(3000);
      expect(liff.logout).not.toHaveBeenCalled();
      expect(window.location.href).toBe('');
    });
  });

  describe('renderUnsubscribeComplete', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      (liff.isLoggedIn as any).mockReturnValue(true);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('renders completion message and countdown', () => {
      renderUnsubscribeComplete(container);

      expect(container.innerHTML).toContain('退会が完了しました');
      expect(container.innerHTML).toContain('3'); // Initial countdown
    });

    it('counts down and logs out', () => {
      renderUnsubscribeComplete(container);

      // Advance 1 second
      vi.advanceTimersByTime(1000);
      expect(container.innerHTML).toContain('2');

      // Advance 1 second
      vi.advanceTimersByTime(1000);
      expect(container.innerHTML).toContain('1');

      // Advance 1 second (total 3) -> should trigger logout
      vi.advanceTimersByTime(1000);

      expect(liff.logout).toHaveBeenCalled();
      expect(window.location.reload).toHaveBeenCalled();
    });

    it('cleans up timer on manual cleanup', () => {
      renderUnsubscribeComplete(container);

      cleanupUnsubscribeTimer();

      // Advance time, nothing should happen
      vi.advanceTimersByTime(3000);

      expect(liff.logout).not.toHaveBeenCalled();
    });
  });
});
