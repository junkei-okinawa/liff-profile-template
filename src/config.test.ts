import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEnv, config } from './config';

describe('Config Module', () => {
  beforeEach(() => {
    vi.resetModules();
    // Reset window._env_
    (window as any)._env_ = undefined;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
      (window as any)._env_ = undefined;
      vi.stubEnv('TEST_VAR', 'build-time-value');

      expect(getEnv('TEST_VAR')).toBe('build-time-value');
    });

    it('should return correct values from config getters', () => {
      (window as any)._env_ = {
        VITE_API_BASE_URL: 'https://api.example.com',
        VITE_CHANNEL_ID: '1234567890',
        VITE_CALLBACK_URL: 'https://example.com/callback'
      };

      expect(config.apiBaseUrl).toBe('https://api.example.com');
      expect(config.liffId).toBe('1234567890');
      expect(config.callbackUrl).toBe('https://example.com/callback');
    });

    it('should fallback to VITE_LIFF_ID if VITE_CHANNEL_ID is missing', () => {
      (window as any)._env_ = {
        VITE_LIFF_ID: 'fallback-liff-id'
      };

      expect(config.liffId).toBe('fallback-liff-id');
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
