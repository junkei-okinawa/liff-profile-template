import liff from '@line/liff';

// Cast to any to access internal methods added by mock
const mockLiff = liff as any;

// Reset the mock state to initial values
export const resetMockLiff = (liffInstance: any = liff) => {
    if (mockLiff._reset) {
        mockLiff._reset();
    }
    // Also try to reset isLoggedIn property if exposed
    if (typeof liffInstance === 'object') {
        // This might not work if properties are read-only, but liff-mock.ts handles state internally
    }
};

// Expose resetMockLiff to window for E2E tests
if (typeof window !== 'undefined') {
    (window as any).resetMockLiff = resetMockLiff;
}

// No-op, as setup is handled by alias replacement when VITE_ENABLE_MOCK_LIFF is true
export const setupMockLiff = (liffInstance: any = liff) => {
    // Do nothing. Initialization is handled by the mock module itself.
    // Calling resetMockLiff() here would reset isLoggedIn to false, which breaks E2E tests expecting logged-in state.
};
