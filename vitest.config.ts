import { defineConfig } from 'vitest/config';

// Unit tests target the provider-agnostic core (model, dom, anchor, engine, store). happy-dom gives
// us a real-enough DOM; the store test mocks wxt/browser directly, so no extension runtime is needed.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['lib/**/*.test.ts'],
    restoreMocks: true,
  },
});
