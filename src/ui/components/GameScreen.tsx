import { type CSSProperties, useEffect, useState } from "react";

import { DIFFICULTY_NAMES } from "../../ai/ai.ts";
import { biomeByKey, type BiomeKey } from "../../data/biomes.ts";
import {
  canActivateCarnianPluvialEpisode,
  canPerformFullHandMulligan,
  canPlayConcept,
  canPlayEvent,
  canUseAquaticOverride,
  type CardInstance,
  endingTurnForfeits,
  explainCard,
  explainHunt,
  explainHunter,
  explainPlacement,
  findCreature,
  type GameAction,
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
  type PlayerState,
  type Verdict,
  VICTORY_THRESHOLD,
  victoryTotals,
} from "../../engine/index.ts";
import { assetUrl } from "../assets.ts";
import { useComputerOpponent } from "../useComputerOpponent.ts";
import { useGameSession } from "../useGameSession.ts";
import { BattleModal } from "./BattleModal.tsx";
import { EventZone, NicheLane } from "./Board.tsx";
import { CardBack, CardFace } from "./CardFace.tsx";
import { CardBlowup } from "./CardBlowup.tsx";
import { DrawFlight } from "./DrawFlight.tsx";
import { CardBackFan, Hand } from "./Hand.tsx";
import type { DropTarget } from "../dropTarget.ts";
import {
  type InspectionTarget,
  inspectionHandlers,
  type InspectorTab,
  type PinHandler,
  type PreviewHandler,
} from "../inspection.ts";
import { type Explanation, huntBadge, type LaneBadge, placementBadge } from "../legality.ts";
import { Inspector } from "./Inspector.tsx";
import { LegalityPanel } from "./LegalityPanel.tsx";
import {
  BiodiversityModal,
  CarnianPluvialChoiceModal,
  ConceptChoiceModal,
  ConvergentChoiceModal,
  EngulfModal,
  EntryChoiceModal,
  FilterFeederModal,
  GeologicalBoundaryModal,
  GreatDyingModal,
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
  /** A tutorial's staged game: never saved, so it cannot replace a game in progress. */
  tutorial?: boolean;
};

