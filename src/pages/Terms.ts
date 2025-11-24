import { marked } from 'marked';
import DOMPurify from 'dompurify';
import liff from '@line/liff';

export const renderTerms = async (container: HTMLElement): Promise<void> => {
    container.innerHTML = '<div class="loading">規約を読み込み中...</div>';

    try {
        // 1. Fetch and render Markdown immediately
        const response = await fetch('/terms.md');
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
                window.history.back();
            };
        }

        // 2. Check Agreement Status via API
        await checkAgreementStatus(container);

    } catch (error: unknown) {
        console.error('Terms rendering error:', error);
        container.innerHTML = `<div class="container"><p style="color:red">規約の表示中にエラーが発生しました。</p></div>`;
    }
};

const checkAgreementStatus = async (container: HTMLElement) => {
    let userId = '';
    let hasAgreed = false;

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
                }
            }
        }

        // Validate userId
        if (!userId || userId.trim() === '') {
            throw new Error('Invalid user ID: User ID could not be retrieved.');
        }

        // Fetch user agreement status from Backend API
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
        if (!apiBaseUrl) {
            throw new Error('API base URL is not configured');
        }

        const statusResponse = await fetch(`${apiBaseUrl}/api/users/${encodeURIComponent(userId)}/status`);
        if (!statusResponse.ok) {
            throw new Error(`Failed to fetch user status: ${statusResponse.statusText} (Status: ${statusResponse.status})`);
        }

        const statusData = await statusResponse.json();
        hasAgreed = statusData.agreed;

    } catch (e) {
        console.error('API check failed', e);
        hasAgreed = false; // Ensure hasAgreed is false on error
        const agreementSection = container.querySelector('#agreement-section');
        if (agreementSection) {
            agreementSection.innerHTML = `<p style="color: red;">同意状況の確認中にエラーが発生しました: ${e instanceof Error ? e.message : String(e)}</p>`;
        }
        return; // Exit early if there's an error
    }

    const agreementSection = container.querySelector('#agreement-section');
    if (agreementSection) {
        if (hasAgreed) {
            agreementSection.innerHTML = '<p style="color: #06C755; font-weight: bold;">規約に同意済みです</p>';
        } else {
            if (userId) {
                agreementSection.innerHTML = `
          <button id="agree-btn" style="padding: 12px 24px; background: #06C755; color: white; border: none; border-radius: 5px; font-size: 1rem; cursor: pointer; margin-bottom: 10px;">
            規約に同意する
          </button>
        `;

                const agreeBtn = document.getElementById('agree-btn');
                if (agreeBtn) {
                    agreeBtn.onclick = async () => {
                        await handleAgreement(agreeBtn as HTMLButtonElement, userId, container);
                    };
                }
            } else {
                agreementSection.innerHTML = '<p style="color: red;">ユーザー情報を取得できませんでした。再読み込みしてください。</p>';
            }
        }
    }
};

const handleAgreement = async (btn: HTMLButtonElement, userId: string, container: HTMLElement) => {
    if (!userId) {
        alert('ユーザーIDが取得できませんでした');
        return;
    }

    btn.disabled = true;
    btn.textContent = '処理中...';

    try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
        if (!apiBaseUrl) {
            throw new Error('API Base URL not configured');
        }

        const response = await fetch(`${apiBaseUrl}/api/users/${userId}/agreement`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ agreed: true })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        alert('規約に同意しました');
        const agreementSection = container.querySelector('#agreement-section');
        if (agreementSection) {
            agreementSection.innerHTML = '<p style="color: #06C755; font-weight: bold;">規約に同意済みです</p>';
        }
    } catch (e: any) {
        console.error('Agreement failed', e);
        alert(`エラーが発生しました: ${e.message}. もう一度お試しください。`);
        btn.disabled = false;
        btn.textContent = '規約に同意する';
    }
};
