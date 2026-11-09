import type { JSX } from "react";

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
  src: string;
  /** Cropping to the subject, for plates whose left side carries a baked mark. */
  anchorRight?: boolean;
}

const SCENES: Record<SceneId, SceneSource> = {
  career: { src: "/assets/scenes/office-night.jpg" },
  team: { src: "/assets/scenes/dressing-room.jpg" },
  transfers: { src: "/assets/scenes/transfer-desk.jpg", anchorRight: true },
  competitions: { src: "/assets/scenes/matchday.jpg" },
  office: { src: "/assets/scenes/boardroom.jpg" },
  tactics: { src: "/assets/scenes/tactics-room.jpg" },
  training: { src: "/assets/scenes/training-dawn.jpg" },
  schedule: { src: "/assets/scenes/season-wall.jpg" },
  press: { src: "/assets/scenes/press-room.jpg" },
  honours: { src: "/assets/scenes/trophy-room.jpg", anchorRight: true },
  empty: { src: "/assets/scenes/empty-dawn.jpg" },
};

const VEILS = {
  ambient: "bg-veil",
  hero: "scene-veil-left",
  panel: "scene-veil-panel",
} as const;

interface SceneBackdropProps {
  scene: SceneId;
  /**
   * `ambient` sits behind a whole workspace: heavily veiled, because panels and tables have to be
   * read on top of it. `hero` sits behind one band and keeps the photograph legible on the right,
   * fading to the page on the left where the words go. `panel` is an art-headed working panel: the
   * photograph survives across the header and is solid page by the time the data starts.
   */
  strength?: "ambient" | "hero" | "panel";
  className?: string;
}

/**
 * The layered background: plate, grade, veil, vignette, grain.
 *
 * Decorative and inert — it is hidden from assistive technology and never takes a pointer event,
 * so it cannot change what a screen does. It is absolutely positioned, so the caller owns the
 * stacking context (`relative isolate`) and the layout is unaffected by its presence.
 */
export function SceneBackdrop({
  scene,
  strength = "ambient",
  className = "",
}: SceneBackdropProps): JSX.Element {
  const plate = SCENES[scene];

  return (
    <div
      aria-hidden="true"
      data-scene={scene}
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}
    >
      {/* Keyed on the plate, so changing section crossfades the room rather than swapping it. */}
      <img
        key={plate.src}
        src={plate.src}
        alt=""
        decoding="async"
        className={`h-full w-full scene-plate animate-scene-in motion-reduce:animate-none ${
          plate.anchorRight ? "scene-anchor-right" : ""
        }`}
      />
      <div className={`absolute inset-0 ${VEILS[strength]}`} />
      <div className="absolute inset-0 scene-vignette" />
      <div className="absolute inset-0 scene-grain opacity-5 mix-blend-overlay" />
    </div>
  );
}
