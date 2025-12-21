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

// Ensure mock LIFF is in a clean initial state and expose helpers when mock mode is enabled
export const setupMockLiff = () => {
    if (import.meta.env.VITE_ENABLE_MOCK_LIFF === 'true' || import.meta.env.MODE === 'test') {
        // Reset mock state so each invocation starts from a known baseline
        resetMockLiff();

        // Re-expose resetMockLiff on window (idempotent) for E2E tests
        if (typeof window !== 'undefined') {
            (window as any).resetMockLiff = resetMockLiff;
        }
    }
};
