import liff from '@line/liff';
import { renderProfile } from './pages/Profile';
import { renderTerms } from './pages/Terms';
import { renderUnsubscribe, renderUnsubscribeComplete } from './pages/Unsubscribe';
import './style.css';

const app = document.getElementById('app') as HTMLElement;

// Router function
const router = async (): Promise<void> => {
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
        const liffId = import.meta.env.VITE_CHANNEL_ID;

        if (!liffId) {
            throw new Error('VITE_CHANNEL_ID is not defined in .env');
        }

        await liff.init({ liffId });

        // Check if user is logged in and has context
        if (!liff.isLoggedIn()) {
            liff.login({ redirectUri: import.meta.env.VITE_CALLBACK_URL || window.location.href });
            return;
        }

        const context = liff.getContext();
        if (!context || !context.userId) {
            // If no context/userId, force login again or show error
            // Sometimes getContext is null if not opened in LINE, but isLoggedIn is true.
            // In that case, we might need to rely on getProfile() later, but requirements say use getContext.
            // If getContext fails, we can try login.
            console.warn('No context or userId found, redirecting to login...');
            liff.login({ redirectUri: import.meta.env.VITE_CALLBACK_URL || window.location.href });
            return;
        }

        // If we have context, proceed to router
        router();

    } catch (error) {
        console.error('LIFF Init failed', error);
        app.innerHTML = `<div class="container"><p style="color:red">LIFF初期化エラー: ${error instanceof Error ? error.message : String(error)}</p></div>`;
    }
};

// Handle navigation
window.addEventListener('popstate', router);

// Start
initLiff();
