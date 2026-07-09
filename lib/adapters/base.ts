import { hostMatches, pick, sleep } from '../tangent/dom';
import type { LLMAdapter, SelectorReport } from './types';

/** How long to wait after inserting text before the framework enables the send button. */
const COMPOSER_SETTLE_MS = 150;

/** The provider-specific selectors a DOM adapter needs. Add a provider by filling these in. */
export interface AdapterSelectors {
  /** An assistant reply element. */
  assistantMessage: string;
  /** Any message element (user or assistant). */
  anyMessage: string;
  /** Ancestor selector for the whole turn (hidden so a sent message leaves no trace). */
  turnWrapper: string;
  /** Attribute holding a stable message id, or '' to use synthetic ids. */
  messageIdAttr: string;
  /** Candidate selectors for the rendered prose inside an assistant message (first match wins). */
  answerContent: string[];
  /** Candidate selectors for the composer input (first match wins). */
  composer: string[];
  /** Candidate selectors for the send button. */
  sendButton: string[];
  /** Selectors that exist only while the model is generating. */
  streaming: string[];
  /** Captures the conversation id from `location.pathname` in group 1. */
  conversationPath: RegExp;
}

/**
 * Shared implementation of every adapter behaviour in terms of `selectors`. Concrete adapters
 * only declare identity + selectors; override a method here only when a provider is unusual.
 */
export abstract class BaseDomAdapter implements LLMAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly hostPatterns: string[];
  protected abstract readonly selectors: AdapterSelectors;

  private readonly synthIds = new WeakMap<HTMLElement, string>();
  private synthCounter = 0;

  matchesHost(host: string): boolean {
    return this.hostPatterns.some((pattern) => hostMatches(pattern, host));
  }

  assistantMessageContaining(node: Node): HTMLElement | null {
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return el?.closest<HTMLElement>(this.selectors.assistantMessage) ?? null;
  }

  messageElements(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>(this.selectors.anyMessage)];
  }

  messageId(el: HTMLElement): string {
    const attr = this.selectors.messageIdAttr ? el.getAttribute(this.selectors.messageIdAttr) : null;
    if (attr) return attr;
    let id = this.synthIds.get(el);
    if (!id) {
      id = `st-${++this.synthCounter}`;
      this.synthIds.set(el, id);
    }
    return id;
  }

  isAssistant(el: HTMLElement): boolean {
    return el.matches(this.selectors.assistantMessage);
  }

  turnWrapper(el: HTMLElement): HTMLElement {
    return el.closest<HTMLElement>(this.selectors.turnWrapper) ?? el;
  }

  cleanAnswer(el: HTMLElement): HTMLElement {
    const source = pick(el, this.selectors.answerContent) ?? el;
    const clone = source.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll('button,[role="button"],svg,[data-testid],textarea,input,form')
      .forEach((n) => n.remove());
    return clone;
  }

  isStreaming(): boolean {
    return this.selectors.streaming.some((s) => pick(document, [s]) != null);
  }

  stop(): void {
    (pick(document, this.selectors.streaming) as HTMLButtonElement | null)?.click();
  }

  conversationId(): string {
    return location.pathname.match(this.selectors.conversationPath)?.[1] ?? '';
  }

  findMessageById(id: string): HTMLElement | null {
    if (!this.selectors.messageIdAttr || !id) return null;
    return document.querySelector<HTMLElement>(`[${this.selectors.messageIdAttr}="${CSS.escape(id)}"]`);
  }

  checkSelectors(): SelectorReport {
    // The composer is the one element present on every chat page (even an empty conversation), so a
    // missing composer is the most reliable signal that the provider's DOM has changed under us.
    const missing = pick(document, this.selectors.composer) ? [] : ['composer'];
    return { ok: missing.length === 0, missing };
  }

  async send(text: string): Promise<void> {
    const composer = pick(document, this.selectors.composer);
    if (!composer) throw new Error(`${this.name}: composer not found (selectors may have changed)`);
    composer.focus();
    this.insertText(composer, text);
    await sleep(COMPOSER_SETTLE_MS);
    this.submit(composer);
  }

  /** Put `text` into the composer. Override if a provider needs a different input method. */
  protected insertText(composer: HTMLElement, text: string): void {
    if (composer instanceof HTMLTextAreaElement) {
      // React-controlled textarea: use the native value setter, then fire input.
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setValue?.call(composer, text);
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    // contenteditable (ProseMirror): a synthetic paste is the most reliable insert.
    const data = new DataTransfer();
    data.setData('text/plain', text);
    composer.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }

  /** Submit the composer via its send button, falling back to the Enter key. */
  protected submit(composer: HTMLElement): void {
    const button = pick(document, this.selectors.sendButton) as HTMLButtonElement | null;
    if (button && !button.disabled) {
      button.click();
      return;
    }
    composer.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }),
    );
  }
}
