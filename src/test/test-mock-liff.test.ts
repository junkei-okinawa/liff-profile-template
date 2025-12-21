import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import liff from '@line/liff';
import { setupMockLiff, resetMockLiff } from '../test-mock-liff';

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
        // Reset liff object and mock state before each test
        resetMockLiff();
        // Since setupMockLiff modifies the global liff object, 
        // we might need to be careful. However, liff is a singleton in this context.
        setupMockLiff();
    });

    it('should initialize with valid liffId', async () => {
        await expect(liff.init({ liffId: 'valid-id' })).resolves.not.toThrow();
    });

    it('should reject init with invalid liffId', async () => {
        await expect(liff.init({ liffId: '' })).rejects.toThrow('Invalid liffId');
        // @ts-ignore
        await expect(liff.init({})).rejects.toThrow('Invalid liffId');
    });

    it('should handle login state', () => {
        expect(liff.isLoggedIn()).toBe(true); // Default mock state
        
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
