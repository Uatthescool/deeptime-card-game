import { type CreatureCard, expandedTagNames, TAG_RULES, tagCombos } from "../../data/cards.ts";
import type { GameState, PlayerId } from "../../engine/index.ts";
import {
  type InspectionTarget,
  inspectionHandlers,
  type InspectorTab,
  type PinHandler,
  type PreviewHandler,
  typeLabel,
} from "../inspection.ts";
import { CardArtwork } from "./CardFace.tsx";

export function CardTagRules({ card }: { card: CreatureCard }) {
  const tags = expandedTagNames(card);
  if (!tags.length) return <p className="empty-tab-copy">This card has no printed Tags.</p>;
  return (
    <div className="keyword-list">
      {tags.map((tag) => {
        const inherited = !card.tags.includes(tag);
        return (
          <article key={tag} className={inherited ? "inherited-keyword" : ""}>
            <h3>
              {tag}
              {inherited && <small>from Sovereign</small>}
            </h3>
            <p>{TAG_RULES[tag] ?? "No inherent effect is currently assigned."}</p>
            {tagCombos(card, tag).map((combo) => (
              <p key={combo.with} className={`tag-combo ${combo.active ? "active" : ""}`}>
                <b>Combo · {combo.with}</b>
                {combo.active && <span className="tag-combo-state">Active</span>} {combo.rule}
              </p>
            ))}
          </article>
        );
      })}
    </div>
  );
}

type InspectorProps = {
  target: InspectionTarget | null;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onClose: () => void;
  game?: GameState;
  historyViewer?: PlayerId | null;
  onHistoryViewer?: (player: PlayerId) => void;
  onPin?: PinHandler;
  onPreview?: PreviewHandler;
  pinned?: boolean;
};

export function Inspector({
  target,
  activeTab,
  onTabChange,
  onClose,
  game,
  historyViewer,
  onHistoryViewer,
  onPin,
  onPreview,
  pinned = false,
}: InspectorProps) {
  const card = target?.definition ?? null;
  const tabs: { id: InspectorTab; label: string }[] = [
    { id: "card", label: "Card" },
    { id: "tags", label: "Tags" },
    { id: "state", label: "State" },
    ...(game
      ? [
          { id: "log" as const, label: "Log" },
          { id: "history" as const, label: "History" },
        ]
      : []),
  ];
  const selectedHistory =
    game && historyViewer !== null && historyViewer !== undefined ? game.players[historyViewer] : null;

  return (
    <section className="sidewall-inspection" aria-label={card ? `Inspect ${card.name}` : "Game inspector"}>
      <header>
        <div>
          <small>{card ? (pinned ? "Pinned card" : "Card preview") : "Game record"}</small>
          <h2>{card?.name ?? "No card selected"}</h2>
        </div>
        <button onClick={onClose} aria-label="Close inspector">
          ×
        </button>
      </header>

      {card ? (
        <div className="sidewall-identity">
          <CardArtwork key={card.key} card={card} />
          <div className="sidewall-meta">
            <strong>{typeLabel(card)}</strong>
            <span>
              {card.kind === "creature"
                ? `${card.period} · ${card.diet} · Level ${card.printedLevel}`
                : card.kind === "event"
                  ? card.eventType === "continuous"
                    ? "Event Zone"
                    : "Resolves outside Event Zone"
                  : "Support card"}
            </span>
          </div>
          {card.status !== "Locked" && <div className="sidewall-pool-status">{card.status}</div>}
        </div>
      ) : (
        <div className="sidewall-empty-art">
          <span>Hover or focus to preview a card. Click or tap a card to pin it here.</span>
        </div>
      )}

      <nav className="sidewall-tabs" aria-label="Inspector sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            aria-pressed={activeTab === tab.id}
            disabled={!card && (tab.id === "card" || tab.id === "tags" || tab.id === "state")}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="sidewall-tab-content">
        {activeTab === "card" &&
          card &&
          (card.kind === "creature" ? (
            <>
              <section className="primary-tag-section" aria-label="Complete card Tag rules">
                <h3>Tags</h3>
                <CardTagRules card={card} />
              </section>
              <article className="flavor-inspection">
                <h3>Flavor text</h3>
                <p>
                  <i>{card.flavorText}</i>
                </p>
              </article>
              <dl className="inspection-facts">
                <div>
                  <dt>Taxonomy</dt>
                  <dd>{card.taxa.join(" · ")}</dd>
                </div>
              </dl>
            </>
          ) : (
            <article className="support-inspection">
              <h3>Rules</h3>
              <p>{card.rules}</p>
              {card.note && (
                <>
                  <h3>Ruling</h3>
                  <p>{card.note}</p>
                </>
              )}
            </article>
          ))}

        {activeTab === "tags" &&
          card &&
          (card.kind === "creature" ? (
            <CardTagRules card={card} />
          ) : (
            <p className="empty-tab-copy">This card has no printed Tags.</p>
          ))}

        {activeTab === "state" && card && (
          <>
            {target?.context?.length ? (
              <div className="inspection-context">
                <h3>Current state</h3>
                <ul>
                  {target.context.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="empty-tab-copy">This card is not currently reporting live board modifiers.</p>
            )}
            {target?.attachment && (
              <div className="inspection-attachment">
                <h3>Attached Adaptation</h3>
                <p>{target.attachment}</p>
              </div>
            )}
            {card.status !== "Locked" && (
              <div className="inspection-context">
                <h3>Pool status</h3>
                <p>{card.status}</p>
              </div>
            )}
          </>
        )}

        {activeTab === "log" && game && (
          <>
            <ol className="sidewall-log">
              {[...game.log]
                .reverse()
                .slice(0, 40)
                .map((entry, index) => (
                  <li key={`${game.log.length - index}-${entry}`}>
                    <time>{String(game.log.length - index).padStart(2, "0")}</time>
                    <span>{entry}</span>
                  </li>
                ))}
            </ol>
            <p className="game-seed">Game seed {game.seedLabel}</p>
          </>
        )}

        {activeTab === "history" && game && (
          <div className="sidewall-history">
            <div className="history-player-tabs">
              {game.players.map((player, index) => (
                <button
                  key={player.id}
                  className={historyViewer === index ? "active" : ""}
                  onClick={() => onHistoryViewer?.(index as PlayerId)}
                >
                  {player.name} · {player.history.length}
                </button>
              ))}
            </div>
            {selectedHistory ? (
              selectedHistory.history.length ? (
                <ol>
                  {[...selectedHistory.history].reverse().map((historyCard) => {
                    const historyTarget = { definition: historyCard.definition };
                    return (
                      <li key={historyCard.uid}>
                        <button
                          className="history-entry"
                          onClick={() => onPin?.(historyTarget)}
                          {...(onPreview ? inspectionHandlers(historyTarget, onPreview, onPin) : {})}
                        >
                          <strong>{historyCard.definition.name}</strong>
                          <span>{typeLabel(historyCard.definition)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="empty-tab-copy">No cards in {selectedHistory.name}’s History Pile.</p>
              )
            ) : (
              <p className="empty-tab-copy">Choose a player to inspect their public History Pile.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
