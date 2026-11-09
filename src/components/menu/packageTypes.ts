// Shared world-package wire shapes used by the career setup and world editor.

export interface PackageIssue {
  code: string;
  file: string;
  params: Record<string, string>;
}

export interface StackConflictInfo {
  severity: "warning" | "error";
  code: string;
  entityKind: string;
  entityId: string;
  packages: string[];
}

export interface PackageInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  license: string;
  gameMinVersion: string;
  packageType: string;
  teamCount: number;
  playerCount: number;
  competitionCount: number;
  namePoolCount: number;
  countryCount: number;
  confederationCount: number;
  installedPath: string;
  logoDataUrl?: string;
  /** Shipped with the build rather than installed by the player. */
  bundled?: boolean;
}