export function GameScreen({ initialGame, resumed, onExit, tutorial = false }: GameScreenProps) {
  const {
    game,
    dispatch: dispatchAny,
    currentDraw,
    pendingDrawUids,
  } = useGameSession(initialGame, { persist: !tutorial });
  const computerTurn = useComputerOpponent(game, dispatchAny);
  // The person's own moves; ignored while the computer is the one to move.
  const dispatch = (action: GameAction) => {
    if (!computerTurn) dispatchAny(action);
  };
  const computer = game.computer ?? null;
  // Against the computer nobody passes the device, so there is no hand to cover on resume.
  const [resumeCover, setResumeCover] = useState(resumed && !initialGame.handoff && !initialGame.computer);
  const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null);
  const [selectedAttackerUid, setSelectedAttackerUid] = useState<string | null>(null);
  const [boardAction, setBoardAction] = useState<BoardAction>(null);
  const [historyViewer, setHistoryViewer] = useState<PlayerId | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [pinned, setPinned] = useState<InspectionTarget | null>(null);
  const [hover, setHover] = useState<InspectionTarget | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("log");
  const [inspectorOpen, setInspectorOpen] = useState(false);
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
  // The Niche whose move the "why not?" panel explains; reset whenever the selection changes.
  const [explainLane, setExplainLane] = useState<{ playerId: PlayerId; laneIndex: number } | null>(null);
  const selectionKey = `${selectedCardUid}|${selectedAttackerUid}|${boardAction?.kind}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (lastSelectionKey !== selectionKey) {
    setLastSelectionKey(selectionKey);
    setExplainLane(null);
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
    if (openInspector) setInspectorOpen(true);
  };
  const preview = (target: InspectionTarget | null) => {
    setHover(target);
    if (!pinned && target) setInspectorTab("card");
  };
  const openHistory = (player: PlayerId) => {
    setHistoryViewer(player);
    setInspectorTab("history");
    setInspectorOpen(true);
  };
  const clearSelection = () => {
    setSelectedCardUid(null);
    setSelectedAttackerUid(null);
  };

  // Two people take turns at the device; against the computer the screen always belongs to the person.
  const viewPlayer = computer ? otherPlayer(computer.seat) : game.activePlayer;
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

  /** Takes the game action a click on this Niche means, if any; returns whether it took one. */
  const handleLaneClick = (playerId: PlayerId, laneIndex: number): boolean => {
    if (computerTurn) return false;
    const lane = game.players[playerId].lanes[laneIndex]!;
    const own = playerId === viewPlayer;
    if (own && boardAction?.kind === "facultative-source" && legalFacultativeSources(game).includes(laneIndex)) {
      setBoardAction({ kind: "facultative-destination", sourceLane: laneIndex });
      setSelectedCardUid(null);
      return true;
    }
    if (
      own &&
      boardAction?.kind === "facultative-destination" &&
      legalFacultativeDestinations(game, boardAction.sourceLane).includes(laneIndex)
    ) {
      dispatch({ type: "moveFacultative", sourceLane: boardAction.sourceLane, destinationLane: laneIndex });
      setBoardAction(null);
      return true;
    }
    if (own && boardAction?.kind === "waterway-source" && legalConnectedWaterwaySources(game).includes(laneIndex)) {
      setBoardAction({ kind: "waterway-destination", sourceLane: laneIndex });
      setSelectedCardUid(null);
      return true;
    }
    if (
      own &&
      boardAction?.kind === "waterway-destination" &&
      legalConnectedWaterwayDestinations(game, boardAction.sourceLane).includes(laneIndex)
    ) {
      dispatch({ type: "repositionWaterway", sourceLane: boardAction.sourceLane, destinationLane: laneIndex });
      setBoardAction(null);
      return true;
    }
    if (own && boardAction?.kind === "aquatic-override" && selectedCard && creatureLanes.includes(laneIndex)) {
      dispatch({ type: "playAquaticOverride", cardUid: selectedCard.uid, laneIndex });
      setBoardAction(null);
      clearSelection();
      return true;
    }
    if (
      game.pendingCranialDisplay &&
      lane.creature &&
      game.pendingCranialDisplay.eligibleTargetUids.includes(lane.creature.card.uid)
    ) {
      dispatch({ type: "chooseCranialDisplayTarget", targetUid: lane.creature.card.uid });
      return true;
    }
    if (selectedCard && isLegalSelectedPosition(playerId, laneIndex)) {
      const { kind, key } = selectedCard.definition;
      const cardUid = selectedCard.uid;
      if (kind === "creature") dispatch({ type: "playCreature", cardUid, laneIndex });
      else if (kind === "adaptation") dispatch({ type: "playAdaptation", cardUid, targetPlayer: playerId, laneIndex });
      else if (key === "wildfire") dispatch({ type: "playWildfire", cardUid, laneIndex });
      else if (key === "drought") dispatch({ type: "playDrought", cardUid, targetPlayer: playerId, laneIndex });
      clearSelection();
      return true;
    }
    if (game.phase === "battle" && lane.creature) {
      if (own) {
        const uid = lane.creature.card.uid;
        setSelectedAttackerUid(selectedAttackerUid === uid ? null : uid);
        setSelectedCardUid(null);
        return true;
      }
      if (selectedAttackerUid && attackTargets.includes(lane.creature.card.uid)) {
        dispatch({ type: "previewHunt", attackerUid: selectedAttackerUid, defenderUid: lane.creature.card.uid });
        return true;
      }
    }
    // Not a legal move here: explain why instead (the only way to ask on touch screens).
    if (canExplainLane(playerId, laneIndex)) {
      setExplainLane({ playerId, laneIndex });
      return true;
    }
    return false;
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

  // A second full-hand turn in a row forfeits: say so before the person ends this one.
  const forfeitWarning =
    !computerTurn && game.activePlayer === viewPlayer && game.phase !== "game-over" && endingTurnForfeits(game);
  const legalHuntsAvailable = hasLegalHunts(game, viewPlayer);
  const facultativeSources = legalFacultativeSources(game);
  const handHidden = !computer && (Boolean(game.handoff) || resumeCover);
  const facultativeActive =
    boardAction?.kind === "facultative-source" || boardAction?.kind === "facultative-destination";
  const aquaticActive = boardAction !== null && !facultativeActive;

  // Legality explanations: badges on each Niche, the "why not?" panel, and hand-card reasons.
  const placementVerdicts =
    game.phase === "development" &&
    selectedCard?.definition.kind === "creature" &&
    (boardAction === null || boardAction.kind === "aquatic-override")
      ? viewer.lanes.map((_, laneIndex) =>
          explainPlacement(game, viewPlayer, selectedCard, laneIndex, {
            aquaticOverride: boardAction?.kind === "aquatic-override",
          }),
        )
      : null;
  const huntVerdicts =
    selectedAttackerUid && game.phase === "battle" && !game.pendingBattle
      ? opponentState.lanes.map((lane) =>
          lane.creature ? explainHunt(game, selectedAttackerUid, lane.creature.card.uid) : null,
        )
      : null;
  const laneBadge = (playerId: PlayerId, laneIndex: number): LaneBadge | undefined => {
    if (playerId === viewPlayer && placementVerdicts) {
      return placementBadge(placementVerdicts[laneIndex]!, Boolean(viewer.lanes[laneIndex]!.creature));
    }
    const hunt = playerId !== viewPlayer ? huntVerdicts?.[laneIndex] : null;
    return hunt ? huntBadge(hunt) : undefined;
  };
  const canExplainLane = (playerId: PlayerId, laneIndex: number) =>
    playerId === viewPlayer ? Boolean(placementVerdicts) : Boolean(huntVerdicts?.[laneIndex]);
  const cardVerdicts =
    game.phase === "development" && !handHidden && !computerTurn
      ? new Map(viewer.hand.map((card) => [card.uid, explainCard(game, card)]))
      : null;
  const selectedAttacker = selectedAttackerUid ? findCreature(game, selectedAttackerUid) : null;

  const explanation = ((): Explanation | null => {
    if (explainLane?.playerId === viewPlayer && placementVerdicts && selectedCard) {
      const verdict = placementVerdicts[explainLane.laneIndex]!;
      const name = selectedCard.definition.name;
      const occupant = viewer.lanes[explainLane.laneIndex]!.creature?.card.definition.name;
      const niche = `Niche ${explainLane.laneIndex + 1}`;
      const title = occupant
        ? verdict.legal
          ? `${name} can replace ${occupant}`
          : `Why can't ${name} replace ${occupant}?`
        : verdict.legal
          ? `${name} can fill ${niche}`
          : `Why can't ${name} fill ${niche}?`;
      return { title, legal: verdict.legal, reasons: verdict.reasons, placement: verdict };
    }
    const hunt = explainLane && explainLane.playerId !== viewPlayer ? huntVerdicts?.[explainLane.laneIndex] : null;
    if (hunt && selectedAttacker) {
      const target = opponentState.lanes[explainLane!.laneIndex]!.creature!.card.definition.name;
      const hunter = selectedAttacker.creature.card.definition.name;
      return {
        title: hunt.legal ? `${hunter} can Hunt ${target}` : `Why can't ${hunter} Hunt ${target}?`,
        legal: hunt.legal,
        reasons: hunt.reasons,
      };
    }
    if (selectedAttacker && game.phase === "battle" && !game.pendingBattle) {
      const reasons = explainHunter(game, selectedAttacker.creature.card.uid);
      if (reasons.length) {
        return { title: `Why can't ${selectedAttacker.creature.card.definition.name} Hunt?`, legal: false, reasons };
      }
    }
    const cardVerdict = selectedCard ? cardVerdicts?.get(selectedCard.uid) : null;
    if (selectedCard && cardVerdict && !cardVerdict.legal) {
      return {
        title: `Why can't you play ${selectedCard.definition.name}?`,
        legal: false,
        reasons: cardVerdict.reasons,
      };
    }
    return null;
  })();

  const boardActionPrompt: Record<NonNullable<BoardAction>["kind"], string> = {
    "facultative-source": "Choose the Creature with Facultative Quadrupedality.",
    "facultative-destination": "Choose an empty adjacent destination.",
    "waterway-source": "Choose a Creature to reposition.",
    "waterway-destination": "Choose its empty destination Niche.",
    "aquatic-override": "Choose a Creature card for the free override.",
  };

  const lanes = (playerId: PlayerId) => (
    <div
      className={`tbl-lanes ${playerId === viewPlayer ? "own" : "opponent"}`}
      data-tutorial-target={playerId === viewPlayer ? "player-niches" : "opponent-niches"}
    >
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
          badge={laneBadge(playerId, laneIndex)}
          onExplain={canExplainLane(playerId, laneIndex) ? () => setExplainLane({ playerId, laneIndex }) : undefined}
        />
      ))}
    </div>
  );

  const selectHandCard = (card: CardInstance) => {
    pin({ definition: card.definition });
    // While the computer moves, cards can be inspected but not played.
    if (computerTurn) return;
    setSelectedCardUid(selectedCardUid === card.uid ? null : card.uid);
    setSelectedAttackerUid(null);
    if (boardAction?.kind !== "aquatic-override") setBoardAction(null);
  };

  // Dragging a card from the hand chooses it, so the board lights where it can go, and letting go plays it.
  const startDrag = (card: CardInstance) => {
    if (computerTurn) return;
    setSelectedCardUid(card.uid);
    setSelectedAttackerUid(null);
    if (boardAction?.kind !== "aquatic-override") setBoardAction(null);
  };
  const dragOver = (target: DropTarget | null) => {
    if (target?.kind === "lane" && canExplainLane(target.playerId, target.laneIndex)) {
      setExplainLane({ playerId: target.playerId, laneIndex: target.laneIndex });
    } else setExplainLane(null);
  };
  const dropCard = (card: CardInstance, target: DropTarget | null) => {
    setExplainLane(null);
    const { kind, key } = card.definition;
    if (target?.kind === "lane" && isLegalSelectedPosition(target.playerId, target.laneIndex)) {
      handleLaneClick(target.playerId, target.laneIndex);
      return;
    }
    if (target && kind === "event" && !NICHE_EVENT_KEYS.has(key) && canPlayEvent(game, card)) {
      dispatch({ type: "playEvent", cardUid: card.uid });
    } else if (target && kind === "concept" && canPlayConcept(game, card)) {
      dispatch({ type: "playConcept", cardUid: card.uid });
    }
    // Anything else goes back to the hand.
    clearSelection();
  };

  const openLog = () => {
    setInspectorTab("log");
    setInspectorOpen(true);
  };

  const prompt = computerTurn
    ? `${game.players[computer!.seat].name} is playing: ${game.log.at(-1) ?? "thinking…"}`
    : game.pendingCranialDisplay
      ? "Cranial Display: choose a highlighted opposing Creature."
      : boardAction
        ? boardActionPrompt[boardAction.kind]
        : selectedCard
          ? selectedCardInstruction(game, selectedCard, selectedTargetCount, false, cardVerdicts)
          : game.phase === "battle"
            ? selectedAttackerUid
              ? attackTargets.length
                ? "Choose a highlighted target to Hunt."
                : "No legal target."
              : "Choose a ready hunter."
            : game.phase === "development"
              ? "Choose a card to play: drag it onto the board."
              : PHASE_NAMES[game.phase];

  return (
    <main className="tbl-page">
      <p className="tbl-rotate-notice">Turn your device sideways to play.</p>
      <div className="tbl-table" data-tutorial-target="table">
        <div
          className={`tbl-backdrop-half top biome-${opponentState.biome.key ?? "none"}`}
          style={biomeBoardStyle(opponentState.biome.key)}
          aria-hidden="true"
        />
        <div
          className={`tbl-backdrop-half bottom biome-${viewer.biome.key ?? "none"}`}
          style={biomeBoardStyle(viewer.biome.key)}
          aria-hidden="true"
        />
        <div className="tbl-divider" aria-hidden="true" />

        <nav className="tbl-corner" aria-label="Game menu" data-tutorial-target="header-controls">
          <button className="tbl-chip" onClick={openLog} data-tutorial-target="inspector">
            Game log
          </button>
          <button className="tbl-chip" onClick={() => setShowRules(!showRules)}>
            {showRules ? "Close rules" : "Rules"}
          </button>
          <button className="tbl-chip" onClick={onExit}>
            Main menu
          </button>
          {confirmConcede ? (
            <>
              <button className="tbl-chip danger" onClick={() => dispatch({ type: "concede" })}>
                Confirm concede
              </button>
              <button className="tbl-chip" onClick={() => setConfirmConcede(false)}>
                Keep playing
              </button>
            </>
          ) : (
            <button className="tbl-chip" onClick={() => setConfirmConcede(true)}>
              Concede
            </button>
          )}
        </nav>

        <section className="tbl-area-opp-hand" data-hand-area={opponent} aria-label={`${opponentState.name}'s hand`}>
          <CardBackFan count={opponentState.hand.length} className="opponent" />
        </section>

        <div className="tbl-area-opp-deck">
          <DeckPile player={opponentState} playerId={opponent} />
        </div>
        <div className="tbl-area-opp-history">
          <HistoryPile player={opponentState} onOpen={() => openHistory(opponent)} onPreview={preview} onPin={pin} />
        </div>
        <div className="tbl-area-opp-event">
          <EventZone game={game} playerId={opponent} onPin={pin} onPreview={preview} />
        </div>
        <div className="tbl-area-own-event" data-tutorial-target="event-zone">
          <EventZone game={game} playerId={viewPlayer} onPin={pin} onPreview={preview} />
        </div>
        <div className="tbl-area-own-history">
          <HistoryPile player={viewer} onOpen={() => openHistory(viewPlayer)} onPreview={preview} onPin={pin} />
        </div>
        <div className="tbl-area-own-deck" data-tutorial-target="piles">
          <DeckPile player={viewer} playerId={viewPlayer} />
        </div>

        <section className="tbl-board" data-drop-board aria-label="Game board">
          <div
            className="tbl-half opponent"
            data-tutorial-target="opponent-half"
            aria-label={`${opponentState.name}'s ${opponentState.biome.key ? biomeByKey(opponentState.biome.key).name : "standard"} ecosystem`}
          >
            {lanes(opponent)}
          </div>
          <div className="tbl-centerline" data-tutorial-target="centerline">
            {game.periodAuras.length > 0 && (
              <span>
                {game.periodAuras.map((aura) => `Geological Boundary · ${aura.period} +100 Battle Power`).join(" · ")}
              </span>
            )}
          </div>
          <div
            className="tbl-half own"
            data-tutorial-target="player-half"
            aria-label={`${viewer.name}'s ${viewer.biome.key ? biomeByKey(viewer.biome.key).name : "standard"} ecosystem`}
          >
            {lanes(viewPlayer)}
          </div>
          {explanation && (
            // Keep the sheet clear of the Niches being chosen: Hunts target the top row, placements the bottom.
            <LegalityPanel
              explanation={explanation}
              className={`as-sheet ${selectedAttacker ? "over-own" : "over-opponent"}`}
            />
          )}
        </section>

        {/* The info panels: one bottom left, one bottom right; on phones both stack at the left. */}
        <div className="tbl-info-dock">
          <section
            className="tbl-info large"
            aria-label={computerTurn ? "Computer's turn" : "Turn"}
            aria-live={computerTurn ? "polite" : undefined}
            data-tutorial-target="turn-summary"
          >
            <div className="tbl-score" data-tutorial-target="victory">
              <span>
                <small>{computer ? "You" : viewer.name}</small>
                <b>
                  {totals[viewPlayer]}
                  <i>/{VICTORY_THRESHOLD}</i>
                </b>
              </span>
              <span className="opponent">
                <small>{computer ? `Computer · ${DIFFICULTY_NAMES[computer.difficulty]}` : opponentState.name}</small>
                <b>
                  {totals[opponent]}
                  <i>/{VICTORY_THRESHOLD}</i>
                </b>
              </span>
            </div>
            <p className="tbl-phase">
              Turn {game.turnNumber} · {game.players[game.activePlayer].name}’s {PHASE_NAMES[game.phase]}
              {typeof game.finalTurn === "number" && game.phase !== "game-over" && (
                <em className="final-round">
                  {game.turnNumber >= game.finalTurn ? " · Final turn" : " · Final round"}
                </em>
              )}
            </p>
            {forfeitWarning && (
              <p className="forfeit-warning" role="alert">
                Full hand: play a card or Mulligan, or ending this turn forfeits.
              </p>
            )}
            <p className="tbl-prompt" aria-live="polite">
              {prompt}
            </p>
            {!computerTurn && (
              <div className="tbl-actions">
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
                      ? forfeitWarning
                        ? "Forfeit · Battle skipped"
                        : "End Turn · Battle skipped"
                      : legalHuntsAvailable
                        ? "Enter Battle Phase"
                        : forfeitWarning
                          ? "End Turn and forfeit"
                          : "End Turn"}
                  </button>
                )}
                {(game.phase === "battle" || (game.phase === "development" && legalHuntsAvailable)) && (
                  <button
                    className="quiet-button"
                    disabled={boardAction !== null}
                    onClick={() => {
                      dispatch({ type: "endTurn" });
                      clearSelection();
                    }}
                  >
                    {forfeitWarning ? "End turn and forfeit" : "End turn"}
                  </button>
                )}
                {selectedCard?.definition.kind === "event" && !NICHE_EVENT_KEYS.has(selectedCard.definition.key) && (
                  <button
                    className="primary-button"
                    disabled={boardAction !== null || !canPlayEvent(game, selectedCard)}
                    onClick={() => {
                      dispatch({ type: "playEvent", cardUid: selectedCard.uid });
                      clearSelection();
                    }}
                  >
                    Play Event
                  </button>
                )}
                {selectedCard?.definition.kind === "concept" && (
                  <button
                    className="primary-button"
                    disabled={boardAction !== null || !canPlayConcept(game, selectedCard)}
                    onClick={() => {
                      dispatch({ type: "playConcept", cardUid: selectedCard.uid });
                      clearSelection();
                    }}
                  >
                    Play Concept
                  </button>
                )}
                {(selectedCardUid || selectedAttackerUid) && (
                  <button className="quiet-button" onClick={clearSelection}>
                    Cancel
                  </button>
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
                    {facultativeActive ? "Cancel movement" : "Facultative move"}
                  </button>
                )}
                {canPerformFullHandMulligan(game) && (
                  <button className="quiet-button" onClick={() => dispatch({ type: "fullHandMulligan" })}>
                    Mulligan
                  </button>
                )}
              </div>
            )}
          </section>

          <BiomeInfo
            game={game}
            playerId={viewPlayer}
            active={aquaticActive}
            onReposition={() => startBoardAction({ kind: "waterway-source" })}
            onOverride={() => startBoardAction({ kind: "aquatic-override" })}
            onCancel={() => startBoardAction(null)}
          />
        </div>

        <FullscreenButton />

        <section
          className="tbl-area-own-hand"
          data-hand-area={viewPlayer}
          data-tutorial-target="hand"
          aria-label="Your hand"
        >
          {handHidden ? (
            <>
              <CardBackFan count={viewer.hand.length} className="covered" />
              <p className="tbl-covered-note">Private hand sealed for handoff</p>
            </>
          ) : (
            <Hand
              cards={viewer.hand}
              verdicts={cardVerdicts}
              selectedUid={selectedCardUid}
              hiddenUids={pendingDrawUids}
              onSelect={selectHandCard}
              onDragStart={startDrag}
              onDragOver={dragOver}
              onDrop={dropCard}
              onPreview={preview}
              onPin={pin}
              readOnly={computerTurn}
            />
          )}
        </section>
      </div>

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
        <button className="sidewall-scrim" aria-label="Close game log" onClick={() => setInspectorOpen(false)} />
      )}
      {!inspectorOpen && <CardBlowup game={game} target={hover} />}

      {showRules && <RulesDrawer onClose={() => setShowRules(false)} />}
      {game.handoff && !computer && (
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
      {/* The computer makes its own choices out of sight; only the Hunt itself is shown to the person. */}
      {!resumeCover && !computerTurn && (
        <>
          {game.pendingBiodiversity && <BiodiversityModal game={game} dispatch={dispatch} />}
          {game.pendingFilterFeeder && <FilterFeederModal game={game} dispatch={dispatch} />}
          {game.pendingGeologicalBoundary && <GeologicalBoundaryModal game={game} dispatch={dispatch} />}
          {game.pendingGreatDying && <GreatDyingModal game={game} dispatch={dispatch} />}
          {game.pendingEngulf && <EngulfModal game={game} dispatch={dispatch} />}
          {game.pendingConvergentChoice && <ConvergentChoiceModal game={game} dispatch={dispatch} />}
          {(game.pendingHerd || game.pendingNesting) && <EntryChoiceModal game={game} dispatch={dispatch} />}
          {game.pendingConceptChoice && <ConceptChoiceModal game={game} dispatch={dispatch} />}
          {game.pendingCarnianPluvial && <CarnianPluvialChoiceModal game={game} dispatch={dispatch} />}
        </>
      )}
      {!resumeCover && game.pendingBattle && (
        <BattleModal
          key={`${game.pendingBattle.attackerUid}-${game.pendingBattle.defenderUid}`}
          game={game}
          // A person may reroll their own coin during the computer's Hunt, so rerolls bypass the turn guard.
          dispatch={(action) => (action.type === "rerollBattleCoin" ? dispatchAny(action) : dispatch(action))}
          controller={computer ? otherPlayer(computer.seat) : null}
        />
      )}
      {game.phase === "game-over" && <WinnerOverlay game={game} onRestart={onExit} />}
      {currentDraw && (
        <DrawFlight
          game={game}
          event={currentDraw}
          faceVisible={currentDraw.playerId === viewPlayer && (Boolean(computer) || !game.handoff)}
        />
      )}
    </main>
  );
}

