import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { beforeEach, describe, expect, it } from "vitest";

// Packaged artwork resolves through Tauri's asset protocol, so a test that wants
// the real crest has to stand in for the two APIs it uses.
const convertFileSrc = vi.fn((path: string) => `asset://localhost/${path}`);
const appDataDir = vi.fn(async () => "/home/u/.local/share/app");
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => convertFileSrc(path),
}));
vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: () => appDataDir(),
}));

import { resetPackageAssetRoot } from "../../hooks/usePackageAssetSrc";
import { TeamLogo } from "./TeamLogo";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { team?: string }) =>
      key === "common.teamLogoAlt" ? `${params?.team ?? ""} logo` : key,
  }),
}));

const team = {
  name: "Media FC",
  short_name: "MFC",
};

describe("TeamLogo", () => {
  beforeEach(() => {
    resetPackageAssetRoot();
    convertFileSrc.mockClear();
    appDataDir.mockClear();
  });

  it("renders the team short name when no logo media path is provided", () => {
    render(<TeamLogo team={team} />);

    expect(screen.getByText("MFC")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders a local logo image when logo media path is provided", () => {
    render(
      <TeamLogo
        team={{
          ...team,
          media: { logo: "assets/worlds/test-world/teams/media-fc.png" },
        }}
      />,
    );

    expect(screen.getByRole("img", { name: "Media FC logo" })).toHaveAttribute(
      "src",
      "/assets/worlds/test-world/teams/media-fc.png",
    );
  });

  it("renders the real crest a bundled-world club carries, not a generated one", () => {
    // The shipped world names a PNG per club, and the loader stamps the package
    // id onto it, so this is the exact path a career's Arsenal reaches the
    // component with. Before the badges existed this club rendered the
    // procedural crest and looked like every other unbadged club.
    render(
      <TeamLogo
        team={{
          ...team,
          media: { logo: "eafc-fc27/assets/clubs/1.png" },
        }}
      />,
    );

    // Package artwork resolves through Tauri's asset protocol on a later tick,
    // so the image appears once the app data directory lands. An <img> appearing
    // at all is the assertion: the generated crest is inline SVG and never
    // produces one.
    return waitFor(() => {
      expect(screen.getByRole("img", { name: "Media FC logo" })).toHaveAttribute(
        "src",
        "asset://localhost//home/u/.local/share/app/package-assets/eafc-fc27/assets/clubs/1.png",
      );
    });
  });

  it("holds the space instead of flashing a generated crest while a badge resolves", () => {
    // Every club in the shipped world now has a package badge, and the path
    // resolves a tick after first render. Showing the procedural crest during
    // that tick made whole squads look like they had swapped clubs mid-load.
    const { container } = render(
      <TeamLogo team={{ ...team, media: { logo: "eafc-fc27/assets/clubs/1.png" } }} />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText("MFC")).not.toBeInTheDocument();
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("falls back to the team short name when the logo image fails to load", () => {
    render(
      <TeamLogo
        team={{
          ...team,
          media: { logo: "/assets/worlds/test-world/teams/media-fc.png" },
        }}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Media FC logo" }));

    expect(screen.getByText("MFC")).toBeInTheDocument();
  });

  it("tries to render a new logo path after a previous image failed", () => {
    const { rerender } = render(
      <TeamLogo
        team={{
          ...team,
          media: { logo: "/assets/worlds/test-world/teams/missing.png" },
        }}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Media FC logo" }));
    expect(screen.getByText("MFC")).toBeInTheDocument();

    rerender(
      <TeamLogo
        team={{
          ...team,
          media: { logo: "/assets/worlds/test-world/teams/media-fc.png" },
        }}
      />,
    );

    expect(screen.getByRole("img", { name: "Media FC logo" })).toHaveAttribute(
      "src",
      "/assets/worlds/test-world/teams/media-fc.png",
    );
  });
});
