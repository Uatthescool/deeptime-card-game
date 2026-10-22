/**
 * Public API of the rules engine.
 *
 * The engine is pure TypeScript with no UI or browser dependencies. Every
 * transition takes a GameState and returns a new one; inputs are never
 * mutated, and an illegal request returns an unchanged copy rather than
 * throwing. Randomness is seeded and stored in the state, so games are fully
 * reproducible from their seed and action history.
 */
export * from "./types.ts";
export { parseSeedLabel, randomSeed, seedLabel } from "./rng.ts";
export {
  allCreatures,
  effectiveHasTag,
  emptyAllowances,
  endingTurnForfeits,
  findCreature,
  FULL_HAND_FORFEIT_TURNS,
  handCardByUid,
  HAND_LIMIT,
  handStalled,
  LANE_COUNT,
  laneIsLocked,
  nicheIsLocked,
  otherPlayer,
  PERIOD_SEQUENCE,
  resolutionBlocked,
  VICTORY_THRESHOLD,
} from "./core.ts";
export { checkOverride } from "./override.ts";
export { cardVictoryLevel, victoryTotals } from "./victory.ts";
export {
  battleCoinPlan,
  battleNeedsElusiveFlip,
  hasLegalHunts,
  inspectBattleLevel,
  legalAttackTargets,
} from "./battle-math.ts";
export {
  adaptationEligible,
  canActivateCarnianPluvialEpisode,
  canPerformFullHandMulligan,
  canPlayConcept,
  canPlayEvent,
  canUseAquaticOverride,
  conceptAllowance,
  legalAdaptationLanes,
  legalAdaptationTargets,
  legalAquaticOverrideLanes,
  legalConnectedWaterwayDestinations,
  legalConnectedWaterwaySources,
  legalCreatureLanes,
  legalDroughtTargets,
  legalFacultativeDestinations,
  legalFacultativeSources,
  legalWildfireLanes,
  NICHE_EVENT_KEYS,
} from "./queries.ts";
export {
  acknowledgeHandoff,
  advanceToBattle,
  advanceToBattleOrEndTurn,
  chooseBiodiversityTop,
  concedeByExtinction,
  createGame,
  endTurn,
  performFullHandMulligan,
  type CreateGameOptions,
} from "./turn.ts";
export {
  chooseCranialDisplayTarget,
  chooseFilterFeederTop,
  chooseHerd,
  chooseNesting,
  DECLINE_HERD,
  DECLINE_NESTING,
  getHerdOptions,
  getNestingOptions,
} from "./entry-effects.ts";
export {
  activateCarnianPluvialEpisode,
  chooseCarnianPluvialOption,
  chooseConvergentCategory,
  chooseGeologicalBoundaryPeriod,
  geologicalBoundaryOptions,
  getCarnianPluvialOptions,
  moveFacultativeQuadrupedality,
  playAdaptation,
  playAquaticOverride,
  playCreature,
  playDrought,
  playEvent,
  playWildfire,
  repositionConnectedWaterway,
} from "./development.ts";
export { chooseConceptOption, getConceptChoiceOptions, playConcept } from "./concepts.ts";
export {
  cancelBattlePreview,
  canRerollBattleCoin,
  canUseTemperateReroll,
  chooseEngulf,
  coinGroupOwner,
  commitBattle,
  flipBattleCoins,
  previewBattle,
  rerollBattleCoin,
  spendTemperateReroll,
} from "./battle.ts";
export {
  actingPlayer,
  applyAction,
  listLegalActions,
  replay,
  waitingPlayer,
  type GameAction,
  type GameActionType,
} from "./actions.ts";
export { checkInvariants } from "./invariants.ts";
export { developmentGate, entryBlockers, explainAquaticOverrideLane, explainCreatureLane } from "./legality.ts";
export { explainCard, explainPlacement } from "./explain.ts";
export { explainHunt, explainHunter } from "./battle-math.ts";
export { explainConcept, explainEvent } from "./queries.ts";
