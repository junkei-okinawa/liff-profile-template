import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.alert
window.alert = vi.fn();

// Mock window._env_ for runtime config
Object.defineProperty(window, '_env_', {
  value: {},
  writable: true
});

// Optional: Mock console.error to suppress expected error logs during tests
// Uncomment if you want to silence all error logs
// const originalConsoleError = console.error;
// console.error = (...args) => {
//   if (typeof args[0] === 'string' && (
//     args[0].includes('Terms rendering error') ||
//     args[0].includes('API check failed') ||
//     args[0].includes('Profile rendering error') ||
//     args[0].includes('Unsubscribe page error') ||
//     args[0].includes('Failed to get profile')
//   )) {
//     return;
//   }
//   originalConsoleError(...args);
// };
