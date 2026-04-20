import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEnv, config } from './config';

describe('Config Module', () => {
  beforeEach(() => {
    vi.resetModules();
    // Reset window._env_
    (window as any)._env_ = {};
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    (window as any)._env_ = {};
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
      (window as any)._env_ = undefined;
      vi.stubEnv('TEST_VAR', 'build-time-value');

      expect(getEnv('TEST_VAR')).toBe('build-time-value');
    });

    it('should return correct values from config getters', () => {
      (window as any)._env_ = {
        VITE_API_BASE_URL: 'https://api.example.com',
        VITE_LIFF_ID: '1234567890',
        VITE_CALLBACK_URL: 'https://example.com/callback'
      };

      expect(config.apiBaseUrl).toBe('https://api.example.com');
      expect(config.liffId).toBe('1234567890');
      expect(config.callbackUrl).toBe('https://example.com/callback');
    });

    it('should read liffId from VITE_LIFF_ID', () => {
      (window as any)._env_ = {
        VITE_LIFF_ID: 'test-liff-id'
      };

      expect(config.liffId).toBe('test-liff-id');
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
