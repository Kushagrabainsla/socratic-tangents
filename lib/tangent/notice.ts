import { isDark } from './theme';

// A small, dismissible toast for the rare moments we need to talk to the user: a broken-selector
// warning, an import result, or the first-run hint. Theme-aware; stacks bottom-center.

export interface NoticeOptions {
  /** Optional action button (e.g. "Got it"). When present, the toast stays until dismissed. */
  actionLabel?: string;
  onAction?: () => void;
  /** Auto-dismiss delay for toasts without an action. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 6000;

export function showNotice(message: string, options: NoticeOptions = {}): void {
  const notice = document.createElement('div');
  notice.className = 'st-notice';
  notice.dataset.stTheme = isDark() ? 'dark' : 'light';
  notice.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.className = 'st-notice-text';
  text.textContent = message;
  notice.appendChild(text);

  const dismiss = () => notice.remove();

  if (options.actionLabel) {
    const action = document.createElement('button');
    action.className = 'st-notice-action';
    action.textContent = options.actionLabel;
    action.addEventListener('click', () => {
      options.onAction?.();
      dismiss();
    });
    notice.appendChild(action);
  }

  const close = document.createElement('button');
  close.className = 'st-notice-close';
  close.title = 'Dismiss';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '✕';
  close.addEventListener('click', dismiss);
  notice.appendChild(close);

  host().appendChild(notice);

  if (!options.actionLabel) {
    setTimeout(dismiss, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  }
}

/** A single fixed container so multiple toasts stack instead of overlapping. */
function host(): HTMLElement {
  const existing = document.getElementById('st-notice-host');
  if (existing) return existing;
  const created = document.createElement('div');
  created.id = 'st-notice-host';
  created.className = 'st-notice-host';
  created.dataset.stUi = '1';
  document.body.appendChild(created);
  return created;
}
