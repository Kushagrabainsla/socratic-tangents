import { BaseDomAdapter, type AdapterSelectors } from './base';

/**
 * Claude (claude.ai). Best-effort selectors. Claude exposes fewer stable hooks than ChatGPT and
 * has no per-message id attribute (we fall back to synthetic ids). Expect to tune these against the
 * live DOM, exactly as we did for ChatGPT; nothing else in the codebase needs to change.
 */
export class ClaudeAdapter extends BaseDomAdapter {
  readonly id = 'claude';
  readonly name = 'Claude';
  readonly hostPatterns = ['claude.ai'];

  protected readonly selectors: AdapterSelectors = {
    assistantMessage: '.font-claude-message, [data-testid="assistant-message"]',
    anyMessage: '.font-claude-message, [data-testid="user-message"], [data-testid="assistant-message"]',
    turnWrapper: '[data-test-render-count], .font-claude-message',
    messageIdAttr: '', // no stable id attribute → synthetic ids
    answerContent: ['.prose', '[class*="prose"]', '.font-claude-message'],
    composer: ['div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]', 'textarea'],
    sendButton: ['button[aria-label="Send message" i]', 'button[aria-label*="Send" i]'],
    streaming: ['[data-is-streaming="true"]', 'button[aria-label*="Stop" i]'],
    conversationPath: /\/chat\/([0-9a-f-]+)/i,
  };
}
