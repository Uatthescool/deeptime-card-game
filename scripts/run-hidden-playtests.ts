import {
  acknowledgeHandoff,
  activateCarnianPluvialEpisode,
  advanceToBattleOrEndTurn,
  battleCoinPlan,
  canActivateCarnianPluvialEpisode,
  canPlayConcept,
  canPlayEvent,
  cardVictoryLevel,
  checkOverride,
  chooseEngulf,
  chooseFilterFeederTop,
  chooseHerd,
  chooseNesting,
  chooseGeologicalBoundaryPeriod,
  chooseCarnianPluvialOption,
  chooseConceptOption,
  chooseConvergentCategory,
  chooseCranialDisplayTarget,
  commitBattle,
  createGame,
  effectiveHasTag,
  endTurn,
  findCreature,
  getCarnianPluvialOptions,
  getConceptChoiceOptions,
  getHerdOptions,
  getNestingOptions,
  geologicalBoundaryOptions,
  hasLegalHunts,
  laneIsLocked,
  legalAdaptationTargets,
  legalAttackTargets,
  legalCreatureLanes,
  legalDroughtTargets,
  legalFacultativeDestinations,
  legalFacultativeSources,
  legalWildfireLanes,
  performFullHandMulligan,
  playAdaptation,
  playConcept,
  playCreature,
  playDrought,
  playEvent,
  playWildfire,
  previewBattle,
  moveFacultativeQuadrupedality,
  victoryTotals,
  type BattleCoinResults,
  type CardInstance,
  type GameState,
  type PlayerId,
} from "../app/game-engine.ts";
import type { CreatureCard, DeckKey } from "../app/game-data.ts";

type Style = "pressure" | "development";

type Action = {
  kind: string;
  label: string;
  cardKey?: string;
  prior: number;
  apply: (state: GameState) => GameState;
};

type GiganticBattle = {
  turn: number;
  attacker: string;
  defender: string;
  attackerTags: string[];
  currentThreshold: string;
  giganticOnlyExceptionThreshold: string;
  giganticOrBruiserExceptionThreshold: string;
  actualResult: string;
};

type AltWinWindow = {
  turn: number;
  winner: PlayerId;
  victory: number;
  opponentVictory: number;
};

type AbiogenesisWindow = {
  turn: number;
  player: PlayerId;
  bestLevel0: string;
  ownCreatures: number;
  opposingCreatures: number;
  victory: number;
  opposingVictory: number;
  normalCreaturePlayAvailable: boolean;
  creaturePlayAlreadyUsed: boolean;
  legalHuntAvailable: boolean;
  wouldUsePlacementMode: boolean;
};

type GeneralistWindow = {
  turn: number;
  player: PlayerId;
  incoming: string;
  occupant: string;
  lane: number;
};

type Telemetry = {
  game: number;
  seed: number;
  styles: [Style, Style];
  decks: [DeckKey, DeckKey];
  firstPlayer: PlayerId;
  actions: Array<{ turn: number; player: PlayerId; label: string }>;
  cardPlays: Record<string, number>;
  battles: number;
  creaturesDestroyed: number;
  ties: number;
  noDevelopmentTurns: number;
  noLegalHuntTurns: number;
  turnStartsWithoutCreaturePlay: number;
  turnStartsWithEmptyBoard: number;
  maximumHandSize: number;
  giganticBattles: GiganticBattle[];
  altWinWindows: AltWinWindow[];
  abiogenesisWindows: AbiogenesisWindow[];
  generalistWindows: GeneralistWindow[];
  naturalFinish: boolean;
  termination: "win" | "deadlock" | "limit";
  deadlockReason: string | null;
  winner: PlayerId | null;
  winReason: string | null;
  finalTurn: number;
  finalVictory: [number, number];
  finalBoard: [number, number];
  finalHands: [string[], string[]];
  finalDeckSizes: [number, number];
  finalBoardNames: [string[], string[]];
  finalLegalHunts: Array<{ attacker: string; defender: string }>;
};

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  snapshot() {
    return this.state;
  }

  restore(snapshot: number) {
    this.state = snapshot >>> 0;
  }
}

const otherPlayer = (player: PlayerId): PlayerId => player === 0 ? 1 : 0;

function boardCount(state: GameState, playerId: PlayerId) {
  return state.players[playerId].lanes.filter((lane) => lane.creature).length;
}

function effectiveTags(card: CreatureCard) {
  const tags = new Set(card.tags);
  if (tags.has("Glider")) tags.add("Aerial");
  if (tags.has("Sovereign")) {
    tags.add("Gigantic");
    if (card.diet !== "Herbivore") tags.add("Territorial");
  }
  return tags;
}

function publicCreatureValue(state: GameState, playerId: PlayerId, laneIndex: number) {
  const lane = state.players[playerId].lanes[laneIndex];
  const creature = lane.creature;
  if (!creature) return 0;
  const definition = creature.card.definition;
  let value = cardVictoryLevel(state, creature) * 2.4 + definition.printedLevel * 1.3 + 1.2;
  if (definition.tags.includes("Apex Predator")) value += 0.8;
  if (definition.tags.includes("Ambush")) value += 0.55;
  if (definition.tags.includes("Bruiser")) value += 0.45;
  if (definition.tags.includes("Charge")) value += 0.55;
  if (definition.tags.includes("Cranial Display")) value += 0.45;
  if (definition.tags.includes("Elusive")) value += 0.4;
  if (definition.tags.includes("Resourceful")) value += 0.75;
  if (definition.tags.includes("Raptorial")) value += 0.45;
  if (definition.tags.includes("Saboteur")) value += 0.35;
  if (definition.tags.includes("Shell")) value += 0.4;
  if (lane.attachment) value += lane.attachment.definition.key === "autotomy" ? 1.1 : 0.8;
  return value;
}

function knownHandCardValue(state: GameState, playerId: PlayerId, card: CardInstance) {
  const definition = card.definition;
  if (definition.kind === "creature") {
    const legalNow = legalCreatureLanes(state, playerId, card).length > 0;
    let value = 1.4 + definition.printedLevel * 0.75 + (legalNow ? 1.4 : 0);
    if (definition.tags.includes("Apex Predator")) value += 0.8;
    if (definition.tags.includes("Resourceful")) value += 0.55;
    if (definition.tags.includes("Propulsion")) value += 0.45;
    return value;
  }
  if (definition.kind === "adaptation") return 1.35;
  if (definition.kind === "event") return definition.key === "wildfire" ? 2.2 : 1.6;
  return 1.55;
}

