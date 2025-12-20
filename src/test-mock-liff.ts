import liff from '@line/liff';

interface MockLiffState {
    isLoggedIn: boolean;
}

// Use WeakMap to store mock state separately from the liff object
const mockStateMap = new WeakMap<typeof liff, MockLiffState>();

// Reset the mock state to initial values
export const resetMockLiff = () => {
    const state = mockStateMap.get(liff);
    if (state) {
        state.isLoggedIn = true;
    }
};

export const setupMockLiff = () => {
    // Ensure clean state on setup
    if (mockStateMap.has(liff)) {
        resetMockLiff();
        return;
    }

    // Initialize mock state
    mockStateMap.set(liff, {
        isLoggedIn: true,
    });

    Object.assign(liff, {
        init: function (config?: { liffId?: string }) {
            const liffId = config && (config as any).liffId;
            if (typeof liffId !== 'string' || liffId.trim() === '') {
                return Promise.reject(new Error('[Mock LIFF] Invalid liffId passed to init'));
            }
            return Promise.resolve();
        },
        isLoggedIn: function () {
            const state = mockStateMap.get(liff);
            return state ? state.isLoggedIn : false;
        },
        isInClient: () => true,
        getLanguage: () => 'ja',
        getVersion: () => '2.21.0',
        getAppLanguage: () => 'ja',
        getOS: () => 'web',
        getProfile: () => Promise.resolve({
            userId: 'U00000000000000000000000000000000',
            displayName: 'Test User',
            pictureUrl: 'https://example.com/avatar.png',
            statusMessage: 'Ready for test'
        }),
        getIDToken: () => 'mock-user-U00000000000000000000000000000000',
        getAccessToken: () => 'mock-access-token',
        getContext: () => ({
            type: 'utou',
            userId: 'U00000000000000000000000000000000',
            viewType: 'full',
            accessToken: 'mock-access-token',
            endpoint: 'https://example.com'
        }),
        login: function () {
            const state = mockStateMap.get(liff);
            if (state) {
                state.isLoggedIn = true;
            }
        },
        closeWindow: function () {
            // Mock implementation - no-op for testing
        },
        logout: function () {
            const state = mockStateMap.get(liff);
            if (state) {
                state.isLoggedIn = false;
            }
        },
        sendMessages: function () {
            return Promise.resolve();
        },
        openWindow: function () {
            // Mock implementation - no-op for testing
        },
        shareTargetPicker: function () {
            return Promise.resolve();
        },
        getFriendship: function () {
            return Promise.resolve({ friendFlag: true });
        },
    });
};
