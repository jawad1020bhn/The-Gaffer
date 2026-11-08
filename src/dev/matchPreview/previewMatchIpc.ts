import type { mockIPC } from "@tauri-apps/api/mocks";
import type { MinuteResult } from "../../store/liveMatchTypes";
import { previewSnapshot } from "./fixtureMatch";

/**
 * The live match's commands, answered from the preview match: the snapshot it draws, and a step
 * that returns the same episode so the clock stands still while someone looks at the screen.
 */
export function installMatchPreviewIpc(install: typeof mockIPC): void {
  const stillMinute: MinuteResult = {
    minute: previewSnapshot.current_minute,
    phase: previewSnapshot.phase,
    events: [],
    home_score: previewSnapshot.home_score,
    away_score: previewSnapshot.away_score,
    possession: "Home",
    ball_zone: "MiddleThird",
    is_finished: false,
  };

  install((command) => {
    switch (command) {
      case "get_match_snapshot":
        return previewSnapshot;
      case "step_live_match":
        return [stillMinute];
      default:
        return undefined;
    }
  });
}