function eventValue(state: GameState, playerId: PlayerId) {
  const event = state.players[playerId].event?.definition;
  if (!event) return 0;
  if (event.key === "superpredators") return 2.1;
  if (event.key === "cambrian-explosion") {
    return 1.1 + state.players[playerId].lanes.filter((lane) => lane.creature?.card.definition.printedLevel === 0).length * 0.55;
  }
  if (event.key === "carnian-pluvial-episode") return 1.8;
  return 1;
}

function publicEvaluation(state: GameState, playerId: PlayerId, style: Style) {
  if (state.winner !== null) return state.winner === playerId ? 10000 : -10000;
  const opponent = otherPlayer(playerId);
  const totals = victoryTotals(state);
  const ownBoard = state.players[playerId].lanes.reduce(
    (sum, _lane, index) => sum + publicCreatureValue(state, playerId, index),
    0,
  );
  const opposingBoard = state.players[opponent].lanes.reduce(
    (sum, _lane, index) => sum + publicCreatureValue(state, opponent, index),
    0,
  );
  const handPotential = state.players[playerId].hand.reduce(
    (sum, card) => sum + knownHandCardValue(state, playerId, card),
    0,
  );
  const victoryWeight = style === "development" ? 6.2 : 5.3;
  const boardWeight = style === "development" ? 1.05 : 1.18;
  let value = (totals[playerId] - totals[opponent]) * victoryWeight;
  value += (ownBoard - opposingBoard) * boardWeight;
  value += handPotential * (style === "development" ? 0.23 : 0.16);
  value -= state.players[opponent].hand.length * 0.08;
  value += eventValue(state, playerId) - eventValue(state, opponent) * 0.75;
  if (state.players[playerId].allowances.skipBattlePhase) value -= style === "pressure" ? 1.5 : 0.8;
  return value;
}

function binomialProbability(trials: number, successes: number) {
  if (trials === 0) return successes === 0 ? 1 : 0;
  let combinations = 1;
  for (let index = 1; index <= successes; index += 1) {
    combinations = combinations * (trials - successes + index) / index;
  }
  return combinations * (0.5 ** trials);
}

function battleDecisionScore(state: GameState, playerId: PlayerId, style: Style) {
  const pending = state.pendingBattle;
  if (!pending) return -Infinity;
  const attacker = findCreature(state, pending.attackerUid);
  const defender = findCreature(state, pending.defenderUid);
  if (!attacker || !defender) return -Infinity;
  const attackerValue = publicCreatureValue(state, attacker.playerId, attacker.laneIndex);
  const defenderValue = publicCreatureValue(state, defender.playerId, defender.laneIndex);
  const plan = battleCoinPlan(state);
  const forcedTieProbability = plan.defensiveCount ? 1 - (0.5 ** plan.defensiveCount) : 0;
  const attackerDefinition = attacker.creature.card.definition;
  let tieValue = -0.15;
  if (attackerDefinition.tags.includes("Raptorial")) tieValue += 0.85;
  if (attackerDefinition.tags.includes("Saboteur")) tieValue += 0.65;

  let winProbability = 0;
  let lossProbability = 0;
  let naturalTieProbability = 0;
  for (let successes = 0; successes <= plan.offensiveCount; successes += 1) {
    const probability = binomialProbability(plan.offensiveCount, successes) * (1 - forcedTieProbability);
    const attackLevel = pending.attackerLevel + successes;
    if (attackLevel > pending.defenderLevel) winProbability += probability;
    else if (attackLevel < pending.defenderLevel) lossProbability += probability;
    else naturalTieProbability += probability;
  }
  const totalTieProbability = naturalTieProbability + forcedTieProbability;
  const attackerHasAutotomy = attacker.lane.attachment?.definition.key === "autotomy";
  const defenderShell = pending.defenderNotes.some((note) => note.startsWith("Shell"));
  const effectiveLoss = lossProbability * (attackerHasAutotomy || defenderShell ? 0.32 : 1);
  let score = winProbability * defenderValue * (style === "pressure" ? 1.08 : 0.92);
  score -= effectiveLoss * attackerValue;
  score += totalTieProbability * tieValue;
  return score;
}

function battleStateFor(state: GameState) {
  const copy = structuredClone(state);
  copy.phase = "battle";
  return copy;
}

function hasConvergentRoute(state: GameState, playerId: PlayerId) {
  const enabled = structuredClone(state);
  enabled.players[playerId].allowances.convergentEvolution = true;
  const player = enabled.players[playerId];
  return player.hand.some((card) => {
    if (card.definition.kind !== "creature") return false;
    return player.lanes.some((lane, laneIndex) => {
      if (!lane.creature) return false;
      const normalState = structuredClone(state);
      normalState.players[playerId].allowances.convergentEvolution = false;
      const normal = checkOverride(normalState, playerId, card.definition as CreatureCard, laneIndex);
      const convergent = checkOverride(enabled, playerId, card.definition as CreatureCard, laneIndex);
      return !normal.legal && convergent.legal && convergent.convergentOptions.length > 0;
    });
  });
}

function conceptPrior(state: GameState, playerId: PlayerId, card: CardInstance, style: Style) {
  const key = card.definition.key;
  const player = state.players[playerId];
  const filled = boardCount(state, playerId);
  if (key === "convergent-evolution") return hasConvergentRoute(state, playerId) ? 2.5 : -20;
  if (key === "rapid-speciation") return 3.1;
  if (key === "biogenesis") return filled > 0 ? filled * 0.95 - 0.35 : -20;
  if (key === "evolutionary-radiation") return filled <= 2 ? 2.8 : 1.1;
  if (key === "whale-fall") return player.hand.length <= 5 ? 1.35 : 0.35;
  if (key === "natural-selection") return 1.15;
  if (key === "genetic-drift") {
    const legalCreature = player.hand.some(
      (held) => held.definition.kind === "creature" && legalCreatureLanes(state, playerId, held).length,
    );
    return !legalCreature || player.hand.length <= 3 ? 1.8 : -0.5;
  }
  if (key === "dig-site-excavation") return player.history.length > 2 ? 1.2 : 0.25;
  if (key === "semelparity") return filled === 0 ? 0.3 : 1.15;
  if (key === "obligate-migration") return style === "pressure" ? 0.45 : 0.15;
  if (key === "abiogenesis") {
    const hasLevel0 = player.hand.some(
      (held) => held.definition.kind === "creature" && held.definition.printedLevel === 0,
    );
    return !hasLevel0 || filled === 0 ? 2.1 : 0.55;
  }
  return 0.5;
}

