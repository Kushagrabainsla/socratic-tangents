import { hostMatches, pick, sleep } from '../tangent/dom';
import type { LLMAdapter } from './types';

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
    clone.querySelectorAll('button,[role="button"],svg,[data-testid],textarea,input,form').forEach((n) => n.remove());
    return clone;
  }

  isStreaming(): boolean {
    return this.selectors.streaming.some((s) => document.querySelector(s) != null);
  }

  async send(text: string): Promise<void> {
    const composer = pick(document, this.selectors.composer);
    if (!composer) throw new Error(`${this.name}: composer not found (selectors may have changed)`);
    composer.focus();

    if (composer instanceof HTMLTextAreaElement) {
      // React-controlled textarea: use the native value setter, then fire input.
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(composer, text);
      composer.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // contenteditable (ProseMirror): a synthetic paste is the most reliable insert.
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      composer.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }

    await sleep(150); // let the framework enable the send button
    const btn = pick(document, this.selectors.sendButton) as HTMLButtonElement | null;
    if (btn && !btn.disabled) {
      btn.click();
      return;
    }
    composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
  }
}
