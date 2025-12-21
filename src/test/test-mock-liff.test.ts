import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import liff from '@line/liff';

// Cast to any to access internal methods added by mock
const mockLiff = liff as any;

// Mock console.error to avoid noise
const originalConsoleError = console.error;
beforeEach(() => {
    console.error = () => {};
});
afterEach(() => {
    console.error = originalConsoleError;
});

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
        await expect(liff.init({ liffId: '' })).rejects.toThrow('[Mock LIFF] Invalid liffId');
        // @ts-ignore
        await expect(liff.init({})).rejects.toThrow('[Mock LIFF] Invalid liffId');
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
        expect(profile).toHaveProperty('userId');
        expect(profile.displayName).toBe('Test User');
    });

    it('should return mock context', () => {
        const context = liff.getContext();
        expect(context).not.toBeNull();
        expect(context?.type).toBe('utou');
    });
});
