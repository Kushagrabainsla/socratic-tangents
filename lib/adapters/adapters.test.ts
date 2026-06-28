import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChatGPTAdapter } from './chatgpt';
import { ClaudeAdapter } from './claude';

// Contract tests: if a provider changes its DOM, these fail loudly so we notice selector rot before
// users do. The fixtures mirror the real structure closely enough to exercise every core selector.

const CHATGPT_FIXTURE = `
  <main>
    <div data-testid="conversation-turn-1"><article>
      <div data-message-author-role="user" data-message-id="u1"><div class="markdown">hello</div></div>
    </article></div>
    <div data-testid="conversation-turn-2"><article>
      <div data-message-author-role="assistant" data-message-id="a1">
        <div class="markdown"><p>The answer.</p><button>copy</button></div>
      </div>
    </article></div>
    <form>
      <div id="prompt-textarea" contenteditable="true"></div>
      <button data-testid="send-button">send</button>
    </form>
  </main>`;

const CLAUDE_FIXTURE = `
  <div data-test-render-count="1">
    <div data-testid="user-message"><div class="prose">hi</div></div>
  </div>
  <div data-test-render-count="2">
    <div class="font-claude-message"><div class="prose"><p>Claude answer.</p><svg></svg></div></div>
  </div>
  <div contenteditable="true" class="ProseMirror"></div>
  <button aria-label="Send message">send</button>`;

afterEach(() => {
  document.body.innerHTML = '';
  window.history.pushState({}, '', '/');
});

describe('ChatGPTAdapter', () => {
  const adapter = new ChatGPTAdapter();

  beforeEach(() => {
    document.body.innerHTML = CHATGPT_FIXTURE;
  });

  it('matches its host and not others', () => {
    expect(adapter.matchesHost('chatgpt.com')).toBe(true);
    expect(adapter.matchesHost('claude.ai')).toBe(false);
  });

  it('finds user and assistant messages', () => {
    expect(adapter.messageElements()).toHaveLength(2);
    const assistant = document.querySelector<HTMLElement>('[data-message-author-role="assistant"]')!;
    const user = document.querySelector<HTMLElement>('[data-message-author-role="user"]')!;
    expect(adapter.isAssistant(assistant)).toBe(true);
    expect(adapter.isAssistant(user)).toBe(false);
  });

  it('resolves the assistant message from an inner node and by id', () => {
    const inner = document.querySelector('[data-message-author-role="assistant"] .markdown')!;
    const assistant = adapter.assistantMessageContaining(inner.firstChild!);
    expect(assistant).not.toBeNull();
    expect(adapter.messageId(assistant!)).toBe('a1');
    expect(adapter.findMessageById('a1')).toBe(assistant);
  });

  it('finds a turn wrapper that contains the message', () => {
    const assistant = document.querySelector<HTMLElement>('[data-message-author-role="assistant"]')!;
    const wrapper = adapter.turnWrapper(assistant);
    expect(wrapper).not.toBe(assistant);
    expect(wrapper.contains(assistant)).toBe(true);
  });

  it('cleans the answer to its prose, stripping controls', () => {
    const assistant = document.querySelector<HTMLElement>('[data-message-author-role="assistant"]')!;
    const clean = adapter.cleanAnswer(assistant);
    expect(clean.textContent).toContain('The answer.');
    expect(clean.querySelector('button')).toBeNull();
  });

  it('reports healthy selectors, and broken when the composer is gone', () => {
    expect(adapter.checkSelectors().ok).toBe(true);
    document.querySelector('#prompt-textarea')!.remove();
    const report = adapter.checkSelectors();
    expect(report.ok).toBe(false);
    expect(report.missing).toContain('composer');
  });

  it('detects streaming from the stop control', () => {
    expect(adapter.isStreaming()).toBe(false);
    const stop = document.createElement('button');
    stop.setAttribute('data-testid', 'stop-button');
    document.body.appendChild(stop);
    expect(adapter.isStreaming()).toBe(true);
  });

  it('reads the conversation id from the path', () => {
    window.history.pushState({}, '', '/c/abc-123');
    expect(adapter.conversationId()).toBe('abc-123');
  });
});

describe('ClaudeAdapter', () => {
  const adapter = new ClaudeAdapter();

  beforeEach(() => {
    document.body.innerHTML = CLAUDE_FIXTURE;
  });

  it('matches its host', () => {
    expect(adapter.matchesHost('claude.ai')).toBe(true);
    expect(adapter.matchesHost('chatgpt.com')).toBe(false);
  });

  it('finds user and assistant messages', () => {
    expect(adapter.messageElements()).toHaveLength(2);
    const assistant = document.querySelector<HTMLElement>('.font-claude-message')!;
    expect(adapter.isAssistant(assistant)).toBe(true);
  });

  it('gives a stable synthetic id when the provider has none', () => {
    const assistant = document.querySelector<HTMLElement>('.font-claude-message')!;
    const id = adapter.messageId(assistant);
    expect(id).not.toBe('');
    expect(adapter.messageId(assistant)).toBe(id);
    expect(adapter.findMessageById(id)).toBeNull();
  });

  it('cleans the answer to its prose, stripping controls', () => {
    const assistant = document.querySelector<HTMLElement>('.font-claude-message')!;
    const clean = adapter.cleanAnswer(assistant);
    expect(clean.textContent).toContain('Claude answer.');
    expect(clean.querySelector('svg')).toBeNull();
  });

  it('reports healthy selectors, and broken when the composer is gone', () => {
    expect(adapter.checkSelectors().ok).toBe(true);
    document.querySelector('.ProseMirror')!.remove();
    expect(adapter.checkSelectors().ok).toBe(false);
  });

  it('detects streaming from the streaming flag', () => {
    expect(adapter.isStreaming()).toBe(false);
    const streaming = document.createElement('div');
    streaming.setAttribute('data-is-streaming', 'true');
    document.body.appendChild(streaming);
    expect(adapter.isStreaming()).toBe(true);
  });

  it('reads the conversation id from the path', () => {
    window.history.pushState({}, '', '/chat/2f8c1a4b-90ab');
    expect(adapter.conversationId()).toBe('2f8c1a4b-90ab');
  });
});
