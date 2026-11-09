/**
 * `?preview=onboarding` walks the real first-run screens in a browser: title, world, season,
 * identity, philosophy, club, the appointment ceremony and the first day in the office.
 *
 * `stage` seeds the career and jumps straight to a beat the main menu cannot reach on its own —
 * the club dossier and the three appointment scenes — so a screenshot or a layout check can start
 * where it needs to. The setup beats before the club are reached by clicking, because the menu owns
 * their draft; it seeds nothing the flow would not have produced itself.
 */
export const ONBOARDING_STAGES = ["title", "club", "board", "sign", "welcome", "office"] as const;

export type OnboardingStage = (typeof ONBOARDING_STAGES)[number];

export function readOnboardingPreview(search: string): { stage: OnboardingStage } | null {
  const params = new URLSearchParams(search);
  if (params.get("preview") !== "onboarding") return null;
  const requested = params.get("stage");
  const stage = ONBOARDING_STAGES.find((candidate) => candidate === requested) ?? "title";
  return { stage };
}
