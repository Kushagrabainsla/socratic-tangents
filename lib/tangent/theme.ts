// Decide dark/light from the host page's actual background, so our UI matches the LLM exactly.
export function isDark(): boolean {
  const channels = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
  if (channels && channels.length >= 3) {
    const [r, g, b] = channels.map(Number) as [number, number, number];
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
  }
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
