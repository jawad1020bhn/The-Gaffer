import type { PackageInfo } from "./packageTypes";

/**
 * The packages a new career starts with when the player has chosen none.
 *
 * A portable build ships its world installed: `list_installed_packages` copies the archive
 * that sits in `packages/` beside the executable into the game's own package directory. But
 * an empty selection means "generate a fictional world", so without pre-selecting it the
 * download would look like it holds no data — which is exactly how it was read the first
 * time this build was handed out.
 *
 * Only bundled *database* packages qualify. A bundled patch cannot make a world on its own,
 * and anything the player installed themselves stays opt-in, so an ordinary install behaves
 * exactly as it did before.
 */
export function defaultActivePackageIds(packages: PackageInfo[]): string[] {
  return packages
    .filter((pkg) => pkg.bundled === true && pkg.packageType === "database")
    .map((pkg) => pkg.id);
}
