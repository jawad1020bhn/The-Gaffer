import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Packaged artwork resolves through Tauri's asset protocol, so a test that wants
// the real logo has to stand in for the two APIs it uses.
const convertFileSrc = vi.fn((path: string) => `asset://localhost/${path}`);
const appDataDir = vi.fn(async () => "/home/u/.local/share/app");
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => convertFileSrc(path),
}));
vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: () => appDataDir(),
}));

import { resetPackageAssetRoot } from "../../hooks/usePackageAssetSrc";
import { CompetitionLogo } from "./CompetitionLogo";

// The path a career's Premier League reaches the component with: the package
// names `assets/competitions/...` and the loader stamps the package id onto it.
const PACKAGE_LOGO = "eafc-fc27/assets/competitions/eng-premier-league.png";
const RESOLVED_LOGO =
  "asset://localhost//home/u/.local/share/app/package-assets/eafc-fc27/assets/competitions/eng-premier-league.png";

describe("CompetitionLogo", () => {
  beforeEach(() => {
    resetPackageAssetRoot();
    convertFileSrc.mockClear();
    appDataDir.mockClear();
  });

  it("draws a trophy for a competition that has no logo", () => {
    const { container } = render(<CompetitionLogo logo={null} />);

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("draws the logo its package ships, in place of the trophy", async () => {
    const { container } = render(<CompetitionLogo logo={PACKAGE_LOGO} className="h-7 w-7" />);

    // Package artwork resolves on a later tick, once the app data directory lands.
    await waitFor(() => {
      expect(container.querySelector("img")).toHaveAttribute("src", RESOLVED_LOGO);
    });
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    // Fitted into the box the caller gave, whatever the logo's own shape.
    expect(container.querySelector("img")).toHaveClass("h-7", "w-7", "object-contain");
  });

  it("stays out of the accessible name of the heading it is drawn in", async () => {
    // Every screen writes the competition's name beside its logo. A named image
    // would have the name read twice, inside the same heading or button.
    const { container } = render(
      <h3>
        <CompetitionLogo logo={PACKAGE_LOGO} />
        Premier League
      </h3>,
    );

    await waitFor(() => {
      expect(container.querySelector("img")).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Premier League" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("holds the space instead of flashing a trophy while the logo resolves", async () => {
    // The path resolves a tick after first render. A trophy drawn for that tick
    // and then replaced would flicker on every screen that lists competitions.
    const { container } = render(<CompetitionLogo logo={PACKAGE_LOGO} className="h-7 w-7" />);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    expect(container.querySelector("[aria-hidden='true']")).toHaveClass("h-7", "w-7");

    // The logo then takes exactly that space, so nothing around it moves.
    await waitFor(() => {
      expect(container.querySelector("img")).toHaveClass("h-7", "w-7");
    });
  });

  it("falls back to the trophy when the logo file does not load", async () => {
    // A career saved against a package that has since been removed still names
    // the path; the file is simply gone.
    const { container } = render(<CompetitionLogo logo={PACKAGE_LOGO} />);
    const image = await waitFor(() => {
      const found = container.querySelector("img");
      expect(found).toBeInTheDocument();
      return found as HTMLImageElement;
    });

    fireEvent.error(image);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("draws the caller's own fallback when it is given one", () => {
    render(<CompetitionLogo logo={undefined} fallback={<span>No logo</span>} />);

    expect(screen.getByText("No logo")).toBeInTheDocument();
  });

  it("follows the competition when the one on screen changes", async () => {
    // The tournaments header keeps this mounted while the picker switches
    // competition, so the previous logo must not linger.
    const { container, rerender } = render(<CompetitionLogo logo={PACKAGE_LOGO} />);
    await waitFor(() => {
      expect(container.querySelector("img")).toHaveAttribute("src", RESOLVED_LOGO);
    });

    rerender(<CompetitionLogo logo="eafc-fc27/assets/competitions/es-primera-division.png" />);

    await waitFor(() => {
      expect(container.querySelector("img")).toHaveAttribute(
        "src",
        expect.stringMatching(/\/competitions\/es-primera-division\.png$/),
      );
    });

    rerender(<CompetitionLogo logo={null} />);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
