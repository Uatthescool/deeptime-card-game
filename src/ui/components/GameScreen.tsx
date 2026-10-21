import { type CSSProperties, useEffect, useState } from "react";

import { biomeByKey, type BiomeKey } from "../../data/biomes.ts";
import {
  canActivateCarnianPluvialEpisode,
  canPerformFullHandMulligan,
  canPlayConcept,
  canPlayEvent,
  canUseAquaticOverride,
  type CardInstance,
  conceptAllowance,
  type GameState,
  handCardByUid,
  hasLegalHunts,
  LANE_COUNT,
  legalAdaptationTargets,
  legalAquaticOverrideLanes,
  legalAttackTargets,
  legalConnectedWaterwayDestinations,
  legalConnectedWaterwaySources,
  legalCreatureLanes,
  legalDroughtTargets,
  legalFacultativeDestinations,
  legalFacultativeSources,
  legalWildfireLanes,
  NICHE_EVENT_KEYS,
  otherPlayer,
  type PlayerId,
  VICTORY_THRESHOLD,
  victoryTotals,
} from "../../engine/index.ts";
import { assetUrl } from "../assets.ts";
import { useGameSession } from "../useGameSession.ts";
import { BattleModal } from "./BattleModal.tsx";
import { EventZone, NicheLane } from "./Board.tsx";
import { CardBack, CardFace } from "./CardFace.tsx";
import { type InspectionTarget, inspectionHandlers, type InspectorTab } from "../inspection.ts";
import { Inspector } from "./Inspector.tsx";
import {
  BiodiversityModal,
  CarnianPluvialChoiceModal,
  ConceptChoiceModal,
  ConvergentChoiceModal,
  DrawPresentation,
  EngulfModal,
  EntryChoiceModal,
  FilterFeederModal,
  GeologicalBoundaryModal,
  HandoffOverlay,
  WinnerOverlay,
} from "./Modals.tsx";
import { RulesDrawer } from "./RulesDrawer.tsx";

const LANES = Array.from({ length: LANE_COUNT }, (_, index) => index);

function biomeBoardStyle(key: BiomeKey | null): CSSProperties {
  return key ? ({ "--biome-background": `url("${assetUrl(`/biomes/${key}.webp`)}")` } as CSSProperties) : {};
}

/** A multi-step board interaction the player has started but not finished. */
type BoardAction =
  | { kind: "waterway-source" }
  | { kind: "waterway-destination"; sourceLane: number }
  | { kind: "aquatic-override" }
  | { kind: "facultative-source" }
  | { kind: "facultative-destination"; sourceLane: number }
  | null;

type MobileView = "board" | "hand" | "inspect";

const PHASE_NAMES: Record<GameState["phase"], string> = {
  handoff: "Handoff",
  start: "Start Phase",
  development: "Development Phase",
  battle: "Battle Phase",
  "game-over": "Game over",
};

type GameScreenProps = {
  initialGame: GameState;
  /** True when the game was restored from a save: cover the hand until the right player confirms. */
  resumed: boolean;
  onExit: () => void;
};

