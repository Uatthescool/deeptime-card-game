import { countsAsAquatic } from "../data/cards.ts";
import {
  addLog,
  clone,
  creatureCanEnterNiche,
  creatureCanMoveByEffect,
  drawOne,
  enterableEmptyNiches,
  hasEnterableEmptyNiche,
  moveCardFromHand,
  moveLaneOccupant,
  placeCreatureFromHand,
  sendCardToHistory,
  sendCreatureToHistory,
  takeDeckCard,
} from "./core.ts";
import { queueEntryEffects } from "./entry-effects.ts";
import { abiogenesisModes, canPlayConcept, evolutionaryRadiationLevels } from "./queries.ts";
import { randomInt, shuffle } from "./rng.ts";
import { finishResolution } from "./turn.ts";
import type {
  CardInstance,
  ChoiceOption,
  ConceptInstance,
  GameState,
  PendingConceptChoice,
  PlayerId,
} from "./types.ts";

/** Concept cards: one-shot effects, many with multi-step choices. */

export const FINISH_RADIATION = "__finish-radiation__";
export const DECLINE_SEMELPARITY = "__decline-semelparity__";
export const ABIOGENESIS_SEARCH = "__abiogenesis-search__";
export const ABIOGENESIS_PLACE = "__abiogenesis-place__";

function completeConcept(state: GameState, card: ConceptInstance) {
  sendCardToHistory(state, card, "Concept resolved");
  state.pendingConceptChoice = null;
  return finishResolution(state);
}

function choose(state: GameState, card: ConceptInstance, kind: PendingConceptChoice["kind"]): GameState {
  state.pendingConceptChoice = { card, kind };
  return state;
}

export function playConcept(original: GameState, cardUid: string): GameState {
  const state = clone(original);
  const player = state.players[state.activePlayer];
  const card = player.hand.find((held) => held.uid === cardUid);
  if (!card || card.definition.kind !== "concept" || !canPlayConcept(state, card)) return state;
  const moved = moveCardFromHand(player, cardUid) as ConceptInstance;
  player.allowances.conceptsPlayed += 1;
  player.allowances.developmentActions += 1;
  addLog(state, `${player.name} played ${moved.definition.name}.`);

  switch (moved.definition.key) {
    case "convergent-evolution":
      sendCardToHistory(state, moved, "Concept resolved");
      player.allowances.convergentEvolution = true;
      addLog(
        state,
        "Convergent Evolution is waiting for this turn's next override; no other Concept may be played until it resolves.",
      );
      return state;
    case "rapid-speciation":
      sendCardToHistory(state, moved, "Concept resolved");
      player.allowances.rapidSpeciation = true;
      addLog(state, "Choose a Creature and occupied Niche for Rapid Speciation's mandatory override.");
      return state;
    case "biogenesis": {
      const filled = player.lanes.filter((lane) => lane.creature).length;
      for (let index = 0; index < filled; index += 1) drawOne(state, state.activePlayer, "Biogenesis");
      addLog(state, `Biogenesis counted ${filled} filled ${filled === 1 ? "Niche" : "Niches"}.`);
      return completeConcept(state, moved);
    }
    case "genetic-drift": {
      // The mandatory discard resolves before the UI animates the five draws.
      player.deck = shuffle(state, [...player.deck, ...player.hand]);
      player.hand = [];
      const drawn = Array.from({ length: 5 }, () => drawOne(state, state.activePlayer, "Genetic Drift")).filter(
        (entry): entry is CardInstance => Boolean(entry),
      );
      if (!drawn.length) return completeConcept(state, moved);
      state.pendingConceptChoice = {
        card: moved,
        kind: "genetic-drift-discard",
        eligibleUids: drawn.map((entry) => entry.uid),
      };
      return state;
    }
    case "genetic-mutations": {
      const adaptations = player.deck.filter((candidate) => candidate.definition.kind === "adaptation");
      if (adaptations.length) {
        const selected = adaptations[randomInt(state, adaptations.length)]!;
        const found = takeDeckCard(player, selected.uid);
        if (found) {
          player.hand.push(found);
          addLog(
            state,
            `Genetic Mutations added the random Adaptation ${found.definition.name} to ${player.name}'s hand.`,
          );
        }
      } else {
        addLog(state, "Genetic Mutations found no Adaptation remaining in the deck.");
      }
      player.deck = shuffle(state, player.deck);
      return completeConcept(state, moved);
    }
    case "evolutionary-radiation":
      state.pendingConceptChoice = {
        card: moved,
        kind: "evolutionary-radiation-card",
        radiationRemainingLevels: evolutionaryRadiationLevels(state, state.activePlayer),
        radiationPlacements: 0,
      };
      return state;
    case "whale-fall":
      return choose(state, moved, "whale-fall");
    case "natural-selection":
      return choose(state, moved, "natural-selection-cost");
    case "dig-site-excavation":
      return choose(state, moved, "dig-site");
    case "semelparity":
      return choose(state, moved, "semelparity-cost");
    case "obligate-migration":
      return choose(state, moved, "obligate-migration-source");
    case "abiogenesis":
      return choose(state, moved, "abiogenesis-mode");
    default:
      return completeConcept(state, moved);
  }
}