function eventPrior(state: GameState, playerId: PlayerId, card: CardInstance) {
  const key = card.definition.key;
  const opponent = otherPlayer(playerId);
  if (key === "superpredators") {
    return boardCount(state, playerId) > 0 && boardCount(state, opponent) > 0 ? 1.8 : 0.25;
  }
  if (key === "cambrian-explosion") {
    const ownLevel0 = state.players[playerId].lanes.filter((lane) => lane.creature?.card.definition.printedLevel === 0).length;
    const opposingLevel0 = state.players[opponent].lanes.filter((lane) => lane.creature?.card.definition.printedLevel === 0).length;
    return ownLevel0 * 1.05 - opposingLevel0 * 0.7;
  }
  if (key === "carnian-pluvial-episode") {
    const hasCost = state.players[playerId].lanes.some(
      (lane) => lane.creature && !lane.creature.card.definition.taxa.includes("Dinosaur"),
    );
    return hasCost ? 1.65 : 0.35;
  }
  return 0.35;
}

function developmentActions(state: GameState, style: Style): Action[] {
  const playerId = state.activePlayer;
  const player = state.players[playerId];
  const opponent = otherPlayer(playerId);
  const actions: Action[] = [];

  for (const sourceLane of legalFacultativeSources(state)) {
    for (const destinationLane of legalFacultativeDestinations(state, sourceLane)) {
      const creatureName = player.lanes[sourceLane].creature?.card.definition.name ?? "Creature";
      actions.push({
        kind: "movement",
        label: `Move ${creatureName} from Niche ${sourceLane + 1} to Niche ${destinationLane + 1}`,
        prior: 0.2,
        apply: (current) => moveFacultativeQuadrupedality(current, sourceLane, destinationLane),
      });
    }
  }

  for (const card of player.hand) {
    if (card.definition.kind === "creature") {
      for (const laneIndex of legalCreatureLanes(state, playerId, card)) {
        const occupied = Boolean(player.lanes[laneIndex].creature);
        actions.push({
          kind: "creature",
          label: `${occupied ? "Override" : "Fill"} ${card.definition.name} in Niche ${laneIndex + 1}`,
          cardKey: card.definition.key,
          prior: occupied ? 1.45 : 1.15,
          apply: (current) => playCreature(current, playerId, card.uid, laneIndex),
        });
      }
      continue;
    }

    if (card.definition.kind === "adaptation") {
      for (const target of legalAdaptationTargets(state, card)) {
        actions.push({
          kind: "adaptation",
          label: `Attach ${card.definition.name} to ${state.players[target.playerId].name}'s Niche ${target.laneIndex + 1}`,
          cardKey: card.definition.key,
          prior: 0.7,
          apply: (current) => playAdaptation(current, card.uid, target.laneIndex, target.playerId),
        });
      }
      continue;
    }

    if (card.definition.kind === "event" && card.definition.key === "drought") {
      for (const target of legalDroughtTargets(state, card)) {
        const targetValue = publicCreatureValue(state, target.playerId, target.laneIndex);
        const facingPlayer = otherPlayer(target.playerId);
        const facingValue = publicCreatureValue(state, facingPlayer, target.laneIndex);
        const removalValue = target.playerId === playerId ? -targetValue : targetValue;
        const suppressionValue = facingPlayer === playerId ? -facingValue * 0.3 : facingValue * 0.3;
        actions.push({
          kind: "event",
          label: `Play Drought in ${state.players[target.playerId].name}'s Niche ${target.laneIndex + 1}`,
          cardKey: card.definition.key,
          prior: 0.35 + removalValue * 0.55 + suppressionValue,
          apply: (current) => playDrought(current, card.uid, target.playerId, target.laneIndex),
        });
      }
      continue;
    }

    if (card.definition.kind === "event" && card.definition.key === "wildfire") {
      for (const laneIndex of legalWildfireLanes(state, card)) {
        const ownValue = publicCreatureValue(state, playerId, laneIndex);
        const opposingValue = publicCreatureValue(state, opponent, laneIndex);
        actions.push({
          kind: "event",
          label: `Play Wildfire in Niche ${laneIndex + 1}`,
          cardKey: card.definition.key,
          prior: 0.4 + opposingValue * 0.65 - ownValue * 0.58,
          apply: (current) => playWildfire(current, card.uid, laneIndex),
        });
      }
      continue;
    }

    if (card.definition.kind === "event" && canPlayEvent(state, card)) {
      actions.push({
        kind: "event",
        label: `Play ${card.definition.name}`,
        cardKey: card.definition.key,
        prior: eventPrior(state, playerId, card),
        apply: (current) => playEvent(current, card.uid),
      });
      continue;
    }

    if (card.definition.kind === "concept" && canPlayConcept(state, card)) {
      actions.push({
        kind: "concept",
        label: `Play ${card.definition.name}`,
        cardKey: card.definition.key,
        prior: conceptPrior(state, playerId, card, style),
        apply: (current) => playConcept(current, card.uid),
      });
    }
  }

  if (canActivateCarnianPluvialEpisode(state)) {
    actions.push({
      kind: "event-activation",
      label: "Activate Carnian Pluvial Episode",
      prior: 1.1,
      apply: activateCarnianPluvialEpisode,
    });
  }

  if (
    player.hand.length === 10 &&
    !player.fullHandMulliganUsed &&
    player.allowances.developmentActions === 0
  ) {
    actions.push({
      kind: "mulligan",
      label: "Use Full-Hand Mulligan",
      prior: 4,
      apply: performFullHandMulligan,
    });
  }

  return actions;
}

function simulateAction(state: GameState, action: Action, engineRng: Rng) {
  const before = engineRng.snapshot();
  const next = action.apply(state);
  const after = engineRng.snapshot();
  engineRng.restore(before);
  return { next, after };
}

