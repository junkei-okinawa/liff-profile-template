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
      // window._env_ は空、import.meta.env にも未設定 → デフォルト値を返す
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

    it('should use import.meta.env.VITE_TERMS_UPDATED_AT as fallback when window._env_ is not set', async () => {
      // ビルド時環境変数（import.meta.env）はランタイムの次のフォールバック
      vi.stubEnv('VITE_TERMS_UPDATED_AT', '2025-12-31T00:00:00.000Z');
      vi.resetModules();
      const { TERMS_UPDATED_AT } = await import('./shared-constants');
      expect(TERMS_UPDATED_AT).toBe('2025-12-31T00:00:00.000Z');
    });
  });
});
