import liff from '@line/liff';

// Cast to any to access internal methods added by mock
const mockLiff = liff as any;

// Reset the mock state to initial values
export const resetMockLiff = () => {
    if (mockLiff._reset) {
        mockLiff._reset();
    }
};

// Expose resetMockLiff to window for E2E tests ONLY in mock mode
if (typeof window !== 'undefined' && import.meta.env.VITE_ENABLE_MOCK_LIFF === 'true') {
    (window as any).resetMockLiff = resetMockLiff;
}

// No-op, as setup is handled by alias replacement when VITE_ENABLE_MOCK_LIFF is true
export const setupMockLiff = () => {
    // Do nothing. Initialization is handled by the mock module itself via Vite alias.
};