const creatureOption = (card: CardInstance): ChoiceOption => ({
  id: card.uid,
  label: card.definition.name,
  detail:
    card.definition.kind === "creature"
      ? `Level ${card.definition.printedLevel} · ${card.definition.period} · ${card.definition.diet}`
      : card.definition.kind,
});

const isLevelZeroCreature = (card: CardInstance) =>
  card.definition.kind === "creature" && card.definition.printedLevel === 0;

function emptyNicheOptions(state: GameState, playerId: PlayerId, idPrefix = ""): ChoiceOption[] {
  return enterableEmptyNiches(state, playerId).map((index) => ({
    id: `${idPrefix}${index}`,
    label: `Niche ${index + 1}`,
    detail: "Empty, unlocked destination",
  }));
}

export function getConceptChoiceOptions(state: GameState): ChoiceOption[] {
  const pending = state.pendingConceptChoice;
  if (!pending) return [];
  const player = state.players[state.activePlayer];

  switch (pending.kind) {
    case "evolutionary-radiation-card":
      return [
        ...player.hand
          .filter(
            (card) =>
              card.definition.kind === "creature" &&
              (pending.radiationRemainingLevels ?? []).includes(card.definition.printedLevel as 0 | 1),
          )
          .map(creatureOption),
        ...(pending.radiationPlacements
          ? [
              {
                id: FINISH_RADIATION,
                label: "Finish Radiation",
                detail: "Keep the first play, finish resolving this Concept, and retain your Battle Phase.",
              },
            ]
          : []),
      ];
    case "evolutionary-radiation-lane":
    case "abiogenesis-placement-lane":
      return emptyNicheOptions(state, state.activePlayer);
    case "whale-fall":
      return player.hand
        .filter((card) => card.definition.kind === "creature" && card.definition.printedLevel >= 2)
        .map(creatureOption);
    case "natural-selection-cost":
      return player.hand.filter((card) => card.definition.kind === "creature").map(creatureOption);
    case "natural-selection-search":
      return player.deck.filter((card) => card.definition.kind === "creature").map(creatureOption);
    case "genetic-drift-discard":
      return player.hand.filter((card) => pending.eligibleUids?.includes(card.uid)).map(creatureOption);
    case "dig-site":
      return player.history.filter((card) => card.definition.key !== "dig-site-excavation").map(creatureOption);
    case "semelparity-cost": {
      const hand = player.hand.filter(isLevelZeroCreature).map((card) => {
        const option = creatureOption(card);
        return { ...option, id: `hand:${card.uid}`, detail: `${option.detail} · Hand` };
      });
      const board = player.lanes.flatMap((lane, index) =>
        lane.creature?.card.definition.printedLevel === 0
          ? [{ id: `lane:${index}`, label: lane.creature.card.definition.name, detail: `Level 0 · Niche ${index + 1}` }]
          : [],
      );
      return [...hand, ...board];
    }
    case "semelparity-replacement-card":
      return [
        ...player.hand.filter(isLevelZeroCreature).map(creatureOption),
        {
          id: DECLINE_SEMELPARITY,
          label: "Decline replacement",
          detail: "Finish resolving Semelparity and keep your Battle Phase.",
        },
      ];
    case "semelparity-replacement-lane":
      return [
        ...emptyNicheOptions(state, state.activePlayer),
        {
          id: DECLINE_SEMELPARITY,
          label: "Decline replacement",
          detail: "Return to the card choice without playing a Creature.",
        },
      ];
    case "obligate-migration-source":
      return state.players.flatMap((side) => {
        if (!hasEnterableEmptyNiche(state, side.id)) return [];
        return side.lanes.flatMap((lane, index) =>
          creatureCanMoveByEffect(lane)
            ? [
                {
                  id: `${side.id}:${index}`,
                  label: lane.creature!.card.definition.name,
                  detail: `${side.id === state.activePlayer ? "Your" : `${side.name}'s`} Niche ${index + 1}`,
                },
              ]
            : [],
        );
      });
    case "obligate-migration-destination": {
      const sourcePlayer = pending.sourcePlayer;
      if (sourcePlayer === undefined) return [];
      return enterableEmptyNiches(state, sourcePlayer).map((index) => ({
        id: `${sourcePlayer}:${index}`,
        label: `Niche ${index + 1}`,
        detail: `Empty, unlocked destination on ${state.players[sourcePlayer].name}'s side`,
      }));
    }
    case "abiogenesis-mode": {
      const { canSearch, canPlace } = abiogenesisModes(state);
      return [
        ...(canSearch
          ? [
              {
                id: ABIOGENESIS_SEARCH,
                label: "Search your deck",
                detail: "Add one Level 0 Creature from your deck to your hand, then shuffle.",
              },
            ]
          : []),
        ...(canPlace
          ? [
              {
                id: ABIOGENESIS_PLACE,
                label: "Fill an empty Niche",
                detail:
                  "Place one Level 0 Creature from your hand without using your normal Creature play; skip Battle.",
              },
            ]
          : []),
      ];
    }
    case "abiogenesis-search":
      return player.deck.filter(isLevelZeroCreature).map(creatureOption);
    case "abiogenesis-placement-card":
      return player.hand.filter(isLevelZeroCreature).map(creatureOption);
  }
}

