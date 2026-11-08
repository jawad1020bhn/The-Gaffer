import {
  BriefcaseBusiness,
  CalendarDays,
  CircleUserRound,
  Crosshair,
  Dumbbell,
  GraduationCap,
  House,
  Mail,
  Medal,
  Newspaper,
  Search,
  Shield,
  Trophy,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import type { JSX } from "react";

/** A destination's icon name (see dashboardDestinations) to the icon itself. */
const ICONS: Record<string, LucideIcon> = {
  home: House,
  squad: Users,
  tactics: Crosshair,
  training: Dumbbell,
  staff: UserCog,
  youth: GraduationCap,
  transfers: Waypoints,
  market: Search,
  scouting: Crosshair,
  players: CircleUserRound,
  calendar: CalendarDays,
  trophy: Trophy,
  club: Shield,
  managers: UsersRound,
  medal: Medal,
  inbox: Mail,
  news: Newspaper,
  finance: Wallet,
  office: BriefcaseBusiness,
  user: CircleUserRound,
};

export function ShellIcon({
  name,
  className = "h-4 w-4",
}: {
  name: string;
  className?: string;
}): JSX.Element {
  const Component = ICONS[name] ?? Shield;
  return <Component className={className} aria-hidden="true" />;
}
