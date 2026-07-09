// Decide dark/light from the host page's actual background, so our UI matches the LLM exactly.
export function isDark(): boolean {
  // The body is often transparent (the real background sits on <html>), which browsers report as
  // rgba(0,0,0,0). Reading that as "black" would wrongly flip a light page to dark, so skip any
  // fully transparent surface and fall back to <html>, then to the OS preference.
  const luminance = backgroundLuminance(document.body) ?? backgroundLuminance(document.documentElement);
  if (luminance !== null) return luminance < 0.5;
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Relative luminance (0..1) of an element's background, or null when it is transparent/unreadable. */
function backgroundLuminance(el: Element): number | null {
  const match = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
  const [r, g, b, a = 1] = match?.[1]?.split(',').map((part) => parseFloat(part)) ?? [];
  if (r === undefined || g === undefined || b === undefined) return null;
  if (a === 0 || !Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
