import '@testing-library/jest-dom';
import { webcrypto } from 'node:crypto';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

if (typeof globalThis.crypto?.getRandomValues !== 'function') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