/** Toggles fullscreen. Hidden where the browser can't do it (iPhones, for one). */
function FullscreenButton() {
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  if (!document.fullscreenEnabled) return null;
  return (
    <button
      className="tbl-chip tbl-fullscreen"
      aria-pressed={fullscreen}
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      }}
    >
      <span aria-hidden="true">{fullscreen ? "⤡" : "⤢"}</span> {fullscreen ? "Exit fullscreen" : "Fullscreen"}
    </button>
  );
}

/** What to do with the chosen card, or why it can't be played. */
function selectedCardInstruction(
  game: GameState,
  card: CardInstance,
  targetCount: number,
  aquaticOverride: boolean,
  verdicts: Map<string, Verdict> | null,
) {
  const verdict = verdicts?.get(card.uid);
  if (verdict && !verdict.legal) return verdict.reasons[0]?.text ?? "This card can't be played now.";
  const definition = card.definition;
  const allowances = game.players[game.activePlayer].allowances;
  const targets = (noun: string, none: string) =>
    targetCount ? `Drag it to one of ${targetCount} highlighted ${noun}.` : none;
  if (definition.kind === "creature") {
    if (aquaticOverride) return targets("Niches for the free override", "This Creature has no legal free override.");
    if (allowances.rapidSpeciation) return "Drag it onto a highlighted Creature exactly two Levels lower.";
    return targets("Niches", "No legal Niche.");
  }
  if (definition.kind === "adaptation") return targets("Niches", "No eligible Adaptation position.");
  if (definition.key === "drought") return targets("Niches on either side", "No legal Niche for Drought.");
  if (definition.key === "wildfire") return targets("Niches on your side", "No legal lane for Wildfire.");
  return `Drag it onto the board to play ${definition.name}.`;
}

