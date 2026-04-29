import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('shared-constants', () => {
  beforeEach(() => {
    (window as any)._env_ = {};
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    (window as any)._env_ = {};
  });

  describe('TERMS_UPDATED_AT', () => {
    it('should use DEFAULT_TERMS_UPDATED_AT when VITE_TERMS_UPDATED_AT is not set', async () => {
      // window._env_ は空。さらに process.env / import.meta.env に値が入っていても
      // テストが環境依存にならないよう、空文字を明示的に stub する。
      // getEnv 側が .trim() で空文字を未設定扱いにし、デフォルト値へフォールバックする前提。
      vi.stubEnv('VITE_TERMS_UPDATED_AT', '');
      vi.resetModules();
      const { TERMS_UPDATED_AT } = await import('./shared-constants');
      expect(TERMS_UPDATED_AT).toBe('2026-01-01T00:00:00.000Z');
    });

    it('should use window._env_.VITE_TERMS_UPDATED_AT when set (runtime env takes priority)', async () => {
      // ランタイム環境変数（window._env_）が最優先
      (window as any)._env_ = { VITE_TERMS_UPDATED_AT: '2025-06-01T00:00:00.000Z' };
      vi.resetModules();
      const { TERMS_UPDATED_AT } = await import('./shared-constants');
      expect(TERMS_UPDATED_AT).toBe('2025-06-01T00:00:00.000Z');
    });

    it('should use build-time env (import.meta.env / process.env) as fallback when window._env_ has no matching key', async () => {
      // window._env_ にキーが無い場合、ビルド時環境変数（import.meta.env / process.env）へフォールバックする。
      // vi.stubEnv は import.meta.env と process.env の両方に値を設定する。
      vi.stubEnv('VITE_TERMS_UPDATED_AT', '2025-12-31T00:00:00.000Z');
      vi.resetModules();
      const { TERMS_UPDATED_AT } = await import('./shared-constants');
      expect(TERMS_UPDATED_AT).toBe('2025-12-31T00:00:00.000Z');
    });
  });
});
