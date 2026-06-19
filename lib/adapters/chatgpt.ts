import { BaseDomAdapter, type AdapterSelectors } from './base';

/** ChatGPT (chatgpt.com). Verified against the live DOM during the Phase 0 spike. */
export class ChatGPTAdapter extends BaseDomAdapter {
  readonly id = 'chatgpt';
  readonly name = 'ChatGPT';
  readonly hostPatterns = ['chatgpt.com'];

  protected readonly selectors: AdapterSelectors = {
    assistantMessage: '[data-message-author-role="assistant"]',
    anyMessage: '[data-message-author-role]',
    turnWrapper: '[data-testid^="conversation-turn"], article',
    messageIdAttr: 'data-message-id',
    answerContent: ['.markdown', '[class*="markdown"]', '.prose'],
    composer: ['#prompt-textarea', 'div[contenteditable="true"]', 'textarea'],
    sendButton: ['[data-testid="send-button"]', 'button[aria-label*="Send" i]'],
    streaming: ['[data-testid="stop-button"]', 'button[aria-label*="Stop" i]'],
    conversationPath: /\/c\/([0-9a-f-]+)/i,
  };
}
