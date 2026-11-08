import { Wind, Flame, Swords, Angry, ThumbsUp, Frown } from "lucide-react";

const TALK_ICON_MAP: Record<string, { icon: React.ReactNode; color: string }> = {
  calm: { icon: <Wind className="w-5 h-5" />, color: "text-info" },
  motivational: { icon: <Flame className="w-5 h-5" />, color: "text-warning" },
  assertive: { icon: <Swords className="w-5 h-5" />, color: "text-warning" },
  aggressive: { icon: <Angry className="w-5 h-5" />, color: "text-danger" },
  praise: { icon: <ThumbsUp className="w-5 h-5" />, color: "text-positive" },
  disappointed: { icon: <Frown className="w-5 h-5" />, color: "text-fg-subtle" },
};

export function getTalkIcon(key: string): React.ReactNode {
  const entry = TALK_ICON_MAP[key];
  if (!entry) return null;
  return <span className={entry.color}>{entry.icon}</span>;
}
