import { marked } from 'marked';
import DOMPurify from 'dompurify';
import liff from '@line/liff';
import { config } from '../config';
import { TERMS_UPDATED_AT } from '../shared-constants';
import { buildSessionExpiredHtml } from '../utils/session-ui';

// module スコープで 401 自動ログアウトタイマーIDを保持する。
// ページ遷移時にルーターから cleanupTermsAutoLogoutTimer() を呼ぶことで
// 別ページ描画後にタイマーが発火してしまう問題を防ぐ。
let _autoLogoutTimer: ReturnType<typeof setTimeout> | null = null;

export const cleanupTermsAutoLogoutTimer = (): void => {
    if (_autoLogoutTimer !== null) {
        clearTimeout(_autoLogoutTimer);
        _autoLogoutTimer = null;
    }
};

// モジュールスコープで一度だけパースして再利用する
// 不正な日付文字列に対しては「十分先の未来」にフォールバックし、
// acceptedAt >= TERMS_UPDATED_AT_DATE が常に false となるため
// すべての同意日を「古い」と見なして再同意を促す（fail-closed）。
const _parsedTermsDate = new Date(TERMS_UPDATED_AT);
const TERMS_UPDATED_AT_DATE = isNaN(_parsedTermsDate.getTime())
    ? new Date(8640000000000000) // JS Date の最大値（year 275760）
    : _parsedTermsDate;

