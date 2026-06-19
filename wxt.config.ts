import { defineConfig } from 'wxt';

// Inline tangents run entirely in a content script; no background, panel, or extra permissions.
export default defineConfig({
  manifest: {
    name: 'Socratic Tangents',
    description: 'Branch off any part of an AI reply, inline, without losing your place.',
    permissions: ['storage'],
    host_permissions: ['https://chatgpt.com/*', 'https://*.chatgpt.com/*', 'https://claude.ai/*'],
  },
});
