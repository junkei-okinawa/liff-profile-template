/**
 * Test LIFF ID for E2E testing with Playwright.
 * This value should match the VITE_LIFF_ID set in playwright.config.ts.
 */
export const TEST_LIFF_ID = 'test-liff-id';

import { getEnv } from './config';

/**
 * 最新の利用規約更新日（ISO 8601 形式）。
 * `VITE_TERMS_UPDATED_AT` 環境変数が設定されていればその値を使用し、
 * 未設定時はデフォルト値を使用する。
 * ランタイム環境変数 (window._env_) をビルド時環境変数 (import.meta.env) より優先する。
 * ユーザーの同意日がこの日付より古い場合、再同意を求める。
 */
const DEFAULT_TERMS_UPDATED_AT = '2026-04-21T00:00:00.000Z';

export const TERMS_UPDATED_AT =
  getEnv('VITE_TERMS_UPDATED_AT').trim() || DEFAULT_TERMS_UPDATED_AT;


/**
 * Default Mock User ID for testing.
 */
export const TEST_USER_ID = 'U00000000000000000000000000000000';
