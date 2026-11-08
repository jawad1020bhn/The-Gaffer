import { type JSX, useState } from "react";
import MatchLive from "../../components/match/MatchLive";
import type { MatchEvent, MatchSnapshot } from "../../store/liveMatchTypes";
import { previewMatchEvents, previewMatchGame, previewSnapshot } from "./fixtureMatch";

/**
 * The live match screen on a preview match, in a browser with no backend.
 *
 * Dev only (`/style-guide.html?preview=match`): the live screen normally needs a Rust session, so
 * this is how the scoreline, the momentum bar and the panels can be looked at without one. Steps
 * into the match are answered by the stub in `previewMatchIpc`, so the clock does not run away
 * while the page is open.
 */
export function MatchPreview(): JSX.Element {
  const [snapshot, setSnapshot] = useState<MatchSnapshot>(previewSnapshot);
  const [importantEvents, setImportantEvents] = useState<MatchEvent[]>(previewMatchEvents);

  return (
    <MatchLive
      snapshot={snapshot}
      gameState={previewMatchGame}
      userSide="Home"
      isSpectator={false}
      importantEvents={importantEvents}
      preferredSpeed="normal"
      onSnapshotUpdate={setSnapshot}
      onImportantEvent={(event) => setImportantEvents((current) => [...current, event])}
      onHalfTime={() => {}}
      onFullTime={() => {}}
      onRequestLeave={() => {}}
    />
  );
}
