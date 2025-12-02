import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEnv, config } from './config';

describe('Config Module', () => {
  beforeEach(() => {
    vi.resetModules();
    // Reset window._env_
    // delete (window as any)._env_;
    (window as any)._env_ = undefined;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    // delete (window as any)._env_;
    (window as any)._env_ = undefined;
  });

  describe('getEnv', () => {
    it('should prioritize runtime environment variables (window._env_)', () => {
      (window as any)._env_ = {
        TEST_VAR: 'runtime-value'
      };
      vi.stubEnv('TEST_VAR', 'build-time-value');

      expect(getEnv('TEST_VAR')).toBe('runtime-value');
    });

    it('should fall back to build-time environment variables (import.meta.env)', () => {
      vi.stubEnv('TEST_VAR', 'build-time-value');

      expect(getEnv('TEST_VAR')).toBe('build-time-value');
    });

    it('should return empty string if variable is not found', () => {
      expect(getEnv('NON_EXISTENT_VAR')).toBe('');
    });

    it('should handle undefined window._env_', () => {
      // delete (window as any)._env_;
      (window as any)._env_ = undefined;
      vi.stubEnv('TEST_VAR', 'build-time-value');

      expect(getEnv('TEST_VAR')).toBe('build-time-value');
    });
  });

  describe('config object', () => {
    it('should export expected properties', () => {
      expect(config).toHaveProperty('apiBaseUrl');
      expect(config).toHaveProperty('liffId');
      expect(config).toHaveProperty('callbackUrl');
    });
  });
});
