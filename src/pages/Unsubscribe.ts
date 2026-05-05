import { marked } from 'marked';
import DOMPurify from 'dompurify';
import liff from '@line/liff';
import { buildSessionExpiredHtml } from '../utils/session-ui';

// SESSION_EXPIRED を文字列比較ではなく instanceof で判定するための専用エラー型。
// 文言変更やラップされた例外によって自動ログアウト導線が壊れるリスクを排除する。
class SessionExpiredError extends Error {
  constructor() {
    super('SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

// module スコープでセッション切れ自動ログアウトタイマーIDを保持する。
// ページ遷移時にルーターから cleanupUnsubscribeTimer() を呼ぶことで
// 別ページ描画後にタイマーが発火してしまう問題を防ぐ。
let _autoLogoutTimer: ReturnType<typeof setTimeout> | null = null;

// Global variable to track the interval so it can be cleaned up
let countdownInterval: ReturnType<typeof setInterval> | null = null;

// getUserIdAndToken() のタイムアウトタイマーID。
// fetch 成功後に userInfoPromise を待機する際、getProfile() がハングしても
// USER_INFO_TIMEOUT_MS 後に自動解除するために使用する。
// cleanupUnsubscribeTimer() でページ遷移時にも解除できるよう module スコープで保持する。
let _userInfoTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

// レンダートークン: renderUnsubscribe() が呼ばれるたびにインクリメントする。
// getUserIdAndToken() 等の非同期処理が完了した時点で最新のトークンと一致するか確認し、
// 古いレンダーの結果が新しいページの DOM を上書きするレースコンディションを防ぐ。
let _renderToken = 0;

export const cleanupUnsubscribeTimer = (): void => {
  // _renderToken をインクリメントして進行中の renderUnsubscribe() を無効化する。
  // router がページ離脱時にこの関数を呼ぶことで、古い fetch() / getProfile() が
  // 遅れて完了しても別ページの DOM を退会ページで上書きしなくなる。
  _renderToken++;

  if (_userInfoTimeoutTimer !== null) {
    clearTimeout(_userInfoTimeoutTimer);
    _userInfoTimeoutTimer = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (_autoLogoutTimer !== null) {
    clearTimeout(_autoLogoutTimer);
    _autoLogoutTimer = null;
  }
};

// セッション切れ（idToken が null）を検知した際の共通 UI 表示関数。
// ページ初期表示時の getIDToken() === null、getProfile() 待機中の失効、
// 退会ボタン押下時の再確認など、複数のコードパスから呼ばれる。
// - buildSessionExpiredHtml() で Terms と共通の文言・スタイルを使用
// - role="alert" aria-live="assertive" でスクリーンリーダーに即時通知
// - フォーカスを「今すぐログアウト」ボタンへ移動しキーボード操作を保持
// - 「キャンセルして戻る」ボタンを非表示にして期限切れセッションのまま遷移を防ぐ
// - 3秒後に自動ログアウト（module スコープタイマーで cleanup 可能）
// - hasLoggedOut ガードでタイマー満了とボタンクリックの同時発生による二重実行を防止
const showSessionExpiredAndAutoLogout = (container: HTMLElement): void => {
  // セッション切れ時は戻る導線を塞ぎ、期限切れセッションのまま Profile に戻れないようにする
  const backBtn = container.querySelector('#back-btn') as HTMLButtonElement | null;
  if (backBtn) {
    backBtn.style.display = 'none';
  }

  const unsubscribeAction = container.querySelector('#unsubscribe-action');
  if (unsubscribeAction) {
    unsubscribeAction.innerHTML = `
      <div role="alert" aria-live="assertive">
        ${buildSessionExpiredHtml('session-logout-btn')}
      </div>
    `;
  }

  // innerHTML 差し替えで元の退会ボタンのフォーカスが失われるため、
  // キーボード操作・支援技術の利用者が次の操作先を見失わないよう
  // 新しく表示した「今すぐログアウト」ボタンへフォーカスを移す。
  const sessionLogoutBtnEl = container.querySelector<HTMLButtonElement>('#session-logout-btn');
  if (sessionLogoutBtnEl) {
    sessionLogoutBtnEl.focus();
  }

  // タイマー満了とボタンクリックがほぼ同時になっても doLogout() が二重実行されないよう
  // hasLoggedOut フラグでガードする。
  let hasLoggedOut = false;
  const doLogout = () => {
    if (hasLoggedOut) return;
    hasLoggedOut = true;
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
// SPA 遷移では initLiff() が再実行されないため、isInClient()/isLoggedIn() の状態に
// 関わらず関数冒頭で idToken を確認することで全コードパスをカバーする。
// 戻り値の idToken は getProfile() 等の非同期処理完了後に再取得した最新値であるため、
// 関数呼び出し時点のトークンが stale になる問題を回避している。
const getUserIdAndToken = async (): Promise<{ userId: string; idToken: string }> => {
  // 最初に idToken を確認する。
  // isInClient()/isLoggedIn() が false の状態（SPA 遷移後のセッション切れ等）でも
  // SESSION_EXPIRED を正しくスローするために、userId 取得より先に確認する。
  if (!liff.getIDToken()) {
    throw new SessionExpiredError();
  }

  let userId = '';

  if (liff.isInClient() || liff.isLoggedIn()) {
    const context = liff.getContext();
    userId = context?.userId || '';

    if (!userId) {
      try {
        const profile = await liff.getProfile();
        userId = profile.userId;
      } catch (e) {
        // getProfile() の非同期待機中にセッションが失効した可能性を確認する。
        // トークンが null になっていれば SESSION_EXPIRED として扱い、自動ログアウト導線へ進む。
        if (!liff.getIDToken()) {
          throw new SessionExpiredError();
        }
        console.warn('Could not get userId from context or profile for unsubscribe', e);
        throw new Error('ユーザーIDの取得に失敗しました。LINEログイン状態を確認してください。');
      }
    }
  }

  if (!userId || userId.trim() === '') {
    throw new Error('無効なユーザーID: ユーザーIDを取得できませんでした。');
  }

  // getProfile() 等の非同期処理完了後にトークンを再取得する。
  // 関数冒頭で取得した idToken は getProfile() 待機中に stale になる可能性があるため、
  // 戻り値には必ず最新のトークンを使用する。
  const freshIdToken = liff.getIDToken();
  if (!freshIdToken) {
    throw new SessionExpiredError();
  }

  return { userId, idToken: freshIdToken };
};

// getUserIdAndToken() の最大待機時間（ミリ秒）。
// fetch 成功後に await userInfoPromise で待機する際のタイムアウト値。
// getProfile() がハングしてもこの時間を超えたらエラーを表示する。
export const USER_INFO_TIMEOUT_MS = 10_000;

// showSessionExpiredAndAutoLogout() が必要とする最小限の DOM 構造。
// 早期リターン（fetch 前）・outer catch（fetch 失敗後）の両コードパスで共用し、
// action エリアや back ボタンの要件変更時の更新漏れを防ぐ。
const SESSION_EXPIRED_SHELL_HTML = `
  <div class="terms-container">
    <div id="unsubscribe-action"></div>
    <button id="back-btn" style="display: none;"></button>
  </div>`;

export const renderUnsubscribe = async (container: HTMLElement): Promise<void> => {
  // このレンダー呼び出しのトークンを取得する。
  // 非同期処理の完了後にトークンが変わっていれば別のレンダーが始まっているため、
  // 古い結果で DOM を上書きしないようにする。
  const myToken = ++_renderToken;
  container.innerHTML = '<div class="loading">読み込み中...</div>';

  // markdown fetch より前にセッション切れを確認する。
  // fetch が失敗した場合も自動ログアウト導線に入れるよう最優先で確認する。
  // showSessionExpiredAndAutoLogout() が必要とする最小限の DOM 構造を作成してから呼ぶ。
  if (!liff.getIDToken()) {
    container.innerHTML = SESSION_EXPIRED_SHELL_HTML;
    showSessionExpiredAndAutoLogout(container);
    return;
  }

  // idToken の早期チェックを通過した時点で getUserIdAndToken() も並列で開始する。
  // fetch・Markdown 変換と同時に走るため、退会ボタンが有効になるまでの待ち時間を短縮できる。
  // reject 時は _userInfoRejection に記録し unhandledrejection も同時に抑制する。
  // outer catch では await userInfoPromise をしない（getProfile がハングしていても
  // fetch エラーを即時表示できるよう、マイクロタスク 1 回分だけ yield して確認する）。
  let _userInfoRejection: unknown = null;
  const userInfoPromise = getUserIdAndToken();
  userInfoPromise.catch((e) => { _userInfoRejection = e; });

  try {
    // cache: 'no-store' で LINE WebView 等のブラウザキャッシュを回避する。
    // 退会文言を差し替えた後も古いコンテンツが表示され続けないよう terms.md と同様に設定する。
    const response = await fetch('/unsubscribe.md', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('コンテンツの読み込みに失敗しました');
    }
    const text = await response.text();
    const parsedHtml = await marked.parse(text);
    const htmlContent = DOMPurify.sanitize(parsedHtml);

    // 別のレンダーが開始されていないかを確認する。
    // 開始されていれば、この結果は既に不要なので終了する。
    if (_renderToken !== myToken) return;

    const html = `
      <div class="terms-container">
        <div class="terms-content">
          ${htmlContent}
        </div>

        <div style="margin-top: 30px; text-align: center;">
          <div id="unsubscribe-action">
            <button id="unsubscribe-btn" disabled
              style="padding: 12px 24px; background: #ccc; color: white; border: none; border-radius: 5px; font-size: 1rem; cursor: not-allowed; margin-bottom: 20px;">
              確認中...
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
        // history.back() は BOT URL 等から直接アクセスした場合に履歴がなく機能しない。
        // Terms と同様に replaceState でプロフィールページに置き換え、
        // pushState による履歴ループを防ぐ。
        window.history.replaceState({}, '', '/profile/me');
        window.dispatchEvent(new Event('popstate'));
      };
    }

    // 並列で開始済みの getUserIdAndToken() の結果を待つ。
    // fetch 中にすでに完了している場合はマイクロタスク 1 つで返る。
    // getProfile() がハング（resolve/reject しない）した場合でも
    // USER_INFO_TIMEOUT_MS 以内にタイムアウトエラーを投げて確認中ループを解消する。
    // userId は退会 API 実装時にボタンハンドラ内で改めて取得するため、ここでは保存しない。
    // （noUnusedLocals: true のため、実際に使うタイミングまで変数化しない。）
    //
    // タイマー ID をローカル変数と module スコープの両方で保持する理由:
    // - ローカル変数: finally で「このレンダーのタイマー」を確実に解除するため
    // - _userInfoTimeoutTimer: cleanupUnsubscribeTimer() がページ遷移時に解除できるようにするため
    // 複数レンダーが並走した場合、_userInfoTimeoutTimer は最新レンダーのIDで上書きされるが、
    // ローカル変数のIDを使うことで古いレンダーのfinally が最新レンダーのタイマーを
    // 誤って解除してしまうのを防ぐ。
    let _localTimeoutId!: ReturnType<typeof setTimeout>;
    const _timeoutPromise = new Promise<never>((_, reject) => {
      _localTimeoutId = setTimeout(
        () => {
          if (_userInfoTimeoutTimer === _localTimeoutId) {
            _userInfoTimeoutTimer = null;
          }
          reject(new Error('ユーザー情報の取得がタイムアウトしました'));
        },
        USER_INFO_TIMEOUT_MS
      );
      _userInfoTimeoutTimer = _localTimeoutId;
    });
    try {
      await Promise.race([userInfoPromise, _timeoutPromise]);
    } catch (e: unknown) {
      // 非同期処理完了後にトークンを確認する。別レンダーが始まっていれば終了する。
      if (_renderToken !== myToken) return;
      const isSessionExpired = e instanceof SessionExpiredError;
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
    } finally {
      // userInfoPromise の先着・タイムアウトどちらで終了した場合も、
      // このレンダーのタイムアウトタイマーを解除する。
      clearTimeout(_localTimeoutId);
      if (_userInfoTimeoutTimer === _localTimeoutId) {
        _userInfoTimeoutTimer = null;
      }
    }

    // セッション確認成功。トークンを確認してから退会ボタンを有効化する。
    if (_renderToken !== myToken) return;

    const unsubscribeBtn = document.getElementById('unsubscribe-btn') as HTMLButtonElement | null;
    if (unsubscribeBtn) {
      unsubscribeBtn.disabled = false;
      unsubscribeBtn.style.background = '#ff4d4f';
      unsubscribeBtn.style.cursor = 'pointer';
      unsubscribeBtn.textContent = '退会する';
      unsubscribeBtn.onclick = async () => {
        // ボタン押下時に idToken を再取得する。
        // ページ表示後にトークンが期限切れになっている可能性があるため、
        // 保存済みの値ではなく最新の状態を確認する。
        const currentIdToken = liff.getIDToken();
        if (!currentIdToken) {
          showSessionExpiredAndAutoLogout(container);
          return;
        }

        // TODO: 退会API を呼び出す
        // userId と currentIdToken は getUserIdAndToken() を再度呼び出して取得する。
        // const { userId } = await getUserIdAndToken();
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
    if (_renderToken !== myToken) return;

    // getProfile() がハングしている場合でも fetch エラーを即時表示できるよう、
    // await userInfoPromise はしない。マイクロタスク 1 回分だけ yield して
    // 既に settle 済みの SessionExpiredError を _userInfoRejection 経由で確認する。
    // - userInfoPromise が既に reject 済み → _userInfoRejection に値が入っている
    // - userInfoPromise がまだ pending    → _userInfoRejection は null のまま → 汎用エラー表示
    await Promise.resolve();
    if (_renderToken !== myToken) return;

    if (_userInfoRejection instanceof SessionExpiredError) {
      // showSessionExpiredAndAutoLogout() が必要とする最小限の DOM 構造を作成する。
      // fetch 失敗時は HTML が未描画のため、SESSION_EXPIRED_SHELL_HTML を使う。
      container.innerHTML = SESSION_EXPIRED_SHELL_HTML;
      showSessionExpiredAndAutoLogout(container);
      return;
    }

    console.error('Unsubscribe page error:', error);
    container.innerHTML = `<div class="container"><p style="color:red">ページの表示中にエラーが発生しました。</p></div>`;

    // マイクロタスク 1 回の確認で見逃した遅延 SessionExpiredError にも対応する。
    // getProfile() が pending のまま fetch が失敗した後、getProfile() が後から
    // SessionExpiredError で失敗した場合もセッション切れ UI に更新する。
    // _renderToken === myToken ガードで別ページ遷移後の更新を防ぐ。
    userInfoPromise.catch((e) => {
      if (e instanceof SessionExpiredError && _renderToken === myToken) {
        container.innerHTML = SESSION_EXPIRED_SHELL_HTML;
        showSessionExpiredAndAutoLogout(container);
      }
    });
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
