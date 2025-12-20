import liff from '@line/liff';

// Reset the mock state to initial values
export const resetMockLiff = () => {
    if ((liff as any)._mockState) {
        (liff as any)._mockState = {
            isLoggedIn: true,
            calls: [],
        };
        console.log('[Mock LIFF] State reset');
    }
};

export const setupMockLiff = () => {
    // Ensure clean state on setup
    if ((liff as any)._mockState) {
        resetMockLiff();
        return;
    }

    Object.assign(liff, {
        _mockState: {
            isLoggedIn: true,
            calls: [] as string[],
        },
        init: () => Promise.resolve(),
        isLoggedIn: function () {
            return (this as any)._mockState.isLoggedIn;
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
            (this as any)._mockState.calls.push('login');
            (this as any)._mockState.isLoggedIn = true;
            console.log('[Mock LIFF] login called');
        },
        closeWindow: function () {
            (this as any)._mockState.calls.push('closeWindow');
            console.log('[Mock LIFF] closeWindow called');
        },
        logout: function () {
            (this as any)._mockState.calls.push('logout');
            (this as any)._mockState.isLoggedIn = false;
            console.log('[Mock LIFF] logout called');
        },
    });
};
