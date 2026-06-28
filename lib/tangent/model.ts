// The domain model for tangents. Plain data, no DOM or storage concerns.

export interface TangentMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** How we find the tangented passage again after a reload or DOM change. */
export interface Anchor {
  messageId: string;
  quotedText: string;
  textHash: string;
}

export interface Tangent {
  id: string;
  conversationId: string;
  anchor: Anchor;
  messages: TangentMessage[];
  /** Provider message ids of the hidden turns this tangent sent, so we can re-hide them on reload. */
  hiddenTurnIds: string[];
  title: string;
  createdAt: number;
  updatedAt: number;
}

export function newId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** A stable, whitespace-insensitive hash of a message's text (fallback for re-anchoring). */
export function hashText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 33 + normalized.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

const TITLE_MAX = 48;

export function titleFrom(question: string): string {
  const text = question.replace(/\s+/g, ' ').trim();
  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text;
}
