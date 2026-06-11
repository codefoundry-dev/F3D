import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom does not implement matchMedia; several UI components (e.g. the shared
// DotActionsMenu) call it in an effect. Provide a desktop-default stub so those
// effects do not throw during tests.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}
