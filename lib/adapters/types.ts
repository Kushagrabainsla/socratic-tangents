// A provider adapter encapsulates EVERYTHING DOM-specific about one LLM web app.
// The tangent engine and UI are written purely against this interface, so adding a new LLM
// means implementing this once (usually via BaseDomAdapter) and registering it — no core changes.
export interface LLMAdapter {
  readonly id: string;
  readonly name: string;
  /** Bare-host patterns this adapter handles, e.g. ['chatgpt.com']. */
  readonly hostPatterns: string[];
  matchesHost(host: string): boolean;

  /** The assistant-message element that contains `node`, or null if it isn't in one. */
  assistantMessageContaining(node: Node): HTMLElement | null;
  /** Every message element (user + assistant) currently rendered. */
  messageElements(): HTMLElement[];
  /** A stable id for a message element, used to detect newly-added turns. */
  messageId(el: HTMLElement): string;
  /** Whether a message element is an assistant reply. */
  isAssistant(el: HTMLElement): boolean;
  /** The turn wrapper to hide so a sent message leaves no visible trace in the thread. */
  turnWrapper(el: HTMLElement): HTMLElement;
  /** A cloned, controls-stripped copy of an assistant reply's rendered content. */
  cleanAnswer(el: HTMLElement): HTMLElement;

  /** Send `text` through the site's own composer (the page runs its real anti-abuse pipeline). */
  send(text: string): Promise<void>;
  /** Whether the model is currently generating. */
  isStreaming(): boolean;
}
