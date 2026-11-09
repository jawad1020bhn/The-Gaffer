export type UiScale = "small" | "normal" | "large" | "xlarge";

/**
 * How much a player's ui_scale choice multiplies the window-derived root size.
 *
 * The root is no longer a fixed number of pixels. A 1600px window and a 1280px window get
 * different roots, so the whole rem-based layout scales with the window instead of reflowing into
 * fewer columns — which is what a native game does and a website does not.
 */
const UI_SCALE_MULTIPLIER: Record<UiScale, number> = {
  small: 0.9375,
  normal: 1,
  large: 1.125,
  xlarge: 1.25,
};

/**
 * The floor, and it is a legibility rule rather than a taste.
 *
 * `caption` is 0.75rem and must never render below 11px; `body` is 0.875rem and must never render
 * below 12px. 11 / 0.75 = 14.667, which satisfies both (body lands at 12.83px). So no window width
 * and no scale setting can push text under the minimum — the clamp stops it. Below ~1467px of
 * viewport width the floor is in charge and `small` reads the same as `normal`; above it the
 * settings separate again. Cutting content is the answer to a tight window, never shrinking type.
 */
const MIN_ROOT_PX = 14.667;

/** The ceiling, so a 4K window does not render a 38px root and show four panels. */
const MAX_ROOT_PX = 22;

/**
 * The player's scale as the `--ui-scale` custom property.
 *
 * The clamp itself lives in App.css with the other tokens, so there is one formula and the webview
 * re-evaluates it on resize with no JavaScript listener and no frame at the old size. All this
 * returns is the multiplier, which keeps the setting serialisable and the formula in one place.
 */
export function uiScaleValue(scale: string): string {
  return String(UI_SCALE_MULTIPLIER[scale as UiScale] ?? UI_SCALE_MULTIPLIER.normal);
}

/** The multiplier as a number, for the tests that check the legibility floor. */
export function uiScaleMultiplier(scale: string): number {
  return UI_SCALE_MULTIPLIER[scale as UiScale] ?? UI_SCALE_MULTIPLIER.normal;
}

/** The floor and ceiling the CSS clamp uses. Exported so the tests assert the real contract. */
export const ROOT_FONT_FLOOR_PX = MIN_ROOT_PX;
export const ROOT_FONT_CEILING_PX = MAX_ROOT_PX;
