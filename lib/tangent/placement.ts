// Decide where an open bubble goes on each animation frame: follow its passage, stay where the user
// dragged it, or collapse to a side pill. A pinned (dragged) bubble still collapses when its passage
// scrolls off screen, and releases the pin so it resumes following when the passage comes back. This
// keeps a dragged bubble from covering the page forever and from getting stuck out of sync.

export type PlacementMode = 'follow' | 'pinned' | 'min';

export interface Placement {
  mode: PlacementMode;
  /** True when a pinned bubble should drop its manual position (its passage has left the viewport). */
  releasePin: boolean;
}

/** Vertical band (px from the top of the viewport) where a followed bubble still fits comfortably. */
const TOP_MARGIN = 8;
const BOTTOM_MARGIN = 80;

export function decidePlacement(
  passageTop: number,
  passageBottom: number,
  desiredTop: number,
  pinned: boolean,
  viewportHeight: number,
): Placement {
  const passageOnScreen = passageBottom > 0 && passageTop < viewportHeight;
  if (pinned) {
    return passageOnScreen ? { mode: 'pinned', releasePin: false } : { mode: 'min', releasePin: true };
  }
  const fits = desiredTop > TOP_MARGIN && desiredTop < viewportHeight - BOTTOM_MARGIN;
  return passageOnScreen && fits ? { mode: 'follow', releasePin: false } : { mode: 'min', releasePin: false };
}
