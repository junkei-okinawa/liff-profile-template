import { defineConfig, devices } from '@playwright/test';

import { TEST_LIFF_ID, TEST_CHANNEL_ID } from './src/test-constants';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    timeout: 60000,
    use: {
        baseURL: 'http://localhost:3000',
        actionTimeout: 30000,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        env: {
            ...process.env,
            VITE_LIFF_ID: process.env.VITE_LIFF_ID ?? TEST_LIFF_ID,
            VITE_CHANNEL_ID: process.env.VITE_CHANNEL_ID ?? TEST_CHANNEL_ID,
        },
    },
});
