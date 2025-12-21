import liff from '@line/liff';

interface MockLiffState {
    isLoggedIn: boolean;
}

// Use WeakMap to store mock state separately from the liff object
const mockStateMap = new WeakMap<any, MockLiffState>();

// Reset the mock state to initial values
export const resetMockLiff = (liffInstance: any = liff) => {
    let state = mockStateMap.get(liffInstance);
    if (!state) {
        state = { isLoggedIn: true };
        mockStateMap.set(liffInstance, state);
        return;
    }
    state.isLoggedIn = true;
};

// Expose resetMockLiff to window for E2E tests
if (typeof window !== 'undefined') {
    (window as any).resetMockLiff = resetMockLiff;
}

export const setupMockLiff = (liffInstance: any = liff) => {
    // Ensure clean state on setup
    resetMockLiff(liffInstance);

    const mockMethods: Record<string, any> = {
        init: (config?: { liffId: string }) => {
            const liffId = config?.liffId;
            if (typeof liffId !== 'string' || liffId.trim() === '') {
                return Promise.reject(new Error('[Mock LIFF] Invalid liffId passed to init'));
            }
            return Promise.resolve();
        },
        isLoggedIn: () => {
            const state = mockStateMap.get(liffInstance);
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
        login: (loginConfig?: { redirectUri?: string }) => {
            const state = mockStateMap.get(liffInstance);
            if (state) state.isLoggedIn = true;
        },
        logout: () => {
            const state = mockStateMap.get(liffInstance);
            if (state) state.isLoggedIn = false;
        },
        closeWindow: () => {},
        sendMessages: () => Promise.resolve(),
        openWindow: () => {},
        shareTargetPicker: () => Promise.resolve(null),
        getFriendship: () => Promise.resolve({ friendFlag: true }),
    };

    // Use Object.defineProperty to overwrite properties even if they are read-only in the original object
    Object.keys(mockMethods).forEach(key => {
        Object.defineProperty(liffInstance, key, {
            value: mockMethods[key],
            writable: true,
            configurable: true
        });
    });
};
