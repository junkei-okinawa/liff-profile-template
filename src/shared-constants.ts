/**
 * Test LIFF ID for E2E testing with Playwright.
 * This value should match the VITE_LIFF_ID set in playwright.config.ts.
 */
export const TEST_LIFF_ID = 'test-liff-id';

/**
 * 最新の利用規約更新日（ISO 8601 形式）。
 * 利用規約を更新した際はこの値を更新すること。
 * ユーザーの同意日がこの日付より古い場合、再同意を求める。
 */
export const TERMS_UPDATED_AT = '2026-04-21T00:00:00.000Z';


/**
 * Default Mock User ID for testing.
 */
export const TEST_USER_ID = 'U00000000000000000000000000000000';