/** A player's deck: a face-down stack. How many cards it holds shows on hover. */
function DeckPile({ player, playerId }: { player: PlayerState; playerId: PlayerId }) {
  const count = player.deck.length;
  return (
    <div
      className={`tbl-pile tbl-deck ${count ? "" : "empty"}`}
      data-deck-pile={playerId}
      tabIndex={0}
      aria-label={`${player.name}'s deck: ${count} ${count === 1 ? "card" : "cards"}`}
    >
      {count > 0 ? (
        <span className="tbl-stack" style={{ "--stack": Math.min(6, Math.ceil(count / 7)) } as CSSProperties}>
          <CardBack />
        </span>
      ) : (
        <span>Deck</span>
      )}
      <span className="tbl-hover-count">
        {count} {count === 1 ? "card" : "cards"}
      </span>
    </div>
  );
}

/** A player's History pile: the last card sent there, face up. Click to look through it. */
function HistoryPile({
  player,
  onOpen,
  onPreview,
  onPin,
}: {
  player: PlayerState;
  onOpen: () => void;
  onPreview: PreviewHandler;
  onPin: PinHandler;
}) {
  const top = player.history.at(-1);
  const count = player.history.length;
  return (
    <button
      className={`tbl-pile tbl-history ${top ? "" : "empty"}`}
      onClick={onOpen}
      aria-label={`${player.name}'s History: ${count} ${count === 1 ? "card" : "cards"}`}
      {...(top ? inspectionHandlers({ definition: top.definition }, onPreview, onPin) : {})}
    >
      {top ? <CardFace card={top.definition} compact /> : <span>History</span>}
      <span className="tbl-hover-count">
        {count} {count === 1 ? "card" : "cards"}
      </span>
    </button>
  );
}

