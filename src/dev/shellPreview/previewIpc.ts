import type { mockIPC } from "@tauri-apps/api/mocks";
import { previewGameState } from "./fixture";

/**
 * The two commands Home asks the backend for, answered from the preview career. Anything else is
 * declined the way the harness declines it, so a page that starts needing another command says so
 * in the console instead of showing a number nobody computed.
 */
export function installShellPreviewIpc(install: typeof mockIPC): void {
  install((command) => {
    if (command === "get_squad") return previewGameState.players;
    if (command === "get_squad_fitness") {
      return {
        players: previewGameState.players.length,
        average_condition: 81,
        average_status: null,
        exhausted_count: 1,
        critical_count: 0,
        statuses: {},
      };
    }
    return undefined;
  });
}