export function chooseConceptOption(original: GameState, optionId: string): GameState {
  const state = clone(original);
  const pending = state.pendingConceptChoice;
  if (!pending || !getConceptChoiceOptions(state).some((option) => option.id === optionId)) return state;
  const active = state.activePlayer;
  const player = state.players[active];

  switch (pending.kind) {
    case "evolutionary-radiation-card":
      if (optionId === FINISH_RADIATION) {
        addLog(
          state,
          `Evolutionary Radiation finished after ${pending.radiationPlacements} placement${pending.radiationPlacements === 1 ? "" : "s"}.`,
        );
        return completeConcept(state, pending.card);
      }
      pending.selectedCardUid = optionId;
      pending.kind = "evolutionary-radiation-lane";
      return state;

    case "evolutionary-radiation-lane": {
      const laneIndex = Number(optionId);
      const card = placeCreatureFromHand(state, active, pending.selectedCardUid!, laneIndex);
      if (!card) return state;
      const placedLevel = card.definition.printedLevel as 0 | 1;
      player.allowances.radiationPlacements += 1;
      pending.radiationPlacements = (pending.radiationPlacements ?? 0) + 1;
      pending.radiationRemainingLevels = (pending.radiationRemainingLevels ?? []).filter(
        (level) => level !== placedLevel,
      );
      addLog(
        state,
        `Evolutionary Radiation placed ${card.definition.name} into Niche ${laneIndex + 1} without using the normal Creature play.`,
      );
      if (pending.radiationPlacements === 2) {
        player.allowances.skipBattlePhase = true;
        addLog(
          state,
          `${player.name} resolved both Evolutionary Radiation effects and must skip the Battle Phase this turn.`,
        );
      }
      queueEntryEffects(state, active, laneIndex);
      const remaining = pending.radiationRemainingLevels;
      const canPlaceAnother =
        remaining.length > 0 &&
        hasEnterableEmptyNiche(state, active) &&
        player.hand.some(
          (held) => held.definition.kind === "creature" && remaining.includes(held.definition.printedLevel as 0 | 1),
        );
      if (canPlaceAnother) {
        pending.selectedCardUid = undefined;
        pending.kind = "evolutionary-radiation-card";
        addLog(
          state,
          "Evolutionary Radiation may resolve its other eligible effect; doing so will skip the Battle Phase this turn.",
        );
        return state;
      }
      addLog(
        state,
        `Evolutionary Radiation completed ${pending.radiationPlacements} placement${pending.radiationPlacements === 1 ? "" : "s"}.`,
      );
      return completeConcept(state, pending.card);
    }

    case "whale-fall": {
      const card = moveCardFromHand(player, optionId);
      if (!card || card.definition.kind !== "creature") return state;
      sendCardToHistory(state, card, "Whale Fall");
      const draws = countsAsAquatic(card.definition) ? 3 : 2;
      for (let index = 0; index < draws; index += 1) drawOne(state, active, "Whale Fall");
      addLog(state, `Whale Fall sent ${card.definition.name} to History and drew ${draws}.`);
      return completeConcept(state, pending.card);
    }

    case "natural-selection-cost": {
      const card = moveCardFromHand(player, optionId);
      if (!card) return state;
      sendCardToHistory(state, card, "Natural Selection cost");
      addLog(state, `${card.definition.name} was paid as Natural Selection's additional cost.`);
      pending.kind = "natural-selection-search";
      return state;
    }

    case "natural-selection-search": {
      const card = takeDeckCard(player, optionId);
      if (!card) return state;
      player.hand.push(card);
      player.deck = shuffle(state, player.deck);
      addLog(state, `Natural Selection found and revealed ${card.definition.name}; the deck was shuffled.`);
      return completeConcept(state, pending.card);
    }

    case "genetic-drift-discard": {
      const card = moveCardFromHand(player, optionId);
      if (!card) return state;
      sendCardToHistory(state, card, "Genetic Drift discard");
      addLog(state, `${card.definition.name} was sent to History to complete ${pending.card.definition.name}.`);
      return completeConcept(state, pending.card);
    }

    case "dig-site": {
      const index = player.history.findIndex((card) => card.uid === optionId);
      if (index < 0) return state;
      const [card] = player.history.splice(index, 1);
      player.hand.push(card!);
      addLog(state, `Dig Site Excavation returned ${card!.definition.name} to ${player.name}'s hand.`);
      return completeConcept(state, pending.card);
    }

    case "semelparity-cost": {
      let paidFromPlay = false;
      if (optionId.startsWith("hand:")) {
        const card = moveCardFromHand(player, optionId.slice("hand:".length));
        if (!card) return state;
        sendCardToHistory(state, card, "Semelparity cost");
        addLog(state, `${card.definition.name} was paid from hand for Semelparity.`);
      } else {
        const laneIndex = Number(optionId.slice("lane:".length));
        const name = player.lanes[laneIndex]!.creature?.card.definition.name;
        sendCreatureToHistory(state, active, laneIndex, "effect");
        addLog(state, `${name} was paid from Niche ${laneIndex + 1} for Semelparity.`);
        paidFromPlay = true;
      }
      for (let index = 0; index < 2; index += 1) drawOne(state, active, "Semelparity");
      const replacementAvailable =
        paidFromPlay && player.hand.some(isLevelZeroCreature) && hasEnterableEmptyNiche(state, active);
      if (!replacementAvailable) return completeConcept(state, pending.card);
      pending.kind = "semelparity-replacement-card";
      addLog(state, "Semelparity may replace the Creature paid from play with a Level 0 Creature from hand.");
      return state;
    }

    case "semelparity-replacement-card":
      if (optionId === DECLINE_SEMELPARITY) {
        addLog(state, `${player.name} declined Semelparity's optional replacement and kept their Battle Phase.`);
        return completeConcept(state, pending.card);
      }
      pending.selectedCardUid = optionId;
      pending.kind = "semelparity-replacement-lane";
      return state;

    case "semelparity-replacement-lane": {
      if (optionId === DECLINE_SEMELPARITY) {
        pending.selectedCardUid = undefined;
        pending.kind = "semelparity-replacement-card";
        return state;
      }
      const laneIndex = Number(optionId);
      if (!player.hand.some((card) => card.uid === pending.selectedCardUid && isLevelZeroCreature(card))) return state;
      const card = placeCreatureFromHand(state, active, pending.selectedCardUid!, laneIndex)!;
      player.allowances.skipBattlePhase = true;
      addLog(
        state,
        `Semelparity played ${card.definition.name} into Niche ${laneIndex + 1} without using the normal Creature play; ${player.name} must skip the Battle Phase this turn.`,
      );
      queueEntryEffects(state, active, laneIndex);
      return completeConcept(state, pending.card);
    }

    case "obligate-migration-source": {
      const [sourcePlayer, sourceLane] = optionId.split(":").map(Number);
      pending.sourcePlayer = sourcePlayer as PlayerId;
      pending.sourceLane = sourceLane;
      pending.kind = "obligate-migration-destination";
      return state;
    }

    case "obligate-migration-destination": {
      const [destinationPlayer, destinationLane] = optionId.split(":").map(Number) as [number, number];
      if (pending.sourcePlayer === undefined || destinationPlayer !== pending.sourcePlayer) return state;
      const migratingPlayer = state.players[pending.sourcePlayer];
      const sourceLane = pending.sourceLane!;
      const source = migratingPlayer.lanes[sourceLane]!;
      const destination = migratingPlayer.lanes[destinationLane];
      if (
        !creatureCanMoveByEffect(source) ||
        !destination ||
        destination.creature ||
        !creatureCanEnterNiche(state, pending.sourcePlayer, destinationLane)
      ) {
        return state;
      }
      const migratingName = source.creature!.card.definition.name;
      moveLaneOccupant(source, destination);
      addLog(
        state,
        `Obligate Migration moved ${migratingName} on ${migratingPlayer.name}'s side from Niche ${sourceLane + 1} to Niche ${destinationLane + 1} without triggering a fill effect.`,
      );
      return completeConcept(state, pending.card);
    }

    case "abiogenesis-mode":
      pending.kind = optionId === ABIOGENESIS_SEARCH ? "abiogenesis-search" : "abiogenesis-placement-card";
      return state;

    case "abiogenesis-search": {
      const card = takeDeckCard(player, optionId);
      if (!card) return state;
      player.hand.push(card);
      player.deck = shuffle(state, player.deck);
      addLog(state, `Abiogenesis found ${card.definition.name}; the deck was shuffled.`);
      return completeConcept(state, pending.card);
    }

    case "abiogenesis-placement-card":
      pending.selectedCardUid = optionId;
      pending.kind = "abiogenesis-placement-lane";
      return state;

    case "abiogenesis-placement-lane": {
      const laneIndex = Number(optionId);
      if (!player.hand.some((card) => card.uid === pending.selectedCardUid && isLevelZeroCreature(card))) return state;
      const card = placeCreatureFromHand(state, active, pending.selectedCardUid!, laneIndex)!;
      player.allowances.skipBattlePhase = true;
      addLog(
        state,
        `Abiogenesis placed ${card.definition.name} into Niche ${laneIndex + 1} without using the normal Creature play; ${player.name} must skip the Battle Phase this turn.`,
      );
      queueEntryEffects(state, active, laneIndex);
      return completeConcept(state, pending.card);
    }
  }
}
