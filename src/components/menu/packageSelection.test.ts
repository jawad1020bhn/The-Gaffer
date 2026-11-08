import { describe, expect, it } from "vitest";
import { defaultActivePackageIds } from "./packageSelection";
import type { PackageInfo } from "./WorldSelect";

function pkg(overrides: Partial<PackageInfo>): PackageInfo {
  return {
    id: "id",
    name: "Package",
    version: "1.0.0",
    author: "author",
    description: "",
    license: "",
    gameMinVersion: "0.3.0",
    packageType: "database",
    teamCount: 0,
    playerCount: 0,
    competitionCount: 0,
    namePoolCount: 0,
    countryCount: 0,
    confederationCount: 0,
    installedPath: "",
    ...overrides,
  };
}

describe("defaultActivePackageIds", () => {
  it("pre-selects the world the build shipped", () => {
    const bundled = pkg({ id: "eafc-fc27", bundled: true });

    expect(defaultActivePackageIds([bundled])).toEqual(["eafc-fc27"]);
  });

  it("leaves packages the player installed to be chosen", () => {
    // The behaviour every install had before: nothing is active until it is toggled.
    expect(defaultActivePackageIds([pkg({ id: "mine" })])).toEqual([]);
    // An absent flag is not the same as `false` but means the same thing here.
    expect(defaultActivePackageIds([pkg({ id: "mine", bundled: undefined })])).toEqual([]);
  });

  it("ignores a bundled patch, which cannot make a world on its own", () => {
    const patch = pkg({ id: "kits", bundled: true, packageType: "patch" });

    expect(defaultActivePackageIds([patch])).toEqual([]);
  });

  it("keeps only the bundled databases when several packages are installed", () => {
    const world = pkg({ id: "eafc-fc27", bundled: true });
    const other = pkg({ id: "imported" });
    const patch = pkg({ id: "badges", bundled: true, packageType: "patch" });

    expect(defaultActivePackageIds([other, world, patch])).toEqual(["eafc-fc27"]);
  });

  it("has nothing to pre-select on a menu with no packages at all", () => {
    expect(defaultActivePackageIds([])).toEqual([]);
  });
});
