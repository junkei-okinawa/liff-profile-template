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

    // clearAllMocks() で呼び出し履歴・インスタンス・結果をリセットする。
    // resetAllMocks() は vi.mock() で定義したモジュールモック（marked.parse 等）の実装も
    // リセットしてしまうため使用しない。
    // getProfile 等テストごとに差し替える実装の漏れは、
    // 下記でデフォルト実装を beforeEach 内に明示することで対処する。
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
    // getProfile のデフォルト実装を明示し、テスト間の実装漏れを防ぐ
    (liff.getProfile as any).mockResolvedValue({ userId: mockUserId });
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
      expect(container.querySelector('#back-btn')).toBeInTheDocument();
      // セッション確認完了後にボタンが有効化され「退会する」になっていることを確認
      const btn = container.querySelector('#unsubscribe-btn') as HTMLButtonElement;
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
      expect(btn).toHaveTextContent('退会する');
    });

    it('handles back button via replaceState to profile page', async () => {
      // history.back() は BOT URL 等から直接アクセスした場合に履歴がなく機能しないため、
      // Terms と同様に replaceState('/profile/me') + popstate イベントを使う。
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
      const popstateSpy = vi.fn();
      window.addEventListener('popstate', popstateSpy);

      const backBtn = container.querySelector('#back-btn') as HTMLButtonElement;
      backBtn.click();

      expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/profile/me');
      expect(popstateSpy).toHaveBeenCalled();

      window.removeEventListener('popstate', popstateSpy);
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
      // ページ表示時点でトークンが期限切れ → fetch より前にセッション切れ UI を表示する
      (liff.getIDToken as any).mockReturnValue(null);

      await renderUnsubscribe(container);

      // fetch は呼ばれない（早期リターン）
      expect(global.fetch).not.toHaveBeenCalled();
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
      // 外部ブラウザかつトークン失効: fetch より前に早期リターン（getProfile() も呼ばれない）
      (liff.getContext as any).mockReturnValue({ userId: '' });
      (liff.getIDToken as any).mockReturnValue(null);

      await renderUnsubscribe(container);

      // fetch は呼ばれない（早期リターン）
      expect(global.fetch).not.toHaveBeenCalled();
      // getProfile() は呼ばれない
      expect(liff.getProfile).not.toHaveBeenCalled();
      // セッション切れ UI が表示される
      expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
      expect(container.innerHTML).toContain('セッションが切れました');
    });

    it('shows session expired when token expires during getProfile() call', async () => {
      // getProfile() の非同期待機中にセッションが失効するケース。
      // catch ブロック内で getIDToken() を再確認し、null なら SessionExpiredError をスローする。
      (liff.getContext as any).mockReturnValue({ userId: '' });
      // getProfile() が失敗し、かつその時点でトークンが失効している状態を模擬
      (liff.getProfile as any).mockImplementation(async () => {
        (liff.getIDToken as any).mockReturnValue(null); // 待機中に失効
        throw new Error('token expired during call');
      });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      // 汎用エラーではなくセッション切れ UI が表示される
      expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
      expect(container.innerHTML).toContain('セッションが切れました');
      expect(container.innerHTML).not.toContain('ユーザー情報の取得に失敗しました');
    });

    it('shows session expired when token expires after getProfile() succeeds', async () => {
      // getProfile() は成功したが完了直後にトークンが失効するケース。
      // getUserIdAndToken() 末尾の freshIdToken 再取得で SessionExpiredError をスローする。
      (liff.getContext as any).mockReturnValue({ userId: '' });
      (liff.getProfile as any).mockImplementation(async () => {
        (liff.getIDToken as any).mockReturnValue(null); // getProfile 完了直後に失効
        return { userId: mockUserId };
      });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      // 汎用エラーではなくセッション切れ UI が表示される
      expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
      expect(container.innerHTML).toContain('セッションが切れました');
      expect(container.innerHTML).not.toContain('ユーザー情報の取得に失敗しました');
    });

    it('no unhandledrejection when getUserIdAndToken rejects before markdown fetch completes', async () => {
      // getUserIdAndToken() が fetch 完了前に reject した場合、
      // 作成直後の .catch(() => {}) により unhandledrejection が発生しないことを確認する。
      // 早期チェック（renderUnsubscribe 先頭）はパス、getUserIdAndToken 内で失効する状況を作る。
      (liff.getIDToken as any)
        .mockReturnValueOnce(mockIdToken) // renderUnsubscribe 先頭の早期チェックは通過
        .mockReturnValue(null);           // getUserIdAndToken() 内の確認で失効を検知

      // fetch は pending のまま（getUserIdAndToken が先に reject する状況）
      let resolveFetch!: (v: object) => void;
      (global.fetch as any).mockReturnValueOnce(
        new Promise(resolve => { resolveFetch = resolve; })
      );

      const unhandledRejections: PromiseRejectionEvent[] = [];
      const handler = (e: PromiseRejectionEvent) => { e.preventDefault(); unhandledRejections.push(e); };
      window.addEventListener('unhandledrejection', handler);

      // renderUnsubscribe 開始（await しない）
      const renderPromise = renderUnsubscribe(container);

      // マイクロタスクを複数回消化し、getUserIdAndToken が reject できる機会を与える
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // fetch がまだ pending の間に unhandledrejection が発生していないことを確認
      expect(unhandledRejections).toHaveLength(0);

      // fetch を完了させる
      resolveFetch({ ok: true, text: () => Promise.resolve('# Unsubscribe Info') });
      await renderPromise;

      window.removeEventListener('unhandledrejection', handler);

      // fetch 完了後、セッション切れ UI が正しく表示されている
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

    it('shows user info error when both context and getProfile return empty userId', async () => {
      // getContext().userId も getProfile().userId も空の場合、
      // 「無効なユーザーID」エラーを経てユーザー情報取得失敗メッセージを表示する。
      // この防御バリデーションが将来削除された場合にテストで検知できるよう押さえる。
      (liff.getContext as any).mockReturnValue({ userId: '' });
      (liff.getProfile as any).mockResolvedValue({ userId: '' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      expect(container.innerHTML).toContain('ユーザー情報の取得に失敗しました');
      // セッション切れ UI は表示されない
      expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
      // 退会ボタンは表示されない
      expect(container.querySelector('#unsubscribe-btn')).not.toBeInTheDocument();
    });

    it('shows user info error when getProfile returns whitespace-only userId', async () => {
      // userId.trim() === '' のバリデーションが有効であることを確認する。
      // 将来 trim() チェックが外れた場合にこのテストで検知できる。
      (liff.getContext as any).mockReturnValue({ userId: '' });
      (liff.getProfile as any).mockResolvedValue({ userId: '   ' }); // 空白のみ
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      expect(container.innerHTML).toContain('ユーザー情報の取得に失敗しました');
      // セッション切れ UI は表示されない
      expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
      // 退会ボタンは表示されない
      expect(container.querySelector('#unsubscribe-btn')).not.toBeInTheDocument();
    });

    it('shows session expired when isLoggedIn and isInClient are both false (SPA navigation after session expiry)', async () => {
      // SPA 遷移では initLiff() が再実行されないため、
      // isLoggedIn()/isInClient() が false のまま /unsubscribe に遷移するケースがある。
      // idToken が null であれば fetch より前に早期リターンし自動ログアウト UI を表示する。
      (liff.isInClient as any).mockReturnValue(false);
      (liff.isLoggedIn as any).mockReturnValue(false);
      (liff.getIDToken as any).mockReturnValue(null);

      await renderUnsubscribe(container);

      // fetch は呼ばれない（早期リターン）
      expect(global.fetch).not.toHaveBeenCalled();
      expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
      expect(container.innerHTML).toContain('セッションが切れました');
      // getContext / getProfile は呼ばれない
      expect(liff.getContext).not.toHaveBeenCalled();
      expect(liff.getProfile).not.toHaveBeenCalled();
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

    it('session expired UI moves focus to logout button for keyboard/a11y users', async () => {
      // #unsubscribe-btn の innerHTML 差し替え後、フォーカスが #session-logout-btn へ移動することを確認する。
      // キーボード操作・支援技術の利用者が次の操作先を見失わないようにするための a11y テスト。
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      (liff.getIDToken as any).mockReturnValue(null);

      const unsubscribeBtn = container.querySelector('#unsubscribe-btn') as HTMLButtonElement;
      unsubscribeBtn.click();

      const logoutBtn = container.querySelector('#session-logout-btn') as HTMLButtonElement;
      expect(logoutBtn).toBeInTheDocument();
      expect(logoutBtn).toHaveFocus();
    });

    it('stale render result does not overwrite DOM when second render starts before first completes', async () => {
      // レースコンディション再現:
      // 1. 第1レンダーが getUserIdAndToken() で getProfile() を待機中
      // 2. ルーターが画面遷移 → 第2レンダーが開始
      // 3. 第1レンダーの getProfile() が失敗 → _renderToken 不一致のため DOM 書き換えをスキップする
      (liff.getContext as any).mockReturnValue({ userId: '' });

      // getProfile が外から制御可能なプロミスを返すよう設定する
      let rejectGetProfile!: (e: Error) => void;
      (liff.getProfile as any).mockImplementation(
        () => new Promise<never>((_, reject) => { rejectGetProfile = reject; })
      );

      // 第1レンダーのフェッチ
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      // 第1レンダーを開始（await しない）
      const firstRender = renderUnsubscribe(container);

      // マイクロタスクを消化して fetch + HTML 描画まで進める
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // 第2レンダー開始（ルーターが /unsubscribe へ再遷移したケースを模擬）
      (liff.getContext as any).mockReturnValue({ userId: mockUserId });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });
      await renderUnsubscribe(container);

      // 第2レンダー成功: ボタンが有効化されている
      const btn = container.querySelector<HTMLButtonElement>('#unsubscribe-btn');
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
      expect(btn).toHaveTextContent('退会する');

      // 第1レンダーの getProfile が遅れて失敗しても DOM を上書きしない
      rejectGetProfile(new Error('delayed network failure'));
      await firstRender;

      // 第2レンダーの成功状態が維持される
      expect(container.innerHTML).not.toContain('ユーザー情報の取得に失敗しました');
      expect(container.querySelector('#unsubscribe-btn')).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });

    it('stale render: old render succeeding late does not enable button or overwrite DOM (success path guard)', async () => {
      // 第1レンダーの getUserIdAndToken() が遅れて「成功」した場合も _renderToken ガードで DOM 更新を防ぐ。
      // 既存テストは失敗ケースのみカバーしているため、成功経路の回帰も押さえる。
      (liff.getContext as any).mockReturnValue({ userId: '' });

      let resolveGetProfile!: (v: { userId: string }) => void;
      (liff.getProfile as any).mockImplementation(
        () => new Promise<{ userId: string }>(resolve => { resolveGetProfile = resolve; })
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      // 第1レンダーを開始（await しない）
      const firstRender = renderUnsubscribe(container);

      // マイクロタスクを消化して fetch + HTML 描画まで進める
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // ページ離脱: ルーターが cleanupUnsubscribeTimer() を呼び、別ページを描画する
      cleanupUnsubscribeTimer();
      container.innerHTML = '<div id="other-page">別のページ</div>';

      // 遅れて getProfile が「成功」→ DOM を上書きしてはいけない
      resolveGetProfile({ userId: mockUserId });
      await firstRender;

      // 別ページのコンテンツが維持されている（退会ボタンが有効化されていない）
      expect(container.innerHTML).toContain('別のページ');
      expect(container.querySelector('#unsubscribe-btn')).not.toBeInTheDocument();
    });

    it('cleanupUnsubscribeTimer invalidates in-progress render so stale result does not overwrite other pages', async () => {
      // ルーターがページ離脱時に cleanupUnsubscribeTimer() を呼ぶことで
      // 進行中の getUserIdAndToken() が完了しても別ページの DOM を上書きしないことを確認する。
      // （renderUnsubscribe() が2回目呼ばれない「別ページへの遷移」ケース）
      (liff.getContext as any).mockReturnValue({ userId: '' });

      let rejectGetProfile!: (e: Error) => void;
      (liff.getProfile as any).mockImplementation(
        () => new Promise<never>((_, reject) => { rejectGetProfile = reject; })
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      // レンダー開始（await しない）
      const renderPromise = renderUnsubscribe(container);

      // マイクロタスクを消化して fetch + HTML 描画まで進める
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // ページ離脱: ルーターが cleanupUnsubscribeTimer() を呼び、別ページを描画する
      cleanupUnsubscribeTimer();
      container.innerHTML = '<div id="other-page">別のページ</div>';

      // 遅れて getProfile が失敗 → DOM を上書きしてはいけない
      rejectGetProfile(new Error('delayed failure'));
      await renderPromise;

      // 別ページのコンテンツが維持されている
      expect(container.innerHTML).toContain('別のページ');
      expect(container.innerHTML).not.toContain('ユーザー情報の取得に失敗しました');
      expect(container.innerHTML).not.toContain('退会する');
    });

    it('session expired: auto-logout fires after 3 seconds when button not clicked', async () => {
      vi.useFakeTimers();
      (liff.getIDToken as any).mockReturnValue(null);
      (liff.isLoggedIn as any).mockReturnValue(true);

      await renderUnsubscribe(container);

      expect(window.location.href).toBe('');

      vi.advanceTimersByTime(3000);

      expect(liff.logout).toHaveBeenCalled();
      expect(window.location.href).toBe('/');
    });

    it('session expired: clicking logout button cancels auto-logout timer', async () => {
      vi.useFakeTimers();
      (liff.getIDToken as any).mockReturnValue(null);
      (liff.isLoggedIn as any).mockReturnValue(true);

      await renderUnsubscribe(container);

      const logoutBtn = container.querySelector('#session-logout-btn') as HTMLButtonElement;
      logoutBtn.click();

      expect(liff.logout).toHaveBeenCalledTimes(1);
      expect(window.location.href).toBe('/');

      // タイマーが経過しても logout が重複して呼ばれない
      vi.advanceTimersByTime(3000);
      expect(liff.logout).toHaveBeenCalledTimes(1);
    });

    it('session expired: logout button navigates to root even when not logged in', async () => {
      (liff.getIDToken as any).mockReturnValue(null);
      (liff.isLoggedIn as any).mockReturnValue(false);

      await renderUnsubscribe(container);

      const logoutBtn = container.querySelector('#session-logout-btn') as HTMLButtonElement;
      logoutBtn.click();

      expect(liff.logout).not.toHaveBeenCalled();
      expect(window.location.href).toBe('/');
    });

    it('session expired: doLogout is not called twice when timer fires and button is clicked simultaneously', async () => {
      // タイマー満了とボタンクリックが重なっても liff.logout() が二重呼び出しされないことを確認
      vi.useFakeTimers();
      (liff.getIDToken as any).mockReturnValue(null);
      (liff.isLoggedIn as any).mockReturnValue(true);

      await renderUnsubscribe(container);

      // タイマー満了 → doLogout() 1回目
      vi.advanceTimersByTime(3000);
      expect(liff.logout).toHaveBeenCalledTimes(1);

      // タイマー満了直後にボタンクリック → hasLoggedOut ガードで skip
      const logoutBtn = container.querySelector('#session-logout-btn') as HTMLButtonElement;
      logoutBtn.click();
      expect(liff.logout).toHaveBeenCalledTimes(1); // 重複しない
    });

    it('session expired: cleanupUnsubscribeTimer cancels auto-logout timer before page navigation', async () => {
      // ページ遷移時に router が cleanup を呼ぶことでタイマーが止まり、
      // 別ページ描画後に logout が発火しないことを確認する回帰テスト
      vi.useFakeTimers();
      (liff.getIDToken as any).mockReturnValue(null);
      (liff.isLoggedIn as any).mockReturnValue(true);

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
