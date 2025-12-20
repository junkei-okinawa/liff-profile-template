import liff from '@line/liff';
import { renderProfile } from './pages/Profile';
import { renderTerms } from './pages/Terms';
import { renderUnsubscribe, renderUnsubscribeComplete, cleanupUnsubscribeTimer } from './pages/Unsubscribe';
import { config } from './config';
import { TEST_LIFF_ID, TEST_CHANNEL_ID } from './test-constants';
import { setupMockLiff } from './test-mock-liff';
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
        // SECURITY: Ensure this only runs in DEV mode and explicitly enabled.
        const enableMockLiff = import.meta.env.VITE_ENABLE_MOCK_LIFF === 'true';
        if (enableMockLiff && [TEST_LIFF_ID, TEST_CHANNEL_ID].includes(liffId) && import.meta.env.DEV) {
            setupMockLiff();
        } else {
            await liff.init({ liffId });
        }

        // Check if user is logged in and has context
        if (!liff.isLoggedIn()) {
            liff.login({ redirectUri: config.callbackUrl || window.location.href });
            return;
        }

        const context = liff.getContext();
        // If context/userId is missing (e.g. app opened in an external browser outside the LINE app environment), try getProfile as fallback
        if (!context || !context.userId) {
            try {
                const profile = await liff.getProfile();
                console.log('Context not found but profile retrieved:', profile.userId);
            } catch (e) {
                console.warn('No session found, redirecting to login...', e);
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
