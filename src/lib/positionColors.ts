// Tailwind background class per position, shared by the package editor's
// player list/preview and the tactics pitch badges so they never drift apart:
// amber for keepers, blue for defenders, green for midfielders, red for attack.
export const POSITION_COLOR: Record<string, string> = {
  Goalkeeper: "bg-warning-solid",
  Defender: "bg-info-solid",
  CenterBack: "bg-info-solid",
  RightBack: "bg-info-solid",
  LeftBack: "bg-info-solid",
  RightWingBack: "bg-info-solid",
  LeftWingBack: "bg-info-solid",
  Midfielder: "bg-positive-solid",
  DefensiveMidfielder: "bg-positive-solid",
  CentralMidfielder: "bg-positive-solid",
  AttackingMidfielder: "bg-positive-solid",
  RightMidfielder: "bg-positive-solid",
  LeftMidfielder: "bg-positive-solid",
  RightWinger: "bg-danger-solid",
  LeftWinger: "bg-danger-solid",
  Forward: "bg-danger-solid",
  Striker: "bg-danger-solid",
};

export function getPositionColor(position: string): string {
  return POSITION_COLOR[position] ?? "bg-fg-subtle";
}