function chooseDevelopmentAction(
  state: GameState,
  style: Style,
  engineRng: Rng,
  policyRng: Rng,
  forceStateChange = false,
) {
  const playerId = state.activePlayer;
  const base = publicEvaluation(state, playerId, style);
  const forced = state.players[playerId].allowances.rapidSpeciation ||
    state.players[playerId].allowances.convergentEvolution;
  const actions = developmentActions(state, style);
  const mulligan = actions.find((action) => action.kind === "mulligan");
  let chosen: { action: Action; next: GameState; after: number; score: number } | null = null;
  for (const action of actions.filter((action) => action.kind !== "mulligan")) {
    const simulation = simulateAction(state, action, engineRng);
    const jitter = (policyRng.next() - 0.5) * (style === "pressure" ? 0.34 : 0.22);
    const score = publicEvaluation(simulation.next, playerId, style) - base + action.prior + jitter;
    if (!chosen || score > chosen.score) chosen = { action, ...simulation, score };
  }
  const threshold = forced || forceStateChange ? -Infinity : style === "pressure" ? 0.3 : 0.42;
  if ((!chosen || chosen.score < threshold) && mulligan) {
    const simulation = simulateAction(state, mulligan, engineRng);
    engineRng.restore(simulation.after);
    return { action: mulligan, ...simulation, score: Infinity };
  }
  if (!chosen || chosen.score < threshold) return null;
  engineRng.restore(chosen.after);
  return chosen;
}

function pendingOptionActions(state: GameState): Action[] {
  if (state.pendingHerd) {
    return getHerdOptions(state).map((option) => ({
      kind: "herd-choice",
      label: option.label,
      prior: option.id === "__decline-herd__" ? -0.2 : 0.35,
      apply: (current) => chooseHerd(current, option.id),
    }));
  }
  if (state.pendingNesting) {
    return getNestingOptions(state).map((option) => ({
      kind: "nesting-choice",
      label: option.label,
      prior: option.id === "__decline-nesting__" ? 0 : 0.3,
      apply: (current) => chooseNesting(current, option.id),
    }));
  }
  if (state.pendingFilterFeeder) {
    const player = state.players[state.pendingFilterFeeder.playerId];
    return state.pendingFilterFeeder.cardUids.map((uid) => ({
      kind: "filter-feeder-choice",
      label: `Keep ${player.deck.find((card) => card.uid === uid)?.definition.name ?? "card"} on top`,
      prior: 0,
      apply: (current) => chooseFilterFeederTop(current, uid),
    }));
  }
  if (state.pendingGeologicalBoundary) {
    return geologicalBoundaryOptions(state).map((period) => ({
      kind: "geological-boundary-choice",
      label: `Declare ${period}`,
      prior: 0,
      apply: (current) => chooseGeologicalBoundaryPeriod(current, period),
    }));
  }
  if (state.pendingEngulf) {
    return [
      {
        kind: "engulf-choice",
        label: "Engulf defeated Creature",
        prior: 0.3,
        apply: (current: GameState) => chooseEngulf(current, true),
      },
      {
        kind: "engulf-choice",
        label: "Send defeated Creature to History",
        prior: 0,
        apply: (current: GameState) => chooseEngulf(current, false),
      },
    ];
  }
  if (state.pendingCarnianPluvial) {
    return getCarnianPluvialOptions(state).map((option) => ({
      kind: "carnian-choice",
      label: option.label,
      prior: 0,
      apply: (current) => chooseCarnianPluvialOption(current, option.id),
    }));
  }
  if (state.pendingConceptChoice) {
    return getConceptChoiceOptions(state).map((option) => ({
      kind: "concept-choice",
      label: option.label,
      prior: state.pendingConceptChoice?.kind === "semelparity-replacement-lane" && option.id === "__decline-semelparity__"
        ? -20
        : option.id.startsWith("__finish") || option.id.startsWith("__decline")
          ? 0.25
          : 0,
      apply: (current) => chooseConceptOption(current, option.id),
    }));
  }
  return [];
}

function futurePendingScore(
  state: GameState,
  playerId: PlayerId,
  style: Style,
  engineRng: Rng,
  depth: number,
): number {
  if (depth <= 0 || (
    !state.pendingConceptChoice &&
    !state.pendingCarnianPluvial &&
    !state.pendingHerd &&
    !state.pendingNesting &&
    !state.pendingFilterFeeder &&
    !state.pendingGeologicalBoundary &&
    !state.pendingEngulf
  )) {
    return publicEvaluation(state, playerId, style);
  }
  const options = pendingOptionActions(state);
  if (!options.length) return publicEvaluation(state, playerId, style) - 20;
  const root = engineRng.snapshot();
  let best = -Infinity;
  for (const option of options) {
    engineRng.restore(root);
    const next = option.apply(state);
    const score = futurePendingScore(next, playerId, style, engineRng, depth - 1) + option.prior;
    best = Math.max(best, score);
  }
  engineRng.restore(root);
  return best;
}

function choosePendingOption(
  state: GameState,
  style: Style,
  engineRng: Rng,
  policyRng: Rng,
) {
  const playerId = state.activePlayer;
  let chosen: { action: Action; next: GameState; after: number; score: number } | null = null;
  for (const action of pendingOptionActions(state)) {
    const before = engineRng.snapshot();
    const next = action.apply(state);
    const after = engineRng.snapshot();
    const score = futurePendingScore(next, playerId, style, engineRng, 3) + action.prior + (policyRng.next() - 0.5) * 0.12;
    engineRng.restore(before);
    if (!chosen || score > chosen.score) chosen = { action, next, after, score };
  }
  if (!chosen) return null;
  engineRng.restore(chosen.after);
  return chosen;
}

function chooseConvergentOption(state: GameState, style: Style, policyRng: Rng) {
  const pending = state.pendingConvergentChoice;
  if (!pending) return null;
  let chosen: { category: "diet" | "period" | "taxon"; next: GameState; score: number } | null = null;
  for (const category of pending.categories) {
    const next = chooseConvergentCategory(state, category);
    const score = publicEvaluation(next, pending.playerId, style) + (policyRng.next() - 0.5) * 0.1;
    if (!chosen || score > chosen.score) chosen = { category, next, score };
  }
  return chosen;
}

function chooseCranialTarget(state: GameState) {
  const pending = state.pendingCranialDisplay;
  if (!pending) return null;
  return pending.eligibleTargetUids
    .map((uid) => findCreature(state, uid))
    .filter((entry): entry is NonNullable<ReturnType<typeof findCreature>> => Boolean(entry))
    .sort((a, b) => publicCreatureValue(state, b.playerId, b.laneIndex) - publicCreatureValue(state, a.playerId, a.laneIndex))[0] ?? null;
}

