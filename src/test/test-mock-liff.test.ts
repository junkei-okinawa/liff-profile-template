import { describe, it, expect, beforeEach, vi } from 'vitest';
import liff from '@line/liff';
import { TEST_USER_ID } from '../shared-constants';

// Cast to any to access internal methods added by mock
const mockLiff = liff as any;

describe('Mock LIFF', () => {
    beforeEach(() => {
        // Reset mock state
        if (mockLiff._reset) {
            mockLiff._reset();
        }
    });

    it('should initialize with valid liffId', async () => {
        expect(liff.init).toBeDefined();
        await expect(liff.init({ liffId: 'valid-id' })).resolves.toBeUndefined();
    });

    it('should reject init with invalid liffId', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(liff.init({ liffId: '' })).rejects.toThrow('[Mock LIFF] liffId must be a non-empty string');
        // @ts-ignore
        await expect(liff.init({})).rejects.toThrow('[Mock LIFF] liffId must be a non-empty string');
        spy.mockRestore();
    });

    it('should handle login state', () => {
        // Initial state is true after reset in liff-mock.ts
        expect(liff.isLoggedIn()).toBe(true); 
        
        liff.logout();
        expect(liff.isLoggedIn()).toBe(false);

        liff.login();
        expect(liff.isLoggedIn()).toBe(true);
    });

    it('should return mock profile', async () => {
        const profile = await liff.getProfile();
        expect(profile.userId).toBe(TEST_USER_ID);
        expect(profile.displayName).toBe('Test User');
    });

    it('should return mock context', () => {
        const context = liff.getContext();
        expect(context).not.toBeNull();
        expect(context?.userId).toBe(TEST_USER_ID);
        expect(context?.type).toBe('utou');
    });
});
