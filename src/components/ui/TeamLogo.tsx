import type { CSSProperties, ReactNode } from "react";

import { useTranslation } from "react-i18next";
import { usePackageAssetResolution } from "../../hooks/usePackageAssetSrc";
import AssetImage from "./AssetImage";
import { GeneratedCrest } from "./GeneratedCrest";

interface TeamLogoTeam {
  name: string;
  short_name: string;
  colors?: {
    primary?: string;
    secondary?: string;
  };
  media?: {
    logo?: string | null;
  };
}

interface TeamLogoProps {
  team: TeamLogoTeam;
  className?: string;
  imageClassName?: string;
  fallback?: ReactNode;
  style?: CSSProperties;
}

export function TeamLogo({
  team,
  className = "h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-sunken flex items-center justify-center font-heading font-bold text-heading text-fg",
  imageClassName = "h-10 w-10 object-contain drop-shadow",
  fallback,
  style,
}: TeamLogoProps) {
  const { t } = useTranslation();
  const { src: logoSrc, pending } = usePackageAssetResolution(team.media?.logo);

  const crest = fallback ?? (
    <GeneratedCrest
      name={team.name}
      label={team.short_name}
      colors={team.colors}
      className="h-full w-full"
    />
  );

  return (
    <div className={className} style={style}>
      {pending ? (
        // The club has a badge and its path is still resolving. Drawing the
        // generated crest now and replacing it a tick later is a visible lie —
        // every club would appear to change identity as the screen finishes
        // loading. An empty box of the same size holds the layout instead.
        <span aria-hidden="true" className={imageClassName} />
      ) : (
        <AssetImage
          src={logoSrc}
          alt={t("common.teamLogoAlt", { team: team.name })}
          className={imageClassName}
          fallback={crest}
        />
      )}
    </div>
  );
}
