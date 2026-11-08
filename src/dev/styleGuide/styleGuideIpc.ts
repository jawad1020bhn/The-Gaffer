import type { mockIPC } from "@tauri-apps/api/mocks";
import { previewPositionGroups, previewRatingTiers } from "../previewTables";

/**
 * The style guide draws real badges, so it asks for the two tables that need no game. Without this
 * the guide logs a failed request every time it is opened in a browser.
 */
export function installStyleGuideIpc(install: typeof mockIPC): void {
  install((command) => {
    switch (command) {
      case "get_position_groups":
        return previewPositionGroups();
      case "get_rating_tiers":
        return previewRatingTiers();
      default:
        return undefined;
    }
  });
}