export const renderTerms = async (container: HTMLElement): Promise<void> => {
    container.innerHTML = '<div class="loading">規約を読み込み中...</div>';

    try {
        // 1. Fetch and render Markdown immediately
        // cache: 'no-store' を指定して LINE WebView 等のブラウザキャッシュを回避する。
        // nginx 側でも Cache-Control: no-store を設定しているが、二重に保護する。
        const response = await fetch('/terms.md', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('規約の読み込みに失敗しました');
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
          <div id="agreement-section">
            <p style="color: #666;">同意状況を確認中...</p>
          </div>
          
          <button id="back-btn" style="padding: 10px 20px; background: #eee; color: #333; border: none; border-radius: 5px; font-size: 0.9rem; cursor: pointer; margin-top: 10px;">
            プロフィールに戻る
          </button>
        </div>
      </div>
    `;

        container.innerHTML = html;

        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.onclick = () => {
                // history.back() は BOT URL から直接アクセスした場合に履歴がなく機能しない。
                // replaceState で Terms を Profile に置き換え、pushState による履歴ループを防ぐ。
                window.history.replaceState({}, '', '/profile/me');
                window.dispatchEvent(new Event('popstate'));
            };
        }

        // 2. Check Agreement Status via API
        await checkAgreementStatus(container);

    } catch (error: unknown) {
        console.error('Terms rendering error:', error);
        container.innerHTML = `<div class="container"><p style="color:red">規約の表示中にエラーが発生しました。</p></div>`;
    }
};

// GET /status・POST /agreement 両方の 401 で使う共通 UI 表示関数。
// - ページ最上部に sticky バナーを追加し、スクロール位置に関わらずセッション切れを即座に通知
// - role="alert" aria-live="assertive" は上部バナーのみ付与し、スクリーンリーダーへの重複通知を避ける
// - 「プロフィールに戻る」ボタンを非表示にして期限切れセッションのまま遷移を防ぐ
// - 3秒後に自動ログアウト（module スコープタイマーで cleanup 可能）
// - hasLoggedOut ガードでタイマー満了・上部ボタン・下部ボタンの同時実行による二重実行を防止
const showSessionExpiredAndAutoLogout = (agreementSection: Element, container: HTMLElement): void => {
    // 401 時は戻る導線を塞ぎ、期限切れセッションのまま Profile に戻れないようにする
    const backBtn = container.querySelector('#back-btn') as HTMLButtonElement | null;
    if (backBtn) {
        backBtn.style.display = 'none';
    }

    // ページ最上部に sticky バナーを prepend する。
    // 利用規約は長いため、スクロール前でも確実にセッション切れを認識できるようにする。
    // role="alert" aria-live="assertive" はここ一箇所だけ付与し、スクリーンリーダーへの重複通知を避ける。
    const termsContainer = container.querySelector('.terms-container');
    if (termsContainer) {
        const topBanner = document.createElement('div');
        topBanner.id = 'session-expired-top-banner';
        topBanner.setAttribute('role', 'alert');
        topBanner.setAttribute('aria-live', 'assertive');
        topBanner.style.cssText = 'position: sticky; top: 0; background: #fff3e0; border-bottom: 2px solid #e65c00; padding: 12px 16px; text-align: center; z-index: 100;';
        topBanner.innerHTML = buildSessionExpiredHtml('session-logout-btn-top');
        termsContainer.prepend(topBanner);
    }

    // 最下部の同意エリアも同じメッセージで更新し、下まで読んだユーザーにも通知する
    agreementSection.innerHTML = buildSessionExpiredHtml('session-logout-btn');

    // agreementSection の innerHTML 差し替えでフォーカスが失われるため、
    // キーボード操作・支援技術の利用者が次の操作先を見失わないようフォーカスを移す。
    // 下部ボタンへの focus() は長い Terms コンテンツ末尾まで自動スクロールを引き起こすため、
    // 常にビューポート上部に表示されている sticky バナーのボタンへフォーカスする。
    const topLogoutBtnFocus = container.querySelector<HTMLButtonElement>('#session-logout-btn-top');
    if (topLogoutBtnFocus) {
        topLogoutBtnFocus.focus();
    }

    // タイマー満了・上部ボタン・下部ボタンが重なっても liff.logout() と
    // href='/' が二重実行されないよう hasLoggedOut フラグでガードする。
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

    // 上部バナーのボタン
    const sessionLogoutBtnTop = container.querySelector('#session-logout-btn-top');
    if (sessionLogoutBtnTop) {
        sessionLogoutBtnTop.addEventListener('click', () => {
            cleanupTermsAutoLogoutTimer();
            doLogout();
        });
    }

    // 下部ボタン
    const sessionLogoutBtn = agreementSection.querySelector('#session-logout-btn');
    if (sessionLogoutBtn) {
        sessionLogoutBtn.addEventListener('click', () => {
            cleanupTermsAutoLogoutTimer();
            doLogout();
        });
    }
};

const getAuthToken = (): string => {
    const idToken = liff.getIDToken();
    if (!idToken) {
        throw new Error('認証トークンの取得に失敗しました。再ログインしてください。');
    }
    return idToken;
};

const checkAgreementStatus = async (container: HTMLElement) => {
    let userId = '';
    let hasAgreed = false;
    let isReconsent = false;
    let hasAgeVerified = false;

    try {
        if (liff.isInClient() || liff.isLoggedIn()) {
            const context = liff.getContext();
            userId = context?.userId || '';

            if (!userId) {
                try {
                    const profile = await liff.getProfile();
                    userId = profile.userId;
                } catch (e) {
                    console.warn('Could not get userId from context or profile for terms check', e);
                    throw new Error('ユーザーIDの取得に失敗しました。LINEログイン状態を確認してください。');
                }
            }
        }

        // Validate userId
        if (!userId || userId.trim() === '') {
            throw new Error('無効なユーザーID: ユーザーIDを取得できませんでした。');
        }

        // Fetch user agreement status from Backend API
        const apiBaseUrl = config.apiBaseUrl;
        if (!apiBaseUrl) {
            throw new Error('API base URL is not configured');
        }

        const idToken = getAuthToken();
        const authorizationHeader = `Bearer ${idToken}`;

        const statusResponse = await fetch(`${apiBaseUrl}/api/users/${encodeURIComponent(userId)}/status`, {
            headers: {
                'Authorization': authorizationHeader
            }
        });
        if (statusResponse.status === 401) {
            // ID トークンが期限切れ。共通関数で自動ログアウト UI を表示する。
            const agreementSection = container.querySelector('#agreement-section');
            if (agreementSection) {
                showSessionExpiredAndAutoLogout(agreementSection, container);
            }
            return;
        }
        if (!statusResponse.ok) {
            throw new Error(`Failed to fetch user status: ${statusResponse.statusText} (Status: ${statusResponse.status})`);
        }

        const statusData = await statusResponse.json();

        // termsAcceptedAt が存在する場合のみ最新の利用規約更新日と比較する。
        // termsAcceptedAt が null/未設定の場合は同意日の記録がないため、
        // agreed フラグに関わらず未同意扱いとする（規約更新時に必ず再同意を取得するため）。
        if (statusData.termsAcceptedAt) {
            const acceptedAt = new Date(statusData.termsAcceptedAt);
            if (isNaN(acceptedAt.getTime())) {
                // 日付パース失敗: データ不正のため初回同意扱いとする。
                // 「利用規約が更新されました」（再同意通知）を表示すると誤解を招くため、
                // isReconsent = false のまま通常の初回同意ボタンを表示する。
                hasAgreed = false;
                isReconsent = false;
            } else {
                hasAgreed = acceptedAt >= TERMS_UPDATED_AT_DATE;
                isReconsent = !hasAgreed;
            }
        } else {
            hasAgreed = false;
        }

        // age_verified_at が設定済みであれば年齢確認済みとみなす（一度確認すれば以降不要）
        hasAgeVerified = !!statusData.ageVerifiedAt;

    } catch (e) {
        console.error('API check failed', e);
        const agreementSection = container.querySelector('#agreement-section');
        if (agreementSection) {
            agreementSection.innerHTML = `<p style="color: red;">同意状況の確認中にエラーが発生しました。</p>`;
        }
        return;
    }

    const needsTerms = !hasAgreed;
    const needsAge = !hasAgeVerified;

    const agreementSection = container.querySelector('#agreement-section');
    if (agreementSection) {
        if (!needsTerms && !needsAge) {
            agreementSection.innerHTML = '<p style="color: #06C755; font-weight: bold;">規約に同意・年齢確認済みです</p>';
        } else {
            // 通知メッセージの構築
            let noticeHtml = '';
            if (isReconsent) {
                noticeHtml += '<p style="color: #e65c00; font-weight: bold; margin-bottom: 8px;">利用規約が更新されました。引き続きご利用いただくには再度ご同意ください。</p>';
            }
            if (!needsTerms && needsAge) {
                // 利用規約は同意済みだが年齢確認が未完了（機能追加前の既存ユーザー等）
                noticeHtml += '<p style="color: #e65c00; font-weight: bold; margin-bottom: 8px;">年齢確認が必要です。本サービスは18歳以上の方を対象としています。</p>';
            }

            // 年齢確認チェックボックス（年齢未確認の場合のみ表示）
            const ageCheckboxHtml = needsAge
                ? `<label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;justify-content:center;">
                     <input type="checkbox" id="age-check" style="width:18px;height:18px;">
                     <span>私は18歳以上です</span>
                   </label>`
                : '';

            // ボタンラベルの決定
            let btnLabel: string;
            if (!needsTerms && needsAge) {
                btnLabel = '年齢確認する';
            } else if (isReconsent) {
                btnLabel = '更新された規約に同意する';
            } else {
                btnLabel = '規約に同意する';
            }

            // 年齢確認が必要な場合はボタンを初期無効化
            const btnDisabled = needsAge ? 'disabled' : '';

            agreementSection.innerHTML = `
              ${noticeHtml}
              ${ageCheckboxHtml}
              <button id="agree-btn" ${btnDisabled} style="padding: 12px 24px; background: #06C755; color: white; border: none; border-radius: 5px; font-size: 1rem; cursor: ${needsAge ? 'not-allowed' : 'pointer'}; margin-bottom: 10px; opacity: ${needsAge ? '0.5' : '1'};">
                ${btnLabel}
              </button>
            `;

            // チェックボックスの変更でボタンの有効/無効を切り替え
            if (needsAge) {
                const ageCheck = document.getElementById('age-check') as HTMLInputElement | null;
                const agreeBtn = document.getElementById('agree-btn') as HTMLButtonElement | null;
                if (ageCheck && agreeBtn) {
                    ageCheck.onchange = () => {
                        agreeBtn.disabled = !ageCheck.checked;
                        agreeBtn.style.opacity = ageCheck.checked ? '1' : '0.5';
                        agreeBtn.style.cursor = ageCheck.checked ? 'pointer' : 'not-allowed';
                    };
                }
            }

            const agreeBtn = document.getElementById('agree-btn') as HTMLButtonElement | null;
            if (agreeBtn) {
                agreeBtn.onclick = async () => {
                    const ageCheck = document.getElementById('age-check') as HTMLInputElement | null;
                    const ageVerified = hasAgeVerified || (ageCheck?.checked ?? false);
                    await handleAgreement(agreeBtn, userId, container, ageVerified);
                };
            }
        }
    }
};

const handleAgreement = async (btn: HTMLButtonElement, userId: string, container: HTMLElement, ageVerified: boolean) => {
    if (!userId) {
        alert('ユーザーIDが取得できませんでした');
        return;
    }

    const originalLabel = btn.textContent ?? '規約に同意する';
    btn.disabled = true;
    btn.textContent = '処理中...';

    try {
        const apiBaseUrl = config.apiBaseUrl;
        if (!apiBaseUrl) {
            throw new Error('API Base URL not configured');
        }

        const idToken = getAuthToken();
        const authorizationHeader = `Bearer ${idToken}`;

        const response = await fetch(`${apiBaseUrl}/api/users/${userId}/agreement`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authorizationHeader
            },
            body: JSON.stringify({ agreed: true, age_verified: ageVerified })
        });

        if (response.status === 401) {
            // 同意 POST 中にトークンが期限切れになった場合も自動ログアウトへ誘導する
            const agreementSection = container.querySelector('#agreement-section');
            if (agreementSection) {
                showSessionExpiredAndAutoLogout(agreementSection, container);
            }
            return;
        }
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        alert('規約への同意と年齢確認が完了しました');
        const agreementSection = container.querySelector('#agreement-section');
        if (agreementSection) {
            agreementSection.innerHTML = '<p style="color: #06C755; font-weight: bold;">規約に同意・年齢確認済みです</p>';
        }
    } catch (e: unknown) {
        console.error('Agreement failed', e);
        alert('処理中にエラーが発生しました。もう一度お試しください。');
        btn.disabled = false;
        btn.textContent = originalLabel;
    }
};
