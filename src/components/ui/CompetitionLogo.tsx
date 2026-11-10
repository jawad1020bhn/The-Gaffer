import type { ReactNode } from "react";

import { Trophy } from "lucide-react";
import { usePackageAssetResolution } from "../../hooks/usePackageAssetSrc";
import AssetImage from "./AssetImage";

interface CompetitionLogoProps {
  /** The competition's stored logo path (`LeagueData.logo`). Nothing when it has no logo. */
  logo?: string | null;
  /**
   * The box the logo is fitted into. Logos come in every shape, from tall shields to wide
   * wordmarks, so give it a height and a width and the artwork is scaled to fit inside.
   */
  className?: string;
  /** Drawn when the competition has no logo, or its file does not load. A trophy by default. */
  fallback?: ReactNode;
}

/**
 * A competition's own logo, or a trophy for a competition that has none.
 *
 * Decorative on purpose. Every screen that draws it writes the competition's name beside it,
 * so a named image would have a screen reader say the name twice, inside the same heading or
 * button. The trophy it replaces was hidden from assistive technology for the same reason.
 */
export function CompetitionLogo({ logo, className = "h-8 w-8", fallback }: CompetitionLogoProps) {
  const { src, pending } = usePackageAssetResolution(logo);
  const box = `inline-flex shrink-0 items-center justify-center ${className}`;

  if (pending) {
    // The competition has a logo and its path is still resolving. Drawing the trophy now and
    // replacing it a tick later would flicker on every screen that lists competitions, so an
    // empty box of the same size holds the layout instead.
    return <span aria-hidden="true" className={box} />;
  }

  return (
    <AssetImage
      src={src}
      alt=""
      className={`shrink-0 object-contain ${className}`}
      fallback={
        fallback ?? (
          <span className={box}>
            <Trophy className="h-3/5 w-3/5 text-warning" />
          </span>
        )
      }
    />
  );
}
