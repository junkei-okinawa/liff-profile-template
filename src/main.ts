import liff from '@line/liff';
import { renderProfile } from './pages/Profile';
import { renderTerms } from './pages/Terms';
import { renderUnsubscribe, renderUnsubscribeComplete, cleanupUnsubscribeTimer } from './pages/Unsubscribe';
import { config } from './config';
import './style.css';

const app = document.getElementById('app') as HTMLElement;

// Router function
const router = async (): Promise<void> => {
    // Clean up any running timers from previous pages
    cleanupUnsubscribeTimer();

    const path = window.location.pathname;

    if (path.startsWith('/profile/')) {
        await renderProfile(app);
    } else if (path === '/terms-of-use') {
        await renderTerms(app);
    } else if (path === '/unsubscribe') {
        await renderUnsubscribe(app);
    } else if (path === '/unsubscribe/complete') {
        renderUnsubscribeComplete(app);
    } else if (path === '/api/auth/callback/line') {
        // Handle LINE Login callback path by redirecting to profile
        window.history.replaceState({}, '', '/profile/me');
        await renderProfile(app);
    } else {
        // Default route
        if (path === '/' || path === '/index.html') {
            // If logged in, redirect to profile/me (which will resolve to real user ID)
            window.history.replaceState({}, '', '/profile/me');
            await renderProfile(app);
        } else {
            app.innerHTML = '<h1>404 - Page Not Found</h1>';
        }
    }
};

// Initialize LIFF
const initLiff = async (): Promise<void> => {
    try {
        const liffId = config.liffId;

        if (!liffId) {
            throw new Error('LIFF ID is not configured (VITE_CHANNEL_ID or VITE_LIFF_ID must be set)');
        }

        // Mock the LIFF SDK when running in test mode.
        // This block is used for E2E testing with Playwright and enables local testing
        // without a real LINE environment by providing a mock implementation of the LIFF API.
        // SECURITY: Ensure this only runs in DEV mode.
        if (liffId === 'test-liff-id' && import.meta.env.DEV) {
            Object.assign(liff, {
                init: () => Promise.resolve(),
                isLoggedIn: () => true,
                isInClient: () => true,
                getProfile: () => Promise.resolve({
                    userId: 'U00000000000000000000000000000000',
                    displayName: 'Test User',
                    pictureUrl: 'https://example.com/avatar.png',
                    statusMessage: 'Ready for test'
                }),
                getIDToken: () => 'mock-user-U00000000000000000000000000000000',
                getContext: () => ({
                    type: 'utou',
                    userId: 'U00000000000000000000000000000000',
                    viewType: 'full',
                    accessToken: 'mock-access-token'
                }),
                getOS: () => 'web',
                getAppLanguage: () => 'ja',
                login: () => { },
                closeWindow: () => { },
            });
        } else {
            await liff.init({ liffId });
        }

        // Check if user is logged in and has context
        if (!liff.isLoggedIn()) {
            liff.login({ redirectUri: config.callbackUrl || window.location.href });
            return;
        }

        const context = liff.getContext();
        if (!context || !context.userId) {
            // If getContext is null (likely in external browser), try to get profile as fallback.
            try {
                const profile = await liff.getProfile();
                // If getProfile succeeds, we have a valid user session.
                // Note: We don't store the profile here, just verifying we can get it.
                // The pages will fetch what they need.
                console.log('Context not found but profile retrieved:', profile.userId);
            } catch (e) {
                // If getProfile also fails, show error or force login as last resort.
                console.warn('No context/userId and getProfile failed, redirecting to login...', e);
                liff.login({ redirectUri: config.callbackUrl || window.location.href });
                return;
            }
        }

        // If we have context, proceed to router
        router();

    } catch (error) {
        console.error('LIFF Init failed', error);
        app.innerHTML = `<div class="container"><p style="color:red">LIFFの初期化中にエラーが発生しました。しばらくしてから再度お試しください。</p></div>`;
    }
};

// Handle navigation
window.addEventListener('popstate', router);

// Start
initLiff();
