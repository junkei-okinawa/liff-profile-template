// Mock implementation of @line/liff
// This file is used via Vite alias replacement when VITE_ENABLE_MOCK_LIFF is true.
import type { LiffConfig } from '@line/liff';
import { TEST_USER_ID } from '../shared-constants';

let isLoggedIn = true;

const mockLiff = {
    id: 'mock-liff-id',
    init: (config: LiffConfig) => {
        console.log('[Mock LIFF] init called', config);
        const liffId = config?.liffId;
        if (typeof liffId !== 'string' || liffId.trim() === '') {
            return Promise.reject(new Error('[Mock LIFF] liffId must be a non-empty string'));
        }
        return Promise.resolve();
    },
    getOS: () => 'web',
    getVersion: () => '2.21.0',
    getLanguage: () => 'ja',
    getAppLanguage: () => 'ja',
    isInClient: () => true,
    isLoggedIn: () => isLoggedIn,
    login: (config?: { redirectUri?: string }) => {
        console.log('[Mock LIFF] login called', config);
        isLoggedIn = true;
    },
    logout: () => {
        console.log('[Mock LIFF] logout called');
        isLoggedIn = false;
    },
    getProfile: () => Promise.resolve({
        userId: TEST_USER_ID,
        displayName: 'Test User',
        pictureUrl: 'https://example.com/avatar.png',
        statusMessage: 'Ready for test'
    }),
    getIDToken: () => `mock-user-${TEST_USER_ID}`,
    getAccessToken: () => 'mock-access-token',
    getContext: () => ({
        type: 'utou',
        userId: TEST_USER_ID,
        viewType: 'full',
        accessToken: 'mock-access-token',
        endpoint: 'https://example.com'
    }),
    closeWindow: () => {},
    sendMessages: (messages: any[]) => Promise.resolve(),
    openWindow: (params: { url: string; external?: boolean }) => {},
    shareTargetPicker: (messages: any[], options?: { isMultiple?: boolean }) => Promise.resolve(null),
    getFriendship: () => Promise.resolve({ friendFlag: true }),
    
    // Test utilities
    _reset: () => { isLoggedIn = true; }
};

export default mockLiff;
