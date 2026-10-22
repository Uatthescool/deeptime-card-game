import type {
  AdaptationCard,
  CardDefinition,
  ConceptCard,
  CreatureCard,
  DeckKey,
  EventCard,
  Period,
} from "../data/cards.ts";
import type { BiomeKey } from "../data/biomes.ts";

/** Bump when GameState changes shape so saved games from older builds are discarded. */
export const GAME_STATE_VERSION = 1;

export type PlayerId = 0 | 1;
export type Phase = "handoff" | "start" | "development" | "battle" | "game-over";
export type ConvergentCategory = "diet" | "period" | "taxon";

export type CardInstance = {
  uid: string;
  owner: PlayerId;
  definition: CardDefinition;
  livingFossilUsed?: boolean;
};

export type CreatureInstance = CardInstance & { definition: CreatureCard };
export type EventInstance = CardInstance & { definition: EventCard };
export type AdaptationInstance = CardInstance & { definition: AdaptationCard };
export type ConceptInstance = CardInstance & { definition: ConceptCard };

export type AttackBarrier = {
  targetUid: string;
  expiresOnTurn: number;
};

export type CreatureInPlay = {
  card: CreatureInstance;
  enteredTurn: number;
  lastAttackTurn: number | null;
  attackedTurn: number | null;
  elusiveUsedTurn: number | null;
  mobFeederTriggeredTurn: number | null;
  mobFeederBonusTurn: number | null;
  burrowedUntilTurn: number | null;
  cannotAttackOnTurn: number | null;
  cannotOverrideOnTurn: number | null;
  attackBarriers: AttackBarrier[];
  visualUsed?: boolean;
  deimaticProtectedThroughTurn: number | null;
  bastionDefendedTurn: number | null;
  bastionAttackedTurn: number | null;
  facultativeMovedTurn: number | null;
};

export type LaneEvent = {
  card: EventInstance;
  expiresOnTurn: number;
};

export type LaneState = {
  creature: CreatureInPlay | null;
  attachment: AdaptationInstance | null;
  engulfed?: CreatureInstance | null;
  wildfire?: LaneEvent | null;
  drought?: LaneEvent | null;
};

export type TurnAllowances = {
  creaturePlayed: boolean;
  adaptationPlayed: boolean;
  eventPlayed: boolean;
  conceptsPlayed: number;
  filledEmpty: boolean;
  developmentActions: number;
  convergentEvolution: boolean;
  rapidSpeciation: boolean;
  carnianPluvialUsed: boolean;
  radiationPlacements: number;
  skipBattlePhase: boolean;
  overriddenLanes: number[];
  aquaticOverrideLockedLane: number | null;
};

export type BiomeState = {
  key: BiomeKey | null;
  seasonCounters: number;
  temperateRerollTurn: number | null;
  waterwaysConnected: boolean;
  waterwayRepositionTurn: number | null;
  freeOverrideUsed: boolean;
};

export type PlayerState = {
  id: PlayerId;
  name: string;
  deckKey: DeckKey;
  deck: CardInstance[];
  hand: CardInstance[];
  history: CardInstance[];
  lanes: LaneState[];
  event: EventInstance | null;
  returnQueue: string[];
  fullHandMulliganUsed: boolean;
  turnsStarted: number;
  herdTriggeredTurn: number | null;
  overreachTriggeredTurn: number | null;
  overreachQueuedDraws: number;
  overreachDueTurn: number | null;
  allowances: TurnAllowances;
  biome: BiomeState;
};

export type DrawEvent = {
  id: number;
  playerId: PlayerId;
  cardUid: string;
  reason: string;
};

export type BattleCoinPlan = {
  offensiveCount: number;
  offensiveReason: string | null;
  defensiveCount: number;
  defensiveReason: string | null;
};

/** true = the red Rex face, a success for the Creature whose effect caused the flip. */
export type BattleCoinResults = {
  offensive?: boolean[];
  defensive?: boolean[];
};

export type CoinGroup = "offensive" | "defensive";

export type BattlePreview = {
  attackerUid: string;
  defenderUid: string;
  attackerPlayer: PlayerId;
  attackerLane: number;
  defenderPlayer: PlayerId;
  defenderLane: number;
  attackerLevel: number;
  attackerLevelMax: number;
  defenderLevel: number;
  attackerNotes: string[];
  defenderNotes: string[];
  coinPlan: BattleCoinPlan;
  origin: "battle-phase" | "stampede";
  /** Coins already flipped for this Hunt; null until the Hunt is committed. */
  coins: BattleCoinResults | null;
};

export type PendingEntryEffect = {
  kind: "herd" | "nesting" | "cranial-display" | "filter-feeder";
  sourceUid: string;
  playerId: PlayerId;
};

export type PendingHerd = {
  sourceUid: string;
  playerId: PlayerId;
  eligibleUids: string[];
};

export type PendingNesting = {
  sourceUid: string;
  playerId: PlayerId;
  stage: "card" | "lane";
  eligibleUids: string[];
  selectedCardUid?: string;
};

export type PendingStampede = {
  owner: PlayerId;
  order: string[];
  nextIndex: number;
};