function chooseHunt(state: GameState, style: Style, policyRng: Rng) {
  const playerId = state.activePlayer;
  let chosen: { next: GameState; score: number; label: string } | null = null;
  for (const lane of state.players[playerId].lanes) {
    const attacker = lane.creature;
    if (!attacker) continue;
    for (const targetUid of legalAttackTargets(state, attacker.card.uid)) {
      const next = previewBattle(state, attacker.card.uid, targetUid);
      const target = findCreature(state, targetUid);
      const score = battleDecisionScore(next, playerId, style) + (policyRng.next() - 0.5) * 0.18;
      const label = `${attacker.card.definition.name} Hunts ${target?.creature.card.definition.name ?? "target"}`;
      if (!chosen || score > chosen.score) chosen = { next, score, label };
    }
  }
  const threshold = style === "pressure" ? 0.05 : 0.32;
  return chosen && chosen.score >= threshold ? chosen : null;
}

function thresholdOutcome(attackerLevel: number, defenderLevel: number, forcedTie: boolean) {
  if (forcedTie || attackerLevel === defenderLevel) return "tie";
  return attackerLevel > defenderLevel ? "defender defeated" : "attacker defeated";
}

function resolveBattle(state: GameState, telemetry: Telemetry, engineRng: Rng) {
  const pending = state.pendingBattle!;
  const plan = battleCoinPlan(state);
  const results: BattleCoinResults = {
    offensive: Array.from({ length: plan.offensiveCount }, () => engineRng.next() < 0.5),
    defensive: Array.from({ length: plan.defensiveCount }, () => engineRng.next() < 0.5),
  };
  const attacker = findCreature(state, pending.attackerUid)!;
  const defender = findCreature(state, pending.defenderUid)!;
  const attackerDefinition = attacker.creature.card.definition;
  const defenderDefinition = defender.creature.card.definition;
  const offensiveBonus = results.offensive?.filter(Boolean).length ?? 0;
  const forcedTie = results.defensive?.some(Boolean) ?? false;
  const actualAttackerLevel = pending.attackerLevel + offensiveBonus;
  const currentThreshold = thresholdOutcome(actualAttackerLevel, pending.defenderLevel, forcedTie);

  const qualifiesAsGiganticDefense = effectiveHasTag(defenderDefinition, "Gigantic");
  if (qualifiesAsGiganticDefense) {
    const attackerGigantic = effectiveHasTag(attackerDefinition, "Gigantic");
    const attackerBruiser = attackerDefinition.tags.includes("Bruiser");
    telemetry.giganticBattles.push({
      turn: state.turnNumber,
      attacker: attackerDefinition.name,
      defender: defenderDefinition.name,
      attackerTags: [...attackerDefinition.tags],
      currentThreshold,
      giganticOnlyExceptionThreshold: thresholdOutcome(
        actualAttackerLevel,
        pending.defenderLevel + (attackerGigantic ? 0 : 1),
        forcedTie,
      ),
      giganticOrBruiserExceptionThreshold: thresholdOutcome(
        actualAttackerLevel,
        pending.defenderLevel + (attackerGigantic || attackerBruiser ? 0 : 1),
        forcedTie,
      ),
      actualResult: "pending",
    });
  }

  telemetry.battles += 1;
  const beforeAttacker = pending.attackerUid;
  const beforeDefender = pending.defenderUid;
  const next = commitBattle(state, results);
  const attackerAlive = Boolean(findCreature(next, beforeAttacker));
  const defenderAlive = Boolean(findCreature(next, beforeDefender));
  let actualResult = "both survived";
  if (!attackerAlive && defenderAlive) actualResult = "attacker destroyed";
  if (attackerAlive && !defenderAlive) actualResult = "defender destroyed";
  if (!attackerAlive || !defenderAlive) telemetry.creaturesDestroyed += 1;
  else telemetry.ties += 1;
  if (qualifiesAsGiganticDefense) telemetry.giganticBattles.at(-1)!.actualResult = actualResult;
  return next;
}

function generalistOnlyRoutes(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId];
  const convergent = player.hand.find((card) => card.definition.key === "convergent-evolution");
  if (!convergent || convergent.definition.kind !== "concept") return [] as GeneralistWindow[];
  const options: GeneralistWindow[] = [];
  const stateWithoutConvergent = structuredClone(state);
  stateWithoutConvergent.players[playerId].allowances.convergentEvolution = false;
  const excluded = new Set(["Apex Predator", "Generalist", "Living Fossil", "Transitional"]);
  for (const card of player.hand) {
    if (card.definition.kind !== "creature") continue;
    const incomingTags = effectiveTags(card.definition);
    for (let laneIndex = 0; laneIndex < player.lanes.length; laneIndex += 1) {
      const occupant = player.lanes[laneIndex].creature?.card.definition;
      if (!occupant) continue;
      const occupantTags = effectiveTags(occupant);
      if (!incomingTags.has("Generalist") || !occupantTags.has("Generalist")) continue;
      const sharesAnotherEligibleTag = [...incomingTags].some(
        (tag) => tag !== "Generalist" && occupantTags.has(tag) && !excluded.has(tag),
      );
      if (sharesAnotherEligibleTag) continue;
      const result = checkOverride(stateWithoutConvergent, playerId, card.definition, laneIndex);
      const nonTagMatches = [result.matches.diet, result.matches.period, result.matches.taxon].filter(Boolean).length;
      if (result.levelLegal && !result.legal && result.matches.tag && result.matchCount === 2 && nonTagMatches >= 1) {
        options.push({
          turn: state.turnNumber,
          player: playerId,
          incoming: card.definition.name,
          occupant: occupant.name,
          lane: laneIndex + 1,
        });
      }
    }
  }
  return options;
}

