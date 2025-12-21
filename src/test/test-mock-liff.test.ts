import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    let mockLiffObject: any;

    beforeEach(() => {
        // Create a plain object to simulate liff
        mockLiffObject = {};
        // Reset mock state
        resetMockLiff(mockLiffObject);
        setupMockLiff(mockLiffObject);
    });

    it('should initialize with valid liffId', async () => {
        expect(mockLiffObject.init).toBeDefined();
        await expect(mockLiffObject.init({ liffId: 'valid-id' })).resolves.not.toThrow();
    });

    it('should reject init with invalid liffId', async () => {
        await expect(mockLiffObject.init({ liffId: '' })).rejects.toThrow('Invalid liffId');
        // @ts-ignore
        await expect(mockLiffObject.init({})).rejects.toThrow('Invalid liffId');
    });

    it('should handle login state', () => {
        expect(mockLiffObject.isLoggedIn()).toBe(true); // Default mock state
        
        mockLiffObject.logout();
        expect(mockLiffObject.isLoggedIn()).toBe(false);

        mockLiffObject.login();
        expect(mockLiffObject.isLoggedIn()).toBe(true);
    });

    it('should return mock profile', async () => {
        const profile = await mockLiffObject.getProfile();
        expect(profile).toHaveProperty('userId');
        expect(profile.displayName).toBe('Test User');
    });

    it('should return mock context', () => {
        const context = mockLiffObject.getContext();
        expect(context).not.toBeNull();
        expect(context?.type).toBe('utou');
    });
});
