import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// The algorithm/util test files run in the (faster) 'node' environment with no DOM at
// all, so only unmount React trees between tests when one was actually rendered.
afterEach(() => {
  if (typeof document !== 'undefined') cleanup();
});