function inspectCounterfactuals(
  state: GameState,
  telemetry: Telemetry,
  seen: { turns: Set<string>; alt: Set<string>; abiogenesis: Set<string>; generalist: Set<string> },
) {
  if (state.winner !== null) return;
  const totals = victoryTotals(state);
  if (state.turnNumber > 25) {
    for (const winner of [0, 1] as PlayerId[]) {
      const opponent = otherPlayer(winner);
      if (totals[winner] >= 10 && boardCount(state, opponent) === 0) {
        const key = String(winner);
        if (!seen.alt.has(key)) {
          seen.alt.add(key);
          telemetry.altWinWindows.push({
            turn: state.turnNumber,
            winner,
            victory: totals[winner],
            opponentVictory: totals[opponent],
          });
        }
      }
    }
  }

  if (state.phase !== "development" || state.handoff || state.pendingConceptChoice || state.pendingCarnianPluvial ||
    state.pendingHerd || state.pendingNesting || state.pendingFilterFeeder || state.pendingGeologicalBoundary || state.pendingEngulf ||
    state.pendingConvergentChoice || state.pendingCranialDisplay || state.pendingBattle) return;

  const playerId = state.activePlayer;
  const player = state.players[playerId];
  const opponent = otherPlayer(playerId);
  const turnKey = `${state.turnNumber}:${playerId}`;
  if (!seen.turns.has(turnKey)) {
    seen.turns.add(turnKey);
    telemetry.maximumHandSize = Math.max(telemetry.maximumHandSize, player.hand.length);
    if (boardCount(state, playerId) === 0) telemetry.turnStartsWithEmptyBoard += 1;
    const creatureOptions = player.hand.flatMap((card) =>
      card.definition.kind === "creature" ? legalCreatureLanes(state, playerId, card) : [],
    );
    if (!creatureOptions.length) telemetry.turnStartsWithoutCreaturePlay += 1;
  }

  const abiogenesis = player.hand.find((card) => card.definition.key === "abiogenesis");
  const level0s = player.hand.filter(
    (card) => card.definition.kind === "creature" && card.definition.printedLevel === 0,
  );
  const emptyLaneExists = player.lanes.some((lane, laneIndex) => !lane.creature && !laneIsLocked(state, laneIndex));
  const conceptAllowance = player.lanes.some((lane) => lane.creature?.card.definition.tags.includes("Resourceful")) ? 2 : 1;
  const conceptSlotAvailable = player.allowances.conceptsPlayed < conceptAllowance &&
    !player.allowances.convergentEvolution && !player.allowances.rapidSpeciation;
  if (abiogenesis && level0s.length && emptyLaneExists && conceptSlotAvailable) {
    const key = `${state.turnNumber}:${playerId}:${player.allowances.creaturePlayed}:${player.allowances.developmentActions}:${boardCount(state, playerId)}:${player.hand.length}`;
    if (!seen.abiogenesis.has(key)) {
      seen.abiogenesis.add(key);
      const bestLevel0 = [...level0s].sort(
        (a, b) => knownHandCardValue(state, playerId, b) - knownHandCardValue(state, playerId, a),
      )[0];
      const normalCreaturePlayAvailable = player.hand.some(
        (card) => card.uid !== bestLevel0.uid && card.definition.kind === "creature" && legalCreatureLanes(state, playerId, card).length > 0,
      );
      const legalHuntAvailable = hasLegalHunts(state, playerId);
      const catchupNeeded = totals[playerId] + 2 < totals[opponent] ||
        boardCount(state, playerId) + 1 < boardCount(state, opponent);
      const createsExtraTempo = player.allowances.creaturePlayed || normalCreaturePlayAvailable;
      const wouldUsePlacementMode = createsExtraTempo && (!legalHuntAvailable || catchupNeeded);
      telemetry.abiogenesisWindows.push({
        turn: state.turnNumber,
        player: playerId,
        bestLevel0: bestLevel0.definition.name,
        ownCreatures: boardCount(state, playerId),
        opposingCreatures: boardCount(state, opponent),
        victory: totals[playerId],
        opposingVictory: totals[opponent],
        normalCreaturePlayAvailable,
        creaturePlayAlreadyUsed: player.allowances.creaturePlayed,
        legalHuntAvailable,
        wouldUsePlacementMode,
      });
    }
  }

  for (const route of generalistOnlyRoutes(state, playerId)) {
    const key = `${route.turn}:${route.player}:${route.incoming}:${route.occupant}:${route.lane}`;
    if (!seen.generalist.has(key)) {
      seen.generalist.add(key);
      telemetry.generalistWindows.push(route);
    }
  }
}

function stableTurnSignature(state: GameState) {
  return JSON.stringify({
    activePlayer: state.activePlayer,
    players: state.players.map((player) => ({
      deck: player.deck.map((card) => card.uid),
      hand: player.hand.map((card) => card.uid).sort(),
      history: player.history.map((card) => card.uid).sort(),
      event: player.event?.uid ?? null,
      lanes: player.lanes.map((lane) => ({
        creature: lane.creature?.card.uid ?? null,
        attachment: lane.attachment?.uid ?? null,
        engulfed: lane.engulfed?.uid ?? null,
        wildfire: lane.wildfire?.card.uid ?? null,
        drought: lane.drought?.card.uid ?? null,
      })),
      returnQueue: [...player.returnQueue].sort(),
      fullHandMulliganUsed: player.fullHandMulliganUsed,
    })),
    periodAuras: state.periodAuras,
  });
}

function recordAction(telemetry: Telemetry, state: GameState, label: string, cardKey?: string) {
  telemetry.actions.push({ turn: state.turnNumber, player: state.activePlayer, label });
  if (cardKey) telemetry.cardPlays[cardKey] = (telemetry.cardPlays[cardKey] ?? 0) + 1;
}

