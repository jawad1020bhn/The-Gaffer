import { mockIPC } from "@tauri-apps/api/mocks";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { installShellPreviewIpc } from "./previewIpc";
import { ShellPreview } from "./ShellPreview";

describe("ShellPreview", () => {
  it("draws the shell chrome and the Home board from the preview career", async () => {
    installShellPreviewIpc(mockIPC);

    render(<ShellPreview />);

    const text = () => document.body.textContent ?? "";

    expect(text()).toContain("OpenFoot Manager");
    expect(text()).toContain("Premier Division");
    expect(text()).toContain("Harbour City");

    await waitFor(() => expect(text()).toContain("Squad Overview"));
    // The career's actions float in the workspace dock, not in the top bar.
    expect(screen.getByRole("button", { name: /Continue/ }).closest("header")).toBeNull();
    // The fitness answer comes from the preview IPC stub, so this also proves the stub is wired up.
    expect(text()).toContain("81%");
  });
});
