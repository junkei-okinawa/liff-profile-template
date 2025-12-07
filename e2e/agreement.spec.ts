import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Mock window.liff before page loads
    await page.addInitScript(() => {
        (window as any).liff = {
            init: () => Promise.resolve(),
            isInClient: () => true,
            isLoggedIn: () => true,
            getProfile: () => Promise.resolve({
                userId: 'U00000000000000000000000000000000',
                displayName: 'Test User',
                pictureUrl: 'https://example.com/avatar.png',
                statusMessage: 'Ready for test'
            }),
            getIDToken: () => 'mock-user-U00000000000000000000000000000000', // Matches backend mock auth pattern
            getContext: () => ({
                type: 'utou',
                userId: 'U00000000000000000000000000000000',
                viewType: 'full',
                accessToken: 'mock-access-token'
            }),
            getOS: () => 'web',
            getAppLanguage: () => 'ja',
            closeWindow: () => { },
        };

        // Inject runtime config
        (window as any)._env_ = {
            VITE_API_BASE_URL: 'http://localhost:8080',
            VITE_LIFF_ID: 'test-liff-id',
            VITE_CHANNEL_ID: 'test-liff-id'
        };
    });

    // Block env-config.js to prevent overwriting window._env_
    await page.route('**/env-config.js', route => route.abort());
});

test('User agreement flow', async ({ page }) => {
    // 1. Go to Terms page (assuming direct link or button from Profile)
    // Let's start at Profile page to verify auth
    await page.goto('/');

    // Verify Profile Loaded
    await expect(page.getByText('Test User')).toBeVisible();
    await expect(page.getByText('U00000000000000000000000000000000')).toBeVisible();

    // 2. Navigate to Terms
    await page.getByRole('link', { name: '利用規約' }).click();
    await expect(page).toHaveURL(/\/terms-of-use/);

    // 3. Agree to Terms
    const agreeBtn = page.getByRole('button', { name: '規約に同意する' });
    await expect(agreeBtn).toBeVisible();

    await agreeBtn.click();

    // 4. Verify Success
    await expect(page.getByText('規約に同意済みです')).toBeVisible();

    // 5. Verify agreed state persists (reload)
    await page.reload();
    await expect(agreeBtn).not.toBeVisible();
    await expect(page.getByText('規約に同意済みです')).toBeVisible();
});
