// Turn stored or imported answer HTML back into a safe DOM subtree. Answer content originates from
// the provider's own rendered markdown, but once persisted (or imported from a file a user could edit
// by hand) it is untrusted. So we never inject it as raw innerHTML: we rebuild it from a strict
// allowlist. Only known tags and attributes survive, scripts and event handlers are dropped, and
// links and images are restricted to safe URL schemes. Classes are kept so the host page's own CSS
// styles the answer exactly as it looks inline.

const ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
  'var',
]);

// Tags whose contents are unsafe or meaningless as text: drop the element and everything inside it.
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'template',
  'link',
  'meta',
  'base',
  'noscript',
  'svg',
  'math',
  'head',
  'title',
]);

// Attributes safe to keep on any allowed element (styling classes, table spans, list markers, a11y).
const ALLOWED_ATTRS = new Set([
  'class',
  'title',
  'alt',
  'lang',
  'dir',
  'colspan',
  'rowspan',
  'start',
  'reversed',
  'type',
  'open',
  'align',
  'headers',
  'scope',
]);

/** Build a safe, detached fragment from an HTML string. Inert: parsing runs no scripts and loads no
 *  resources (DOMParser has no browsing context), and the result contains only allowlisted nodes. */
export function sanitizeHtml(html: string): DocumentFragment {
  const source = new DOMParser().parseFromString(html, 'text/html');
  const fragment = document.createDocumentFragment();
  for (const child of [...source.body.childNodes]) {
    const clean = cleanNode(child);
    if (clean) fragment.appendChild(clean);
  }
  return fragment;
}

/** Serialize a live answer element to a sanitized HTML string, for storage. */
export function toSafeHtml(source: HTMLElement): string {
  const holder = document.createElement('div');
  holder.appendChild(sanitizeHtml(source.outerHTML));
  return holder.innerHTML;
}

function cleanNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROP_WITH_CONTENT.has(tag)) return null;
  if (!ALLOWED_TAGS.has(tag)) return unwrap(el); // keep the text of an unknown tag, drop the tag
  const clean = document.createElement(tag);
  copyAttributes(el, clean, tag);
  for (const child of [...el.childNodes]) {
    const cleanChild = cleanNode(child);
    if (cleanChild) clean.appendChild(cleanChild);
  }
  return clean;
}

/** Replace a disallowed-but-harmless element with a fragment of its cleaned children. */
function unwrap(el: Element): Node | null {
  const fragment = document.createDocumentFragment();
  for (const child of [...el.childNodes]) {
    const clean = cleanNode(child);
    if (clean) fragment.appendChild(clean);
  }
  return fragment.childNodes.length > 0 ? fragment : null;
}

function copyAttributes(from: Element, to: Element, tag: string): void {
  for (const attr of [...from.attributes]) {
    const name = attr.name.toLowerCase();
    if (ALLOWED_ATTRS.has(name)) {
      to.setAttribute(name, attr.value);
    } else if (tag === 'a' && name === 'href') {
      const href = safeUrl(attr.value);
      if (href) to.setAttribute('href', href);
    }
    // <img src> is deliberately dropped. Persisted and imported answers are untrusted, and keeping a
    // remote image URL would let simply reopening (or importing) a tangent silently beacon to an
    // arbitrary host, breaking the "nothing leaves your browser" promise. The alt text is kept.
  }
  if (tag === 'a' && to.hasAttribute('href')) {
    // A tangent lives on top of the chat; open links in a new tab, and never leak the referrer.
    to.setAttribute('target', '_blank');
    to.setAttribute('rel', 'noopener noreferrer nofollow');
  }
}

/** Resolve a URL and allow only safe schemes; returns null for javascript:, data:, and the like. */
function safeUrl(value: string): string | null {
  try {
    const { protocol, href } = new URL(value, location.href);
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:' ? href : null;
  } catch {
    return null;
  }
}
