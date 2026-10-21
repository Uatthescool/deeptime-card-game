import { useEffect, useRef, useState } from "react";

import { canRerollBattleCoin, type CoinGroup, type GameState } from "../../engine/index.ts";
import { Dialog } from "./Dialog.tsx";
import type { Dispatch } from "./Modals.tsx";

const FLIP_MS = 850;

type Flip = { group: CoinGroup; index: number } | "all" | null;

export function BattleModal({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const battle = game.pendingBattle!;
  const [flipping, setFlipping] = useState<Flip>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const animate = (flip: Exclude<Flip, null>) => {
    setFlipping(flip);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlipping(null), FLIP_MS);
  };

  const attacker = game.players[battle.attackerPlayer].lanes[battle.attackerLane]!.creature!;
  const defender = game.players[battle.defenderPlayer].lanes[battle.defenderLane]!.creature!;
  const isStampede = battle.origin === "stampede";
  const coinCount = battle.coinPlan.offensiveCount + battle.coinPlan.defensiveCount;
  const coins = battle.coins;

  const commit = () => {
    if (coinCount === 0) {
      dispatch({ type: "commitHunt" });
      return;
    }
    dispatch({ type: "flipBattleCoins" });
    animate("all");
  };

  const groups = coins
    ? [
        {
          id: "offensive" as const,
          owner: battle.attackerPlayer,
          label: battle.coinPlan.offensiveReason,
          results: coins.offensive ?? [],
          outcome: `${(coins.offensive ?? []).filter(Boolean).length} Battle Level gained`,
        },
        {
          id: "defensive" as const,
          owner: battle.defenderPlayer,
          label: battle.coinPlan.defensiveReason,
          results: coins.defensive ?? [],
          outcome: (coins.defensive ?? []).some(Boolean) ? "Hunt forced to a tie" : "Hunt resolves normally",
        },
      ].filter((group) => group.label && group.results.length)
    : [];

  const isFlipping = (group: CoinGroup, index: number) =>
    flipping === "all" || (flipping !== null && flipping.group === group && flipping.index === index);

  const levelRange =
    battle.attackerLevelMax > battle.attackerLevel
      ? `${battle.attackerLevel}–${battle.attackerLevelMax}`
      : battle.attackerLevel;

  return (
    <Dialog label="Hunt preview" className="battle-overlay">
      <div className="battle-modal">
        <div className="eyebrow">{isStampede ? "Stampede Hunt" : "Hunt preview"}</div>
        <h2>Review projected Battle Levels.</h2>
        <p>
          {isStampede
            ? "This Hunt is the next mandatory step of Stampede. Resolve it to continue the counter-clockwise sequence."
            : "No Hunt has been committed. Canceling will consume no attack and change no game state."}
        </p>
        <div className="battle-versus">
          <div>
            <small>Attacker</small>
            <strong>{attacker.card.definition.name}</strong>
            <b>{levelRange}</b>
            <ul>
              {battle.attackerNotes.length ? (
                battle.attackerNotes.map((note) => <li key={note}>{note}</li>)
              ) : (
                <li>No known modifiers</li>
              )}
            </ul>
          </div>
          <span>vs.</span>
          <div>
            <small>Defender</small>
            <strong>{defender.card.definition.name}</strong>
            <b>{battle.defenderLevel}</b>
            <ul>
              {battle.defenderNotes.length ? (
                battle.defenderNotes.map((note) => <li key={note}>{note}</li>)
              ) : (
                <li>No known modifiers</li>
              )}
            </ul>
          </div>
        </div>
        {coinCount > 0 && !coins && (
          <p className="prototype-callout">
            Final outcome unresolved: Commit Hunt will flip {coinCount} Battle {coinCount === 1 ? "Coin" : "Coins"}. Red
            Rex means success for the Creature whose effect caused that flip.
          </p>
        )}
        {coins && (
          <div className="coin-stage" aria-live="polite">
            {groups.map((group) => (
              <section className="coin-group" key={group.id}>
                <small>{group.label}</small>
                <div className="coin-row">
                  {group.results.map((success, index) => (
                    <div className="coin-result-cell" key={`${group.id}-${index}`}>
                      <div
                        className={`elusive-coin ${isFlipping(group.id, index) ? "flipping" : "result"} ${success ? "rex-success" : "black-failure"}`}
                        aria-label={
                          isFlipping(group.id, index)
                            ? "Flipping"
                            : success
                              ? "Red Rex: success"
                              : "Fossil reverse: failure"
                        }
                      >
                        <div className="coin-face rex-face">
                          <span className="rex-mark">REX</span>
                          <small>SUCCESS</small>
                        </div>
                        <div className="coin-face black-face">
                          <span>FOSSIL</span>
                          <small>REVERSE</small>
                        </div>
                      </div>
                      {!flipping && canRerollBattleCoin(game, group.owner, group.id, index) && (
                        <button
                          className="coin-reroll-button"
                          onClick={() => {
                            dispatch({ type: "rerollBattleCoin", playerId: group.owner, group: group.id, index });
                            animate({ group: group.id, index });
                          }}
                        >
                          Reroll · {game.players[group.owner].name}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <strong>
                  {flipping === "all" || (flipping && flipping.group === group.id)
                    ? flipping === "all"
                      ? "Flipping…"
                      : "Rerolling…"
                    : group.outcome}
                </strong>
              </section>
            ))}
          </div>
        )}
        <div className="modal-actions">
          {!coins && !isStampede && (
            <button className="quiet-button" onClick={() => dispatch({ type: "cancelHunt" })}>
              Cancel
            </button>
          )}
          {!coins && (
            <button className="primary-button" onClick={commit}>
              {isStampede ? "Resolve Hunt" : "Commit Hunt"}
            </button>
          )}
          {coins && (
            <button
              className="primary-button"
              disabled={Boolean(flipping)}
              onClick={() => dispatch({ type: "commitHunt" })}
            >
              {flipping ? "Flipping…" : "Use these results"}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
