// ChatGPT and Claude swap conversations without a full page load. Watch for URL changes so the
// controller can re-anchor tangents for the new conversation. Polling is the robust option because
// the page's history.pushState happens in a JS context our content script cannot patch.

const POLL_MS = 700;

export function onUrlChange(onChange: () => void): void {
  let last = location.href;
  const check = () => {
    if (location.href === last) return;
    last = location.href;
    onChange();
  };
  setInterval(check, POLL_MS);
  window.addEventListener('popstate', check);
}