export function GameScreen({ initialGame, resumed, onExit }: GameScreenProps) {
  const { game, dispatch, currentDraw } = useGameSession(initialGame);
  const [resumeCover, setResumeCover] = useState(resumed && !initialGame.handoff);
  const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null);
  const [selectedAttackerUid, setSelectedAttackerUid] = useState<string | null>(null);
  const [boardAction, setBoardAction] = useState<BoardAction>(null);
  const [historyViewer, setHistoryViewer] = useState<PlayerId | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [pinned, setPinned] = useState<InspectionTarget | null>(null);
  const [hover, setHover] = useState<InspectionTarget | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("log");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("board");
  const [confirmConcede, setConfirmConcede] = useState(false);

  // A new viewer takes the device at every handoff: clear everything the previous player had open.
  const [lastActive, setLastActive] = useState(game.activePlayer);
  if (lastActive !== game.activePlayer) {
    setLastActive(game.activePlayer);
    setPinned(null);
    setHover(null);
    setInspectorTab("log");
    setBoardAction(null);
    setSelectedCardUid(null);
    setSelectedAttackerUid(null);
    setConfirmConcede(false);
  }
  // When a Hunt resolves or is canceled, the attacker selection is spent.
  const battleOpen = Boolean(game.pendingBattle);
  const [wasBattleOpen, setWasBattleOpen] = useState(battleOpen);
  if (wasBattleOpen !== battleOpen) {
    setWasBattleOpen(battleOpen);
    if (!battleOpen) setSelectedAttackerUid(null);
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPinned(null);
      setHover(null);
      setInspectorOpen(false);
      setShowRules(false);
      setBoardAction(null);
      setSelectedCardUid(null);
      setSelectedAttackerUid(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const pin = (target: InspectionTarget, openInspector = false) => {
    setPinned(target);
    setHover(null);
    setInspectorTab("card");
    if (openInspector) {
      setInspectorOpen(true);
      setMobileView("inspect");
    }
  };
  const preview = (target: InspectionTarget | null) => {
    setHover(target);
    if (!pinned && target) setInspectorTab("card");
  };
  const openHistory = (player: PlayerId) => {
    setHistoryViewer(player);
    setInspectorTab("history");
    setInspectorOpen(true);
    setMobileView("inspect");
  };
  const clearSelection = () => {
    setSelectedCardUid(null);
    setSelectedAttackerUid(null);
  };

  const viewPlayer = game.activePlayer;
  const opponent = otherPlayer(viewPlayer);
  const viewer = game.players[viewPlayer];
  const opponentState = game.players[opponent];
  const totals = victoryTotals(game);
  const selectedCard = handCardByUid(game, viewPlayer, selectedCardUid);
  const allowances = viewer.allowances;

  // Legal destinations for the selected card or in-progress board action.
  const creatureLanes =
    selectedCard?.definition.kind === "creature" &&
    boardAction?.kind !== "facultative-source" &&
    boardAction?.kind !== "facultative-destination"
      ? boardAction?.kind === "aquatic-override"
        ? legalAquaticOverrideLanes(game, selectedCard)
        : legalCreatureLanes(game, viewPlayer, selectedCard)
      : [];
  const adaptationTargets =
    !boardAction && selectedCard?.definition.kind === "adaptation" ? legalAdaptationTargets(game, selectedCard) : [];
  const wildfireLanes =
    !boardAction && selectedCard?.definition.key === "wildfire" ? legalWildfireLanes(game, selectedCard) : [];
  const droughtTargets =
    !boardAction && selectedCard?.definition.key === "drought" ? legalDroughtTargets(game, selectedCard) : [];
  const selectedTargetCount =
    selectedCard?.definition.kind === "creature"
      ? creatureLanes.length
      : selectedCard?.definition.kind === "adaptation"
        ? adaptationTargets.length
        : selectedCard?.definition.key === "drought"
          ? droughtTargets.length
          : wildfireLanes.length;

  const isLegalSelectedPosition = (playerId: PlayerId, laneIndex: number) => {
    if (!selectedCard) return false;
    const { kind, key } = selectedCard.definition;
    if (kind === "creature") return playerId === viewPlayer && creatureLanes.includes(laneIndex);
    if (key === "wildfire") return playerId === viewPlayer && wildfireLanes.includes(laneIndex);
    if (kind === "adaptation")
      return adaptationTargets.some((target) => target.playerId === playerId && target.laneIndex === laneIndex);
    if (key === "drought")
      return droughtTargets.some((target) => target.playerId === playerId && target.laneIndex === laneIndex);
    return false;
  };

  const attackTargets = selectedAttackerUid ? legalAttackTargets(game, selectedAttackerUid) : [];

  const handleLaneClick = (playerId: PlayerId, laneIndex: number) => {
    const lane = game.players[playerId].lanes[laneIndex]!;
    const own = playerId === viewPlayer;
    if (own && boardAction?.kind === "facultative-source" && legalFacultativeSources(game).includes(laneIndex)) {
      setBoardAction({ kind: "facultative-destination", sourceLane: laneIndex });
      setSelectedCardUid(null);
      return;
    }
    if (
      own &&
      boardAction?.kind === "facultative-destination" &&
      legalFacultativeDestinations(game, boardAction.sourceLane).includes(laneIndex)
    ) {
      dispatch({ type: "moveFacultative", sourceLane: boardAction.sourceLane, destinationLane: laneIndex });
      setBoardAction(null);
      return;
    }
    if (own && boardAction?.kind === "waterway-source" && legalConnectedWaterwaySources(game).includes(laneIndex)) {
      setBoardAction({ kind: "waterway-destination", sourceLane: laneIndex });
      setSelectedCardUid(null);
      return;
    }
    if (
      own &&
      boardAction?.kind === "waterway-destination" &&
      legalConnectedWaterwayDestinations(game, boardAction.sourceLane).includes(laneIndex)
    ) {
      dispatch({ type: "repositionWaterway", sourceLane: boardAction.sourceLane, destinationLane: laneIndex });
      setBoardAction(null);
      return;
    }
    if (own && boardAction?.kind === "aquatic-override" && selectedCard && creatureLanes.includes(laneIndex)) {
      dispatch({ type: "playAquaticOverride", cardUid: selectedCard.uid, laneIndex });
      setBoardAction(null);
      clearSelection();
      return;
    }
    if (
      game.pendingCranialDisplay &&
      lane.creature &&
      game.pendingCranialDisplay.eligibleTargetUids.includes(lane.creature.card.uid)
    ) {
      dispatch({ type: "chooseCranialDisplayTarget", targetUid: lane.creature.card.uid });
      return;
    }
    if (selectedCard && isLegalSelectedPosition(playerId, laneIndex)) {
      const { kind, key } = selectedCard.definition;
      const cardUid = selectedCard.uid;
      if (kind === "creature") dispatch({ type: "playCreature", cardUid, laneIndex });
      else if (kind === "adaptation") dispatch({ type: "playAdaptation", cardUid, targetPlayer: playerId, laneIndex });
      else if (key === "wildfire") dispatch({ type: "playWildfire", cardUid, laneIndex });
      else if (key === "drought") dispatch({ type: "playDrought", cardUid, targetPlayer: playerId, laneIndex });
      clearSelection();
      return;
    }
    if (game.phase === "battle" && lane.creature) {
      if (own) {
        const uid = lane.creature.card.uid;
        setSelectedAttackerUid(selectedAttackerUid === uid ? null : uid);
        setSelectedCardUid(null);
        return;
      }
      if (selectedAttackerUid && attackTargets.includes(lane.creature.card.uid)) {
        dispatch({ type: "previewHunt", attackerUid: selectedAttackerUid, defenderUid: lane.creature.card.uid });
      }
    }
  };

  const laneHighlighted = (playerId: PlayerId, laneIndex: number) => {
    const lane = game.players[playerId].lanes[laneIndex]!;
    const own = playerId === viewPlayer;
    switch (boardAction?.kind) {
      case "facultative-source":
        return own && legalFacultativeSources(game).includes(laneIndex);
      case "facultative-destination":
        return own && legalFacultativeDestinations(game, boardAction.sourceLane).includes(laneIndex);
      case "waterway-source":
        return own && legalConnectedWaterwaySources(game).includes(laneIndex);
      case "waterway-destination":
        return own && legalConnectedWaterwayDestinations(game, boardAction.sourceLane).includes(laneIndex);
    }
    if (game.pendingCranialDisplay && lane.creature)
      return game.pendingCranialDisplay.eligibleTargetUids.includes(lane.creature.card.uid);
    if (selectedCard) return isLegalSelectedPosition(playerId, laneIndex);
    if (selectedAttackerUid && lane.creature && !own) return attackTargets.includes(lane.creature.card.uid);
    if (game.phase === "battle" && own && lane.creature)
      return legalAttackTargets(game, lane.creature.card.uid).length > 0;
    return false;
  };

  const startBoardAction = (action: BoardAction) => {
    setBoardAction(action);
    clearSelection();
  };

  const conceptLimit = conceptAllowance(game, viewPlayer);
  const legalHuntsAvailable = hasLegalHunts(game, viewPlayer);
  const facultativeSources = legalFacultativeSources(game);
  const handHidden = Boolean(game.handoff) || resumeCover;
  const facultativeActive =
    boardAction?.kind === "facultative-source" || boardAction?.kind === "facultative-destination";
  const aquaticActive = boardAction !== null && !facultativeActive;

  const boardActionPrompt: Record<NonNullable<BoardAction>["kind"], string> = {
    "facultative-source": "Choose the Creature with Facultative Quadrupedality.",
    "facultative-destination": "Choose an empty adjacent destination.",
    "waterway-source": "Choose a Creature to reposition.",
    "waterway-destination": "Choose its empty destination Niche.",
    "aquatic-override": "Choose a Creature card for the free override.",
  };

  const ribbon = (playerId: PlayerId, label: string) => {
    const player = game.players[playerId];
    return (
      <div className={`player-ribbon ${playerId === viewPlayer ? "active-ribbon" : "opponent-ribbon"}`}>
        <div className="player-identity">
          <small>{label}</small>
          <strong>{player.name}</strong>
          {player.biome.key && <span className="biome-ribbon-badge">{biomeByKey(player.biome.key).name}</span>}
        </div>
        <div className="ribbon-event">
          <EventZone game={game} playerId={playerId} onPin={pin} onPreview={preview} />
        </div>
        <div className="score-pill">
          <span>Victory</span>
          <b>
            {totals[playerId]} / {VICTORY_THRESHOLD}
          </b>
        </div>
        <div className="pile-counts">
          <span>Deck {player.deck.length}</span>
          <span className="hand-counter">Hand {player.hand.length}</span>
          <button onClick={() => openHistory(playerId)}>History {player.history.length}</button>
        </div>
      </div>
    );
  };

  const lanes = (playerId: PlayerId) => (
    <div className={`lanes ${playerId === viewPlayer ? "player-lanes" : "opponent-lanes"}`}>
      {LANES.map((laneIndex) => (
        <NicheLane
          key={laneIndex}
          game={game}
          playerId={playerId}
          laneIndex={laneIndex}
          opponentRow={playerId !== viewPlayer}
          selectedAttackerUid={selectedAttackerUid}
          highlighted={laneHighlighted(playerId, laneIndex)}
          onLaneClick={() => handleLaneClick(playerId, laneIndex)}
          onPin={pin}
          onPreview={preview}
        />
      ))}
    </div>
  );

  const selectHandCard = (card: CardInstance) => {
    pin({ definition: card.definition });
    setSelectedCardUid(selectedCardUid === card.uid ? null : card.uid);
    setSelectedAttackerUid(null);
    if (boardAction?.kind !== "aquatic-override") setBoardAction(null);
  };

  return (
    <main className={`game-page mobile-${mobileView}`}>
      <header className="game-header">
        <div>
          <div className="eyebrow">Prehistoric Card Game</div>
          <h1>
            {game.players[0].name} vs. {game.players[1].name}
          </h1>
        </div>
        <div className="turn-summary">
          <span>Turn {game.turnNumber}</span>
          <strong>
            {viewer.name}’s {PHASE_NAMES[game.phase]}
          </strong>
        </div>
        <div className="header-controls">
          <button className="quiet-button inspector-drawer-toggle" onClick={() => setInspectorOpen(!inspectorOpen)}>
            {inspectorOpen ? "Close inspector" : "Inspector"}
          </button>
          <button className="quiet-button" onClick={() => setShowRules(!showRules)}>
            {showRules ? "Close rules" : "Rules"}
          </button>
          <button className="quiet-button" onClick={onExit}>
            Main menu
          </button>
        </div>
      </header>

      <nav className="mobile-view-switcher" aria-label="Game views">
        {(["board", "hand", "inspect"] as const).map((view) => (
          <button
            key={view}
            className={mobileView === view ? "active" : ""}
            aria-pressed={mobileView === view}
            onClick={() => setMobileView(view)}
          >
            {view === "board" ? "Board" : view === "hand" ? "Hand" : "Inspect"}
          </button>
        ))}
      </nav>

      <div className="game-layout">
        <section className="board" aria-label="Game board">
          <section className="table-board-region">
            <div
              className={`biome-board-half opponent-biome-half biome-${opponentState.biome.key ?? "none"}`}
              style={biomeBoardStyle(opponentState.biome.key)}
              aria-label={`${opponentState.name}'s ${opponentState.biome.key ? biomeByKey(opponentState.biome.key).name : "standard"} ecosystem`}
            >
              {ribbon(opponent, "Opponent")}
              {lanes(opponent)}
            </div>

            <div className="centerline">
              <span>
                {game.periodAuras.length
                  ? game.periodAuras.map((aura) => `Geological Boundary · ${aura.period} +1 Battle Level`).join(" · ")
                  : "Directly opposing Niches"}
              </span>
            </div>

            <div
              className={`biome-board-half player-biome-half biome-${viewer.biome.key ?? "none"}`}
              style={biomeBoardStyle(viewer.biome.key)}
              aria-label={`${viewer.name}'s ${viewer.biome.key ? biomeByKey(viewer.biome.key).name : "standard"} ecosystem`}
            >
              {lanes(viewPlayer)}
              {ribbon(viewPlayer, "Active player")}
            </div>
          </section>

          <section className="hand-workspace">
            <section className="action-bar" aria-label="Turn controls and selected-card actions">
              <div className="phase-actions">
                {game.phase === "development" && (
                  <button
                    className="primary-button"
                    disabled={allowances.rapidSpeciation || boardAction !== null}
                    onClick={() => {
                      dispatch({ type: "advanceToBattle" });
                      setSelectedCardUid(null);
                    }}
                  >
                    {allowances.skipBattlePhase
                      ? "End Turn · Battle skipped"
                      : legalHuntsAvailable
                        ? "Enter Battle Phase"
                        : "End Turn"}
                  </button>
                )}
                {game.phase === "battle" && (
                  <p>
                    {selectedAttackerUid
                      ? attackTargets.length
                        ? "Choose a highlighted target."
                        : "No legal target."
                      : "Choose a ready hunter."}
                  </p>
                )}
                {viewer.event?.definition.key === "carnian-pluvial-episode" && (
                  <button
                    className="quiet-button"
                    disabled={!canActivateCarnianPluvialEpisode(game)}
                    onClick={() => dispatch({ type: "activateCarnianPluvial" })}
                  >
                    {allowances.carnianPluvialUsed ? "Carnian used" : "Use Carnian Pluvial"}
                  </button>
                )}
                {game.phase === "development" && facultativeSources.length > 0 && (
                  <button
                    className="quiet-button"
                    disabled={aquaticActive}
                    onClick={() => startBoardAction(facultativeActive ? null : { kind: "facultative-source" })}
                  >
                    {facultativeActive ? "Cancel movement" : "Use Facultative Movement"}
                  </button>
                )}
                {canPerformFullHandMulligan(game) && (
                  <button className="quiet-button" onClick={() => dispatch({ type: "fullHandMulligan" })}>
                    Mulligan
                  </button>
                )}
              </div>

              {selectedCard ? (
                <SelectedCardPanel
                  game={game}
                  card={selectedCard}
                  targetCount={selectedTargetCount}
                  aquaticOverride={boardAction?.kind === "aquatic-override"}
                  onClose={() => setSelectedCardUid(null)}
                  onPlayEvent={() => {
                    dispatch({ type: "playEvent", cardUid: selectedCard.uid });
                    clearSelection();
                  }}
                  onPlayConcept={() => {
                    dispatch({ type: "playConcept", cardUid: selectedCard.uid });
                    clearSelection();
                  }}
                />
              ) : (
                <div className="selected-action-empty">
                  <small>Selected card</small>
                  <span>{boardAction ? boardActionPrompt[boardAction.kind] : "None"}</span>
                </div>
              )}

              <BiomeControl
                game={game}
                active={aquaticActive}
                onReposition={() => startBoardAction({ kind: "waterway-source" })}
                onOverride={() => startBoardAction({ kind: "aquatic-override" })}
                onCancel={() => startBoardAction(null)}
              />

              <div className="turn-end-actions">
                <button
                  className="quiet-button"
                  disabled={boardAction !== null}
                  onClick={() => {
                    dispatch({ type: "endTurn" });
                    clearSelection();
                  }}
                >
                  End turn
                </button>
                <button
                  className="quiet-button"
                  disabled={!selectedCardUid && !selectedAttackerUid}
                  onClick={clearSelection}
                >
                  Cancel
                </button>
                {confirmConcede ? (
                  <span className="concede-confirm">
                    <button className="text-button danger" onClick={() => dispatch({ type: "concede" })}>
                      Confirm concede
                    </button>
                    <button className="text-button" onClick={() => setConfirmConcede(false)}>
                      Keep playing
                    </button>
                  </span>
                ) : (
                  <button className="text-button" onClick={() => setConfirmConcede(true)}>
                    Concede
                  </button>
                )}
              </div>
              {game.pendingCranialDisplay && (
                <div className="mandatory-control-prompt" role="alert">
                  <strong>Cranial Display</strong>
                  <span>Choose a highlighted opposing Creature.</span>
                </div>
              )}
            </section>

            <section className="hand-zone">
              <div className="section-heading">
                <div>
                  <small>{handHidden ? "Hand covered" : "Private hand"}</small>
                  <h2>
                    {handHidden
                      ? "Private hand sealed for handoff"
                      : selectedCard
                        ? selectedCard.definition.name
                        : "Choose a card to play; hover to inspect"}
                  </h2>
                </div>
                <div className="hand-turn-status">
                  <span className="turn-phase-label">
                    Turn {game.turnNumber} · {PHASE_NAMES[game.phase].replace(" Phase", "")}
                  </span>
                  <div className="allowances">
                    <span className={allowances.creaturePlayed ? "used" : ""}>
                      Creature {allowances.creaturePlayed ? "used" : "1"}
                    </span>
                    <span className={allowances.adaptationPlayed ? "used" : ""}>
                      Adaptation {allowances.adaptationPlayed ? "used" : "1"}
                    </span>
                    <span className={allowances.eventPlayed ? "used" : ""}>
                      Event {allowances.eventPlayed ? "used" : "1"}
                    </span>
                    <span className={allowances.conceptsPlayed >= conceptLimit ? "used" : ""}>
                      Concept {allowances.conceptsPlayed}/{conceptLimit}
                    </span>
                    {allowances.skipBattlePhase && <span className="used">Battle skipped</span>}
                  </div>
                </div>
              </div>
              {handHidden ? (
                <div className="covered-hand">
                  <CardBack />
                  <CardBack />
                  <CardBack />
                  <p>The next player’s cards stay hidden until they confirm the handoff.</p>
                </div>
              ) : (
                <div className="hand-scroll">
                  {viewer.hand.map((card) => {
                    const target = { definition: card.definition };
                    return (
                      <button
                        className="hand-card-button"
                        key={card.uid}
                        aria-pressed={selectedCardUid === card.uid}
                        onClick={() => selectHandCard(card)}
                        {...inspectionHandlers(target, preview, pin)}
                      >
                        <CardFace card={card.definition} compact selected={selectedCardUid === card.uid} />
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </section>
        </section>

        <aside className={`side-rail ${inspectorOpen ? "open" : ""}`}>
          <Inspector
            target={pinned ?? hover}
            activeTab={inspectorTab}
            onTabChange={setInspectorTab}
            onClose={() => {
              if (pinned ?? hover) {
                setPinned(null);
                setHover(null);
                setInspectorTab("log");
              } else {
                setInspectorOpen(false);
                setMobileView("board");
              }
            }}
            game={game}
            historyViewer={historyViewer}
            onHistoryViewer={setHistoryViewer}
            onPin={pin}
            onPreview={preview}
            pinned={Boolean(pinned)}
          />
        </aside>
        {inspectorOpen && (
          <button className="sidewall-scrim" aria-label="Close inspector" onClick={() => setInspectorOpen(false)} />
        )}
      </div>

      {showRules && <RulesDrawer onClose={() => setShowRules(false)} />}
      {game.handoff && (
        <HandoffOverlay
          title={game.handoff.title}
          detail={game.handoff.detail}
          playerName={game.players[game.handoff.to].name}
          onContinue={() => dispatch({ type: "acknowledgeHandoff" })}
        />
      )}
      {resumeCover && !game.handoff && (
        <HandoffOverlay
          title="Resume your game"
          detail={`This game was saved during ${viewer.name}’s turn. Pass the device to ${viewer.name} before continuing.`}
          playerName={viewer.name}
          onContinue={() => setResumeCover(false)}
        />
      )}
      {!resumeCover && (
        <>
          {game.pendingBiodiversity && <BiodiversityModal game={game} dispatch={dispatch} />}
          {game.pendingFilterFeeder && <FilterFeederModal game={game} dispatch={dispatch} />}
          {game.pendingGeologicalBoundary && <GeologicalBoundaryModal game={game} dispatch={dispatch} />}
          {game.pendingEngulf && <EngulfModal game={game} dispatch={dispatch} />}
          {game.pendingConvergentChoice && <ConvergentChoiceModal game={game} dispatch={dispatch} />}
          {(game.pendingHerd || game.pendingNesting) && <EntryChoiceModal game={game} dispatch={dispatch} />}
          {game.pendingConceptChoice && <ConceptChoiceModal game={game} dispatch={dispatch} />}
          {game.pendingCarnianPluvial && <CarnianPluvialChoiceModal game={game} dispatch={dispatch} />}
          {game.pendingBattle && (
            <BattleModal
              key={`${game.pendingBattle.attackerUid}-${game.pendingBattle.defenderUid}`}
              game={game}
              dispatch={dispatch}
            />
          )}
        </>
      )}
      {game.winner !== null && <WinnerOverlay game={game} onRestart={onExit} />}
      {currentDraw && <DrawPresentation game={game} event={currentDraw} />}
    </main>
  );
}

type SelectedCardPanelProps = {
  game: GameState;
  card: CardInstance;
  targetCount: number;
  aquaticOverride: boolean;
  onClose: () => void;
  onPlayEvent: () => void;
  onPlayConcept: () => void;
};

function SelectedCardPanel({
  game,
  card,
  targetCount,
  aquaticOverride,
  onClose,
  onPlayEvent,
  onPlayConcept,
}: SelectedCardPanelProps) {
  const definition = card.definition;
  const allowances = game.players[game.activePlayer].allowances;
  const targets = (noun: string, none: string) =>
    targetCount ? `Choose one of ${targetCount} highlighted ${noun}.` : none;
  const instruction =
    definition.kind === "creature"
      ? aquaticOverride
        ? targets("Niches for the free override", "This Creature has no legal free override.")
        : allowances.rapidSpeciation
          ? "Choose a highlighted occupied Niche exactly two Levels lower."
          : targets("legal Niches", "No legal Niche.")
      : definition.kind === "adaptation"
        ? targets("eligible Niches", "No eligible Adaptation position.")
        : definition.key === "drought"
          ? targets("Niches on either side", "No legal Niche for Drought.")
          : definition.key === "wildfire"
            ? targets("unlocked Niches on your side", "No legal lane for Wildfire.")
            : null;
  const boardPlayed =
    definition.kind === "creature" || definition.kind === "adaptation" || NICHE_EVENT_KEYS.has(definition.key);

  return (
    <section className="card-inspector">
      <div className="selected-card-summary">
        <small>Selected card</small>
        <strong>{definition.name}</strong>
        {instruction && <span>{instruction}</span>}
      </div>
      <div className="selected-card-actions">
        {definition.kind === "event" && !NICHE_EVENT_KEYS.has(definition.key) && (
          <button
            className="primary-button"
            disabled={aquaticOverride || !canPlayEvent(game, card)}
            onClick={onPlayEvent}
          >
            Play Event
          </button>
        )}
        {definition.kind === "concept" && (
          <button
            className="primary-button"
            disabled={aquaticOverride || !canPlayConcept(game, card)}
            onClick={onPlayConcept}
          >
            Play Concept
          </button>
        )}
        {boardPlayed && (
          <span className={targetCount ? "legal" : "blocked"}>
            {targetCount ? "Board selection ready" : "Currently blocked"}
          </span>
        )}
      </div>
      <button className="clear-selected" onClick={onClose} aria-label="Clear selected card">
        ×
      </button>
    </section>
  );
}

type BiomeControlProps = {
  game: GameState;
  active: boolean;
  onReposition: () => void;
  onOverride: () => void;
  onCancel: () => void;
};

function BiomeControl({ game, active, onReposition, onOverride, onCancel }: BiomeControlProps) {
  const player = game.players[game.activePlayer];
  if (!player.biome.key) {
    return (
      <section className="biome-control">
        <small>No Biome</small>
        <strong>Standard rules</strong>
      </section>
    );
  }
  const biome = biomeByKey(player.biome.key);
  let status = biome.shortRules;
  if (player.biome.key === "temperate") status = `${player.biome.seasonCounters} of 4 Season counters remain`;
  if (player.biome.key === "aquatic") {
    status = player.biome.waterwaysConnected
      ? player.biome.waterwayRepositionTurn === game.turnNumber
        ? "Connected · reposition used this turn"
        : "Connected · reposition available"
      : "Disconnected · free override spent";
  }
  return (
    <section className={`biome-control biome-${player.biome.key}`}>
      <small>
        {biome.name} · {biome.abilityName}
      </small>
      <strong>{status}</strong>
      {player.biome.key === "aquatic" && player.biome.waterwaysConnected && game.phase === "development" && (
        <div className="biome-control-actions">
          <button
            className="quiet-button"
            disabled={!active && legalConnectedWaterwaySources(game).length === 0}
            onClick={active ? onCancel : onReposition}
          >
            {active ? "Cancel" : "Reposition"}
          </button>
          <button className="quiet-button" disabled={active || !canUseAquaticOverride(game)} onClick={onOverride}>
            Free override
          </button>
        </div>
      )}
    </section>
  );
}
