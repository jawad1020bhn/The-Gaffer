import { type CSSProperties, type JSX, useEffect, useState } from "react";

/**
 * The rooms of the game. One plate per section, so the nineteen destinations behind five sections
 * all sit somewhere rather than on a flat colour. A destination may name its own plate when it is
 * a place in its own right — the tactics room, the training ground, the press room.
 *
 * Every plate is composed the same way: the subject on the right, the left third in shadow. That
 * is the onboarding composition, and it is what lets a heading sit directly on the scene without
 * a panel behind it. See docs/UI_REDESIGN.md for the brief each plate was made to.
 */
export type SceneId =
  | "career"
  | "team"
  | "transfers"
  | "competitions"
  | "office"
  | "tactics"
  | "training"
  | "schedule"
  | "press"
  | "honours"
  | "empty";

interface SceneSource {
  /** Path stem; .avif, .webp and .jpg are all shipped, best first. */
  stem: string;
  /**
   * The focal point, as `object-position`. Keeps the subject in frame at every aspect ratio, and
   * on the two salvaged banners crops a baked logo or baked lettering out of the shot.
   */
  focus: string;
}

const SCENES: Record<SceneId, SceneSource> = {
  career: { stem: "office-night", focus: "72% 52%" },
  team: { stem: "dressing-room", focus: "62% 50%" },
  transfers: { stem: "transfer-desk", focus: "88% 50%" },
  competitions: { stem: "matchday", focus: "60% 46%" },
  office: { stem: "boardroom", focus: "66% 48%" },
  tactics: { stem: "tactics-room", focus: "70% 48%" },
  training: { stem: "training-dawn", focus: "68% 56%" },
  schedule: { stem: "season-wall", focus: "72% 50%" },
  press: { stem: "press-room", focus: "70% 54%" },
  honours: { stem: "trophy-room", focus: "88% 50%" },
  empty: { stem: "empty-dawn", focus: "50% 46%" },
};

/** The rooms a section is likely to move to next, so the plate is warm before it is needed. */
const NEXT_ROOMS: Record<SceneId, SceneId[]> = {
  career: ["team", "office"],
  team: ["tactics", "training", "transfers"],
  transfers: ["team", "competitions"],
  competitions: ["schedule", "honours", "office"],
  office: ["press", "career"],
  tactics: ["team"],
  training: ["team"],
  schedule: ["competitions"],
  press: ["office"],
  honours: ["competitions"],
  empty: [],
};

const VEILS = {
  ambient: "room-scrim-ambient",
  hero: "scene-veil-left",
  panel: "scene-veil-panel",
} as const;

/** Warmed once per session; a prefetch never repeats. */
const warmed = new Set<string>();

function prefetch(scene: SceneId): void {
  const { stem } = SCENES[scene];
  if (warmed.has(stem)) return;
  warmed.add(stem);
  const image = new Image();
  image.decoding = "async";
  image.src = `/assets/scenes/${stem}.webp`;
}

interface SceneBackdropProps {
  scene: SceneId;
  /**
   * `ambient` sits behind a whole workspace. `hero` sits behind one band and keeps the photograph
   * legible on the right, fading to the page on the left where words go. `panel` is an art-headed
   * working panel: the photograph survives across the header and is solid by the time data starts.
   */
  strength?: "ambient" | "hero" | "panel";
  /** Warm the rooms this one is likely to lead to. Off inside small panels to avoid a fetch storm. */
  prefetchNext?: boolean;
  className?: string;
}

/**
 * The room layer: plate, colour grade, vignette, readability scrim, grain.
 *
 * Decorative and inert — hidden from assistive technology and never taking a pointer event, so it
 * cannot change what a screen does. Absolutely positioned, so the caller owns the stacking context
 * (`relative isolate`) and the layout is unaffected by its presence.
 *
 * Two behaviours worth knowing. The plate crossfades rather than swapping, so changing section
 * never flashes through the fallback. And a plate that fails to load leaves the designed gradient
 * underneath rather than an empty box.
 */
export function SceneBackdrop({
  scene,
  strength = "ambient",
  prefetchNext = false,
  className = "",
}: SceneBackdropProps): JSX.Element {
  const plate = SCENES[scene];
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(plate.stem);

  // Reset on room change, then let the new plate fade in over the fallback. Keeping the previous
  // stem until the next paint is what stops a white or empty frame between rooms.
  useEffect(() => {
    setFailed(false);
    const id = requestAnimationFrame(() => setShown(plate.stem));
    return () => cancelAnimationFrame(id);
  }, [plate.stem]);

  useEffect(() => {
    if (prefetchNext) for (const next of NEXT_ROOMS[scene]) prefetch(next);
  }, [scene, prefetchNext]);

  return (
    <div
      aria-hidden="true"
      data-scene={scene}
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden room-fallback ${className}`}
    >
      {failed ? null : (
        <picture key={shown}>
          <source srcSet={`/assets/scenes/${plate.stem}.avif`} type="image/avif" />
          <source srcSet={`/assets/scenes/${plate.stem}.webp`} type="image/webp" />
          <img
            src={`/assets/scenes/${plate.stem}.jpg`}
            alt=""
            decoding="async"
            onError={() => setFailed(true)}
            style={{ "--room-focus": plate.focus } as CSSProperties}
            className="h-full w-full scene-plate animate-scene-in motion-reduce:animate-none"
          />
        </picture>
      )}
      <div className="absolute inset-0 room-tint" />
      <div className="absolute inset-0 scene-vignette" />
      <div className={`absolute inset-0 ${VEILS[strength]}`} />
      <div className="absolute inset-0 scene-grain opacity-5 mix-blend-overlay" />
    </div>
  );
}