export type ConceptChoiceKind =
  | "evolutionary-radiation-card"
  | "evolutionary-radiation-lane"
  | "whale-fall"
  | "natural-selection-cost"
  | "natural-selection-search"
  | "genetic-drift-discard"
  | "dig-site"
  | "semelparity-cost"
  | "semelparity-replacement-card"
  | "semelparity-replacement-lane"
  | "obligate-migration-source"
  | "obligate-migration-destination"
  | "abiogenesis-mode"
  | "abiogenesis-search"
  | "abiogenesis-placement-card"
  | "abiogenesis-placement-lane";

export type PendingConceptChoice = {
  card: ConceptInstance;
  kind: ConceptChoiceKind;
  selectedCardUid?: string;
  sourceLane?: number;
  sourcePlayer?: PlayerId;
  eligibleUids?: string[];
  radiationRemainingLevels?: Array<0 | 1>;
  radiationPlacements?: number;
};

export type ChoiceOption = {
  id: string;
  label: string;
  detail: string;
};
/** @deprecated Use ChoiceOption. */
export type ConceptChoiceOption = ChoiceOption;

export type PendingCarnianPluvial = {
  kind: "cost" | "search";
  sourceEventUid: string;
};

export type HandoffState = {
  kind: "turn";
  to: PlayerId;
  title: string;
  detail: string;
};

export type PendingConvergentChoice = {
  playerId: PlayerId;
  cardUid: string;
  laneIndex: number;
  categories: ConvergentCategory[];
  source?: "normal" | "aquatic";
};

export type Difficulty = "easy" | "normal";

/** The seat the computer plays, and how well. */
export type ComputerSeat = { seat: PlayerId; difficulty: Difficulty };

export type GameState = {
  version: typeof GAME_STATE_VERSION;
  /** The seed this game was created from; identifies the game for replays and bug reports. */
  seed: number;
  /** Current state of the seeded random number generator. */
  rng: number;
  players: [PlayerState, PlayerState];
  activePlayer: PlayerId;
  turnNumber: number;
  phase: Phase;
  handoff: HandoffState | null;
  pendingBattle: BattlePreview | null;
  entryEffectQueue: PendingEntryEffect[];
  pendingHerd: PendingHerd | null;
  pendingNesting: PendingNesting | null;
  endTurnAfterEntryEffects: boolean;
  pendingStampede: PendingStampede | null;
  pendingCranialDisplay: { sourceUid: string; eligibleTargetUids: string[] } | null;
  pendingConvergentChoice: PendingConvergentChoice | null;
  pendingConceptChoice: PendingConceptChoice | null;
  pendingCarnianPluvial: PendingCarnianPluvial | null;
  pendingBiodiversity: { playerId: PlayerId; cardUids: [string, string] } | null;
  pendingFilterFeeder: { playerId: PlayerId; sourceUid: string; cardUids: [string, string] } | null;
  pendingGeologicalBoundary: { card: EventInstance } | null;
  pendingEngulf: { holderPlayer: PlayerId; holderLane: number; defeatedOwner: PlayerId; defeatedUid: string } | null;
  periodAuras: Array<{ owner: PlayerId; period: Period; expiresAtTurnStart: number }>;
  winner: PlayerId | null;
  /** True when the game ended with tied Victory totals after both decks ran out. */
  drawn?: boolean;
  /** Once both decks are empty: the last turn of the game, ending the current round. */
  finalTurn?: number | null;
  winReason: string | null;
  log: string[];
  seedLabel: string;
  /** The computer opponent, if one plays this game; absent or null when two people share the device. */
  computer?: ComputerSeat | null;
  drawEvents: DrawEvent[];
  nextDrawEventId: number;
};

export type OverrideCategory = "diet" | "period" | "taxon" | "tag";

export type OverrideCheck = {
  legal: boolean;
  matches: Record<OverrideCategory, boolean>;
  matchCount: number;
  levelLegal: boolean;
  convergentCategory: ConvergentCategory | null;
  convergentOptions: ConvergentCategory[];
  /** Everything that makes the override illegal, in player-facing words. Empty when legal. */
  reasons: string[];
  /** The same blockers as `reasons`, each with a stable code. */
  blockers: Reason[];
  /** A short player-facing explanation of each category's match and of the Level step. */
  explanations: Record<OverrideCategory | "level", string> | null;
};

/** One reason a move is or is not allowed, in player-facing words. */
export type Reason = {
  /** Stable identifier for tests and analytics, e.g. "level-too-high". */
  code: string;
  text: string;
};

/** A card in hand that would make an otherwise illegal move legal. */
export type LegalityHint = {
  cardUid: string;
  cardName: string;
  text: string;
};

/** Whether a move is allowed, and why. `reasons` is empty exactly when `legal` is true. */
export type Verdict = {
  legal: boolean;
  reasons: Reason[];
};

/** A Creature placement verdict, with the override breakdown when the Niche is occupied. */
export type PlacementVerdict = Verdict & {
  override: OverrideCheck | null;
  hints: LegalityHint[];
};

export type BoardPosition = { playerId: PlayerId; laneIndex: number };

export type FoundCreature = {
  playerId: PlayerId;
  laneIndex: number;
  lane: LaneState;
  creature: CreatureInPlay;
};
