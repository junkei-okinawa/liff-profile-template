import { marked } from 'marked';
import { db } from '../firebase-config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
        const htmlContent = marked.parse(text);

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

        // 2. Check Firestore in the background
        checkAgreementStatus(container);

    } catch (error: any) {
        container.innerHTML = `<div class="container"><p style="color:red">エラー: ${error.message}</p></div>`;
    }
};

const checkAgreementStatus = async (container: HTMLElement) => {
    let userId = '';
    let hasAgreed = false;

    try {
        if (liff.isInClient() || liff.isLoggedIn()) {
            const context = liff.getContext();
            userId = context?.userId || '';

            // If still no userId, try getProfile as fallback or just fail gracefully
            if (!userId) {
                try {
                    const profile = await liff.getProfile();
                    userId = profile.userId;
                } catch (e) {
                    console.warn('Could not get userId for terms check');
                }
            }
        }

        if (userId) {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                if (userData.terms_accepted_at) {
                    hasAgreed = true;
                }
            }
        }
    } catch (e) {
        console.error('Firestore check failed', e);
    }

    const agreementSection = container.querySelector('#agreement-section');
    if (agreementSection) {
        if (hasAgreed) {
            agreementSection.innerHTML = '<p style="color: #06C755; font-weight: bold;">規約に同意済みです</p>';
        } else {
            // Only show agree button if we have a userId
            if (userId) {
                agreementSection.innerHTML = `
                    <button id="agree-btn" style="padding: 12px 24px; background: #06C755; color: white; border: none; border-radius: 5px; font-size: 1rem; cursor: pointer; margin-bottom: 10px;">
                      規約に同意する
                    </button>
                `;

                const agreeBtn = document.getElementById('agree-btn');
                if (agreeBtn) {
                    agreeBtn.onclick = async () => {
                        handleAgreement(agreeBtn as HTMLButtonElement, userId, container);
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
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
            terms_accepted_at: serverTimestamp()
        }, { merge: true });

        alert('規約に同意しました');
        const agreementSection = container.querySelector('#agreement-section');
        if (agreementSection) {
            agreementSection.innerHTML = '<p style="color: #06C755; font-weight: bold;">規約に同意済みです</p>';
        }
    } catch (e) {
        console.error('Agreement failed', e);
        alert('エラーが発生しました。もう一度お試しください。');
        btn.disabled = false;
        btn.textContent = '規約に同意する';
    }
};