function runGame(gameNumber: number, seed: number, styles: [Style, Style], decks: [DeckKey, DeckKey]): Telemetry {
  const engineRng = new Rng(seed);
  const policyRng: [Rng, Rng] = [new Rng(seed ^ 0xa511e9b3), new Rng(seed ^ 0x63d83595)];
  const originalRandom = Math.random;
  Math.random = () => engineRng.next();
  let state = createGame("Seat 1", "Seat 2", [null, null], decks);
  const telemetry: Telemetry = {
    game: gameNumber,
    seed,
    styles,
    decks,
    firstPlayer: state.activePlayer,
    actions: [],
    cardPlays: {},
    battles: 0,
    creaturesDestroyed: 0,
    ties: 0,
    noDevelopmentTurns: 0,
    noLegalHuntTurns: 0,
    turnStartsWithoutCreaturePlay: 0,
    turnStartsWithEmptyBoard: 0,
    maximumHandSize: Math.max(state.players[0].hand.length, state.players[1].hand.length),
    giganticBattles: [],
    altWinWindows: [],
    abiogenesisWindows: [],
    generalistWindows: [],
    naturalFinish: false,
    termination: "limit",
    deadlockReason: null,
    winner: null,
    winReason: null,
    finalTurn: 0,
    finalVictory: [0, 0],
    finalBoard: [0, 0],
    finalHands: [[], []],
    finalDeckSizes: [0, 0],
    finalBoardNames: [[], []],
    finalLegalHunts: [],
  };
  const seen = {
    turns: new Set<string>(),
    alt: new Set<string>(),
    abiogenesis: new Set<string>(),
    generalist: new Set<string>(),
  };
  const stableTurnCounts = new Map<string, number>();
  let deadlockDetected = false;

  try {
    for (let steps = 0; steps < 6000 && state.winner === null && state.turnNumber <= 140; steps += 1) {
      inspectCounterfactuals(state, telemetry, seen);
      const style = styles[state.activePlayer];
      const seatRng = policyRng[state.activePlayer];
      let forceDevelopmentAction = false;

      if (
        state.phase === "development" &&
        !state.handoff &&
        !state.pendingBattle &&
        !state.pendingCranialDisplay &&
        !state.pendingConvergentChoice &&
        !state.pendingConceptChoice &&
        !state.pendingCarnianPluvial &&
        !state.pendingHerd &&
        !state.pendingNesting &&
        !state.pendingFilterFeeder &&
        !state.pendingGeologicalBoundary &&
        !state.pendingEngulf &&
        state.players[state.activePlayer].allowances.developmentActions === 0
      ) {
        const signature = stableTurnSignature(state);
        const count = (stableTurnCounts.get(signature) ?? 0) + 1;
        stableTurnCounts.set(signature, count);
        if (count >= 3) {
          const legalDevelopment = developmentActions(state, style);
          const policySnapshot = seatRng.snapshot();
          const rationalHunt = chooseHunt(state, style, seatRng);
          seatRng.restore(policySnapshot);
          if (!legalDevelopment.length && !rationalHunt) {
            deadlockDetected = true;
            break;
          }
          forceDevelopmentAction = legalDevelopment.length > 0;
        }
      }

      if (state.handoff) {
        state = acknowledgeHandoff(state);
        continue;
      }
      if (state.pendingBattle) {
        state = resolveBattle(state, telemetry, engineRng);
        continue;
      }
      if (state.pendingCranialDisplay) {
        const target = chooseCranialTarget(state);
        if (!target) throw new Error("Cranial Display had no resolvable target.");
        state = chooseCranialDisplayTarget(state, target.creature.card.uid);
        continue;
      }
      if (state.pendingConvergentChoice) {
        const choice = chooseConvergentOption(state, style, seatRng);
        if (!choice) throw new Error("Convergent Evolution had no resolvable category.");
        state = choice.next;
        continue;
      }
      if (
        state.pendingConceptChoice ||
        state.pendingCarnianPluvial ||
        state.pendingHerd ||
        state.pendingNesting ||
        state.pendingFilterFeeder ||
        state.pendingGeologicalBoundary ||
        state.pendingEngulf
      ) {
        const choice = choosePendingOption(state, style, engineRng, seatRng);
        if (!choice) throw new Error("A mandatory card choice had no option.");
        state = choice.next;
        continue;
      }
      if (state.phase === "development") {
        const choice = chooseDevelopmentAction(state, style, engineRng, seatRng, forceDevelopmentAction);
        if (choice) {
          recordAction(telemetry, state, choice.action.label, choice.action.cardKey);
          state = choice.next;
          continue;
        }
        if (state.players[state.activePlayer].allowances.developmentActions === 0) telemetry.noDevelopmentTurns += 1;
        const hadHunt = hasLegalHunts(state, state.activePlayer);
        state = advanceToBattleOrEndTurn(state);
        if (!hadHunt) telemetry.noLegalHuntTurns += 1;
        continue;
      }
      if (state.phase === "battle") {
        const hunt = chooseHunt(state, style, seatRng);
        if (hunt) {
          recordAction(telemetry, state, hunt.label);
          state = hunt.next;
        } else {
          state = endTurn(state);
        }
        continue;
      }
      throw new Error(`Unhandled game state at turn ${state.turnNumber}.`);
    }
  } finally {
    Math.random = originalRandom;
  }

  telemetry.naturalFinish = state.winner !== null;
  telemetry.termination = state.winner !== null ? "win" : deadlockDetected ? "deadlock" : "limit";
  telemetry.winner = state.winner;
  telemetry.winReason = state.winReason;
  telemetry.finalTurn = state.turnNumber;
  telemetry.finalVictory = victoryTotals(state);
  telemetry.finalBoard = [boardCount(state, 0), boardCount(state, 1)];
  telemetry.finalHands = state.players.map((player) => player.hand.map((card) => card.definition.name)) as [string[], string[]];
  telemetry.finalDeckSizes = state.players.map((player) => player.deck.length) as [number, number];
  telemetry.finalBoardNames = state.players.map((player) =>
    player.lanes.flatMap((lane) => lane.creature ? [lane.creature.card.definition.name] : []),
  ) as [string[], string[]];
  if (state.winner === null) {
    const battleState = battleStateFor(state);
    battleState.handoff = null;
    battleState.pendingBattle = null;
    battleState.pendingConceptChoice = null;
    battleState.pendingCarnianPluvial = null;
    battleState.pendingFilterFeeder = null;
    battleState.pendingGeologicalBoundary = null;
    battleState.pendingEngulf = null;
    battleState.pendingConvergentChoice = null;
    battleState.pendingCranialDisplay = null;
    for (const playerId of [0, 1] as PlayerId[]) {
      battleState.activePlayer = playerId;
      for (const lane of battleState.players[playerId].lanes) {
        if (!lane.creature) continue;
        for (const targetUid of legalAttackTargets(battleState, lane.creature.card.uid)) {
          const target = findCreature(battleState, targetUid);
          telemetry.finalLegalHunts.push({
            attacker: lane.creature.card.definition.name,
            defender: target?.creature.card.definition.name ?? "Unknown",
          });
        }
      }
    }
  }
  if (deadlockDetected) {
    telemetry.deadlockReason = telemetry.finalLegalHunts.length
      ? "The complete public state repeated for three rounds; remaining legal Hunts did not produce a rational state-changing line."
      : "The complete public state repeated for three rounds with no legal Hunt or state-changing Development line."
  }
  return telemetry;
}

