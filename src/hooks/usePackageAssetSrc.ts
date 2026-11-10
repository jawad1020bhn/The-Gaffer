import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { useEffect, useState } from "react";

import { resolveLocalMediaPath } from "../lib/mediaAssets";
import { isPackageQualifiedAsset, joinAssetRoot } from "../lib/packageAssets";

/**
 * The app data directory, resolved once per session.
 *
 * Every club badge and player face on a screen asks for this, so the lookup is
 * shared rather than repeated per image.
 */
let appDataDirPromise: Promise<string> | null = null;

function resolveAppDataDir(): Promise<string> {
  // Only a resolved lookup is worth keeping. A rejected promise is still
  // truthy, so caching one would turn a single transient failure into "no
  // package artwork anywhere until the app restarts".
  appDataDirPromise ??= appDataDir().catch((err) => {
    appDataDirPromise = null;
    throw err;
  });
  return appDataDirPromise;
}

/** Test seam: drop the cached directory so each test starts clean. */
export function resetPackageAssetRoot(): void {
  appDataDirPromise = null;
}

/** The result of resolving a stored media path. */
export interface PackageAssetSrc {
  /**
   * Something an `<img>` can load, or `null`.
   *
   * `null` while {@link pending} is true means "not yet", not "none": a caller
   * that treats the two the same shows its fallback artwork and then swaps it
   * for the real badge a tick later, which reads as a flicker on every screen
   * that lists clubs.
   */
  src: string | null;
  /** A package asset was named and its path is still being resolved. */
  pending: boolean;
}

/**
 * Resolve a stored media path, reporting whether the answer is still coming.
 *
 * Assets bundled with the app resolve synchronously against the frontend root.
 * Assets extracted from an installed package live outside the bundle and have
 * to go through Tauri's asset protocol, which needs the app data directory —
 * so those resolve on a later tick and the hook re-renders. Since the shipped
 * world badges every club from a package, that later tick is now the common
 * case rather than the exception, which is why callers can tell it apart.
 */
export function usePackageAssetResolution(
  path: string | null | undefined,
): PackageAssetSrc {
  const qualified = isPackageQualifiedAsset(path);
  const bundled = qualified ? null : resolveLocalMediaPath(path);
  // Track which path the src belongs to, so a path that changes does not
  // briefly show the previous club's badge.
  const [resolved, setResolved] = useState<{ path: string | null; src: string | null }>({
    path: null,
    src: null,
  });

  const trimmed = path?.trim() ?? "";

  useEffect(() => {
    if (!isPackageQualifiedAsset(path)) {
      setResolved({ path: null, src: null });
      return;
    }

    let active = true;
    resolveAppDataDir()
      .then((dir) => {
        if (!active) return;
        setResolved({ path: trimmed, src: convertFileSrc(joinAssetRoot(dir, trimmed)) });
      })
      .catch(() => {
        // No app data dir means no package assets; the caller's fallback
        // (a generated crest or portrait) is the right outcome, not an error.
        if (active) setResolved({ path: trimmed, src: null });
      });

    return () => {
      active = false;
    };
  }, [path, trimmed]);

  if (bundled) return { src: bundled, pending: false };
  if (!qualified) return { src: null, pending: false };
  // A resolved value is only current if it belongs to the path being asked for.
  if (resolved.path === trimmed) return { src: resolved.src, pending: false };
  return { src: null, pending: true };
}

/**
 * Turn a stored media path into something an `<img>` can load.
 *
 * The `src` half of {@link usePackageAssetResolution}, for callers that render
 * their fallback either way.
 */
export function usePackageAssetSrc(path: string | null | undefined): string | null {
  return usePackageAssetResolution(path).src;
}
