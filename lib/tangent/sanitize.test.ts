import { describe, expect, it } from 'vitest';
import { sanitizeHtml, toSafeHtml } from './sanitize';

// The sanitizer is the trust boundary for persisted/imported answers: stored HTML must never be able
// to run script or load attacker-controlled resources when re-rendered.

function render(html: string): HTMLElement {
  const holder = document.createElement('div');
  holder.appendChild(sanitizeHtml(html));
  return holder;
}

describe('sanitizeHtml', () => {
  it('keeps safe rich formatting and class attributes', () => {
    const out = render(
      '<div class="markdown"><h2>T</h2><p>a <strong>b</strong></p>' +
        '<pre><code class="language-js"><span class="k">const</span></code></pre><ul><li>x</li></ul></div>',
    );
    expect(out.querySelector('h2')?.textContent).toBe('T');
    expect(out.querySelector('strong')?.textContent).toBe('b');
    expect(out.querySelector('code')?.getAttribute('class')).toBe('language-js');
    expect(out.querySelector('code span')?.getAttribute('class')).toBe('k');
    expect(out.querySelector('li')?.textContent).toBe('x');
    expect(out.querySelector('div')?.getAttribute('class')).toBe('markdown');
  });

  it('drops script and iframe together with their contents', () => {
    const out = render('<p>ok</p><script>window.__x = 1</script><iframe></iframe>');
    expect(out.querySelector('script')).toBeNull();
    expect(out.querySelector('iframe')).toBeNull();
    expect(out.textContent).toBe('ok');
  });

  it('strips inline event handlers', () => {
    const img = render('<img src="https://x.com/a.png" onerror="window.__x = 1">').querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.hasAttribute('onerror')).toBe(false);
  });

  it('drops image src so reopening a tangent cannot beacon to a remote host', () => {
    const img = render('<img src="https://tracker.example/pixel.gif" alt="a">').querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.hasAttribute('src')).toBe(false);
    expect(img?.getAttribute('alt')).toBe('a');
  });

  it('removes javascript: and data: urls but keeps http(s) and mailto', () => {
    expect(render('<a href="javascript:alert(1)">x</a>').querySelector('a')?.hasAttribute('href')).toBe(
      false,
    );
    expect(render('<a href="data:text/html,x">x</a>').querySelector('a')?.hasAttribute('href')).toBe(false);

    const good = render('<a href="https://ok.com/p">x</a>').querySelector('a');
    expect(good?.getAttribute('href')).toContain('https://ok.com/p');
    expect(good?.getAttribute('target')).toBe('_blank');
    expect(good?.getAttribute('rel')).toContain('noopener');

    expect(render('<a href="mailto:a@b.com">x</a>').querySelector('a')?.getAttribute('href')).toBe(
      'mailto:a@b.com',
    );
  });

  it('unwraps unknown tags but keeps their text', () => {
    const out = render('<foo>keep <bar>this</bar></foo>');
    expect(out.querySelector('foo')).toBeNull();
    expect(out.textContent).toBe('keep this');
  });

  it('drops style attributes and ids', () => {
    const el = render('<p id="x" style="color:red" class="c">t</p>').querySelector('p');
    expect(el?.hasAttribute('style')).toBe(false);
    expect(el?.hasAttribute('id')).toBe(false);
    expect(el?.getAttribute('class')).toBe('c');
  });
});

describe('toSafeHtml', () => {
  it('serializes safe content and neutralizes dangerous content', () => {
    const source = document.createElement('div');
    source.className = 'markdown';
    source.innerHTML =
      '<p>hi <a href="https://ok.com">l</a></p><img src="https://x.com/a.png" onclick="steal()">';

    const html = toSafeHtml(source);
    expect(html).toContain('class="markdown"');
    expect(html).toContain('https://ok.com');
    expect(html).not.toContain('onclick');

    // Re-parsing the stored string must stay safe.
    expect(render(html).querySelector('img')?.hasAttribute('onclick')).toBe(false);
  });
});
