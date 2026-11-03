import { useState } from "react";

import { clearRecordedGames, downloadPlayData, recordedGames, setWatcherEnabled, watcherEnabled } from "../watcher.ts";

/** Controls for the hidden play-data watcher; renders nothing unless this browser switched it on. */
export function WatcherPanel() {
  const [enabled, setEnabled] = useState(watcherEnabled);
  const [games, setGames] = useState(recordedGames);
  const [confirmingClear, setConfirmingClear] = useState(false);
  if (!enabled) return null;
  const finished = games.filter((game) => game.result).length;
  return (
    <section className="watcher-panel" aria-label="Play-data watcher">
      <div>
        <small>Watcher on · recording games vs. the computer</small>
        <strong>
          {games.length} {games.length === 1 ? "game" : "games"} recorded · {finished} finished
        </strong>
      </div>
      <div className="resume-actions">
        <button className="quiet-button" type="button" disabled={!games.length} onClick={downloadPlayData}>
          Download play data
        </button>
        {confirmingClear ? (
          <button
            className="text-button"
            type="button"
            onClick={() => {
              clearRecordedGames();
              setGames([]);
              setConfirmingClear(false);
            }}
          >
            Delete {games.length} recorded {games.length === 1 ? "game" : "games"}?
          </button>
        ) : (
          <button
            className="text-button"
            type="button"
            disabled={!games.length}
            onClick={() => setConfirmingClear(true)}
          >
            Clear
          </button>
        )}
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setWatcherEnabled(false);
            setEnabled(false);
          }}
        >
          Turn off
        </button>
      </div>
    </section>
  );
}
