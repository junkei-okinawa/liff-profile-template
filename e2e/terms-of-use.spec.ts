import { test, expect } from '@playwright/test';
import { TEST_LIFF_ID, TEST_CHANNEL_ID } from '../src/shared-constants';

test.beforeEach(async ({ page }) => {
    // Inject runtime config
    await page.addInitScript(({ TEST_LIFF_ID, TEST_CHANNEL_ID }) => {
        (window as any)._env_ = {
            VITE_API_BASE_URL: 'http://localhost:8080',
            VITE_LIFF_ID: TEST_LIFF_ID,
            VITE_CHANNEL_ID: TEST_CHANNEL_ID
        };
    }, { TEST_LIFF_ID, TEST_CHANNEL_ID });

    // Block env-config.js to prevent overwriting window._env_
    await page.route('**/env-config.js', route => route.abort());
});

test('should allow user to agree to terms and persist agreement state', async ({ page }) => {
    // Mock API State
    let isAgreed = false;
    const mockUserId = 'U00000000000000000000000000000000';

    // Mock GET /api/users/{userId}/status
    await page.route(`**/api/users/${mockUserId}/status`, async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                userId: mockUserId,
                agreed: isAgreed,
                termsAcceptedAt: isAgreed ? new Date().toISOString() : null
            })
        });
    });

    // Mock POST /api/users/{userId}/agreement
    await page.route(`**/api/users/${mockUserId}/agreement`, async route => {
        const body = route.request().postDataJSON();
        if (body && body.agreed) {
            isAgreed = true;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'success',
                    userId: mockUserId,
                    agreed: true,
                    termsAcceptedAt: new Date().toISOString()
                })
            });
        } else {
            await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Invalid request' })
            });
        }
    });

    // 1. Go to Profile page and verify authentication

    const response = await page.goto('/');

    // Verify successful navigation
    if (!response) {
        throw new Error('Failed to navigate to page');
    }
    expect(response.status()).toBe(200);
    expect(response.ok()).toBe(true);

    // Verify app root is visible
    await expect(page.locator('#app')).toBeVisible();

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
