import { titleFrom, type Tangent, type TangentMessage } from './model';

// Import is the counterpart to export: read a user-picked JSON file and turn it back into tangents.
// The file is untrusted input, so we validate every field and skip anything malformed rather than
// trust the shape.

/** Open a file picker and resolve the chosen file's text, or null if the user cancels. */
export function pickJsonFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      window.removeEventListener('focus', onRefocus);
      resolve(value);
    };
    // If focus returns to the window without a file chosen, the dialog was cancelled.
    const onRefocus = () => setTimeout(() => finish(null), 300);

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      const reader = new FileReader();
      reader.onload = () => finish(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => finish(null);
      reader.readAsText(file);
    });
    window.addEventListener('focus', onRefocus);
    input.click();
  });
}

/** Parse exported JSON into tangents. Throws if it isn't a JSON array; skips malformed entries. */
export function parseTangents(json: string): Tangent[] {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error('Expected a JSON array of tangents.');
  return data.map(toTangent).filter((tangent): tangent is Tangent => tangent !== null);
}

function toTangent(raw: unknown): Tangent | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const conversationId = asString(raw.conversationId);
  if (!id || !conversationId) return null;

  const anchorSource = isRecord(raw.anchor) ? raw.anchor : {};
  const messages = Array.isArray(raw.messages)
    ? raw.messages.map(toMessage).filter((message): message is TangentMessage => message !== null)
    : [];
  const now = Date.now();

  return {
    id,
    conversationId,
    anchor: {
      messageId: asString(anchorSource.messageId),
      quotedText: asString(anchorSource.quotedText),
      textHash: asString(anchorSource.textHash),
    },
    messages,
    hiddenTurnIds: Array.isArray(raw.hiddenTurnIds)
      ? raw.hiddenTurnIds.filter((value): value is string => typeof value === 'string')
      : [],
    title: asString(raw.title) || (messages[0] ? titleFrom(messages[0].text) : ''),
    createdAt: asNumber(raw.createdAt, now),
    updatedAt: asNumber(raw.updatedAt, now),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toMessage(value: unknown): TangentMessage | null {
  if (!isRecord(value)) return null;
  if (value.role !== 'user' && value.role !== 'assistant') return null;
  if (typeof value.text !== 'string') return null;
  const message: TangentMessage = { role: value.role, text: value.text };
  if (typeof value.html === 'string') message.html = value.html;
  return message;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