function aggregate(games: Telemetry[], includeActions: boolean) {
  const cardPlays: Record<string, number> = {};
  for (const game of games) {
    for (const [key, value] of Object.entries(game.cardPlays)) cardPlays[key] = (cardPlays[key] ?? 0) + value;
  }
  const giganticBattles = games.flatMap((game) => game.giganticBattles);
  const altWinWindows = games.flatMap((game) => game.altWinWindows);
  const abiogenesisWindows = games.flatMap((game) => game.abiogenesisWindows);
  const generalistWindows = games.flatMap((game) => game.generalistWindows);
  return {
    protocol: {
      games: games.length,
      hiddenInformation: "Each seat's policy ranked actions using only its own hand identities, both public boards, public Events and Adaptations, public zone counts, and revealed rules. Opposing hand identities were never supplied to action ranking.",
      controller: "Two human-style one-step heuristic policies: pressure and development. Decisions use public combat projections but no future draws, coin results, or opposing hand knowledge.",
      assignment: "Pressure and development swap seats each game; seeded game randomness and separate per-seat policy variation prevent shared private information.",
      deckMatchups: [...new Set(games.map((game) => game.decks.join(" vs ")))],
    },
    naturalFinishes: games.filter((game) => game.naturalFinish).length,
    deadlocks: games.filter((game) => game.termination === "deadlock").map((game) => game.game),
    limitGames: games.filter((game) => game.termination === "limit").map((game) => game.game),
    winners: {
      seat1: games.filter((game) => game.winner === 0).length,
      seat2: games.filter((game) => game.winner === 1).length,
    },
    averageFinalTurn: games.reduce((sum, game) => sum + game.finalTurn, 0) / games.length,
    longestGame: Math.max(...games.map((game) => game.finalTurn)),
    shortestGame: Math.min(...games.map((game) => game.finalTurn)),
    battles: games.reduce((sum, game) => sum + game.battles, 0),
    creaturesDestroyed: games.reduce((sum, game) => sum + game.creaturesDestroyed, 0),
    ties: games.reduce((sum, game) => sum + game.ties, 0),
    noDevelopmentTurns: games.reduce((sum, game) => sum + game.noDevelopmentTurns, 0),
    noLegalHuntTurns: games.reduce((sum, game) => sum + game.noLegalHuntTurns, 0),
    turnStartsWithoutCreaturePlay: games.reduce((sum, game) => sum + game.turnStartsWithoutCreaturePlay, 0),
    turnStartsWithEmptyBoard: games.reduce((sum, game) => sum + game.turnStartsWithEmptyBoard, 0),
    maximumHandSize: Math.max(...games.map((game) => game.maximumHandSize)),
    counterfactuals: {
      giganticBattles: giganticBattles.length,
      giganticOnlyExceptionOutcomeChanges: giganticBattles.filter(
        (battle) => battle.currentThreshold !== battle.giganticOnlyExceptionThreshold,
      ).length,
      giganticOrBruiserExceptionOutcomeChanges: giganticBattles.filter(
        (battle) => battle.currentThreshold !== battle.giganticOrBruiserExceptionThreshold,
      ).length,
      giganticDetails: giganticBattles,
      alternateWinWindows: altWinWindows,
      abiogenesisPlacementOpportunities: abiogenesisWindows.length,
      abiogenesisPlacementWouldBeUsed: abiogenesisWindows.filter((window) => window.wouldUsePlacementMode).length,
      abiogenesisDetails: abiogenesisWindows,
      excludedGeneralistRouteOpportunities: generalistWindows.length,
      excludedGeneralistDetails: generalistWindows,
    },
    cardPlays,
    games: games.map((game) => ({
      game: game.game,
      seed: game.seed,
      styles: game.styles,
      decks: game.decks,
      firstPlayer: game.firstPlayer,
      winner: game.winner,
      termination: game.termination,
      deadlockReason: game.deadlockReason,
      winReason: game.winReason,
      finalTurn: game.finalTurn,
      finalVictory: game.finalVictory,
      finalBoard: game.finalBoard,
      finalHands: game.finalHands,
      finalDeckSizes: game.finalDeckSizes,
      finalBoardNames: game.finalBoardNames,
      finalLegalHunts: game.finalLegalHunts,
      battles: game.battles,
      destroyed: game.creaturesDestroyed,
      ties: game.ties,
      noDevelopmentTurns: game.noDevelopmentTurns,
      noLegalHuntTurns: game.noLegalHuntTurns,
      turnStartsWithoutCreaturePlay: game.turnStartsWithoutCreaturePlay,
      turnStartsWithEmptyBoard: game.turnStartsWithEmptyBoard,
      giganticBattles: game.giganticBattles.length,
      altWinWindows: game.altWinWindows.length,
      abiogenesisWindows: game.abiogenesisWindows.length,
      generalistWindows: game.generalistWindows.length,
      ...(includeActions ? { actions: game.actions } : {}),
    })),
  };
}

const gamesArgument = process.argv.find((argument) => argument.startsWith("--games="));
const gameCount = Math.max(1, Number(gamesArgument?.split("=")[1] ?? 12));
const includeActions = !process.argv.includes("--compact");
const seedArgument = process.argv.find((argument) => argument.startsWith("--seed="));
const explicitSeed = seedArgument ? Number(seedArgument.split("=")[1]) : null;
const decksArgument = process.argv.find((argument) => argument.startsWith("--decks="));
const requestedDecks = (decksArgument?.split("=")[1] ?? "deck-1,deck-1").split(",");
if (requestedDecks.length !== 2 || requestedDecks.some((deck) => !["deck-1", "deck-2", "deck-3"].includes(deck))) {
  throw new Error("--decks must contain exactly two comma-separated values: deck-1, deck-2, or deck-3.");
}
const selectedDecks = requestedDecks as [DeckKey, DeckKey];
const games: Telemetry[] = [];
const baseSeed = explicitSeed ?? 0x51f15e;
for (let index = 0; index < gameCount; index += 1) {
  const styles: [Style, Style] = index % 2 === 0
    ? ["pressure", "development"]
    : ["development", "pressure"];
  games.push(runGame(index + 1, baseSeed + index * 7919, styles, selectedDecks));
}

console.log(JSON.stringify(aggregate(games, includeActions), null, 2));
