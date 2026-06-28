import type { Tangent } from './model';

// Export a conversation's tangents so the user can keep them. Markdown reads as a transcript; JSON is
// a faithful backup of the stored model. Both run entirely in the page via a Blob download.

/** Serialize tangents to a readable Markdown transcript. */
export function toMarkdown(tangents: Tangent[]): string {
  const body = tangents.map(tangentToMarkdown).join('\n---\n\n');
  return `# Tangents\n\n${body}`.trimEnd() + '\n';
}

function tangentToMarkdown(tangent: Tangent): string {
  const lines = [`## ${tangent.title || 'Untitled tangent'}`, ''];
  if (tangent.anchor.quotedText) {
    lines.push(`> ${tangent.anchor.quotedText.replace(/\n/g, '\n> ')}`, '');
  }
  for (const message of tangent.messages) {
    lines.push(message.role === 'user' ? `**You:** ${message.text}` : message.text, '');
  }
  return lines.join('\n');
}

/** Serialize tangents to JSON, a faithful backup of what is stored. */
export function toJson(tangents: Tangent[]): string {
  return JSON.stringify(tangents, null, 2);
}

export type ExportFormat = 'md' | 'json';

/** Build a stable, descriptive download name like `socratic-tangents-a1b2c3d4-2026-06-26.md`. */
export function exportFilename(conversationId: string, format: ExportFormat, now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  const id = conversationId ? `-${conversationId.slice(0, 8)}` : '';
  return `socratic-tangents${id}-${date}.${format}`;
}

/** Download a conversation's tangents in the chosen format. No-op when there are none. */
export function downloadTangents(tangents: Tangent[], format: ExportFormat): void {
  if (tangents.length === 0) return;
  const isJson = format === 'json';
  const content = isJson ? toJson(tangents) : toMarkdown(tangents);
  const mime = isJson ? 'application/json' : 'text/markdown';
  const name = exportFilename(tangents[0]?.conversationId ?? '', format);
  triggerDownload(name, content, mime);
}

function triggerDownload(name: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