type BiomeInfoProps = {
  game: GameState;
  playerId: PlayerId;
  active: boolean;
  onReposition: () => void;
  onOverride: () => void;
  onCancel: () => void;
};

/** The small info screen: the person's Biome, its ability and anything it has left. The full rule shows on hover. */
function BiomeInfo({ game, playerId, active, onReposition, onOverride, onCancel }: BiomeInfoProps) {
  const player = game.players[playerId];
  if (!player.biome.key) {
    return (
      <section className="tbl-info small" data-tutorial-target="biome-control">
        <strong>No Biome</strong>
      </section>
    );
  }
  const biome = biomeByKey(player.biome.key);
  let status: string | null = null;
  if (player.biome.key === "temperate") status = `${player.biome.seasonCounters} of 4 Season counters`;
  if (player.biome.key === "aquatic") {
    status = player.biome.waterwaysConnected
      ? player.biome.waterwayRepositionTurn === game.turnNumber
        ? "Connected · reposition used"
        : "Connected"
      : "Disconnected";
  }
  const ownTurn = game.activePlayer === playerId;
  return (
    <section
      className={`tbl-info small biome-${player.biome.key}`}
      data-tutorial-target="biome-control"
      tabIndex={0}
      aria-label={`${biome.name} Biome: ${biome.abilityName}. ${biome.rules}`}
    >
      <strong>{biome.name}</strong>
      <small>{biome.abilityName}</small>
      {status && <small className="tbl-biome-status">{status}</small>}
      {ownTurn && player.biome.key === "aquatic" && player.biome.waterwaysConnected && game.phase === "development" && (
        <div className="tbl-actions">
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
      <span className="tbl-biome-rule" role="tooltip">
        <b>
          {biome.name} · {biome.abilityName}
        </b>
        {biome.rules}
      </span>
    </section>
  );
}
