// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { applyAction, createGame, type GameAction, type GameState } from "../../src/engine/index.ts";
import { App } from "../../src/ui/App.tsx";
import { BattleModal } from "../../src/ui/components/BattleModal.tsx";
import { GameScreen } from "../../src/ui/components/GameScreen.tsx";
import { WinnerOverlay } from "../../src/ui/components/Modals.tsx";
import { TUTORIALS_BY_ID } from "../../src/data/tutorials.ts";
import { clearSavedGame, loadSavedGame, saveGame, savedGameSummary } from "../../src/ui/save.ts";
import { elusiveHunt, inPlay, takeFromLibrary } from "../fixtures.ts";

beforeAll(() => {
  // jsdom lacks layout observers used by the Lesson view.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function dealGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continue to Biomes" }));
  await user.click(screen.getByRole("button", { name: "Choose Tropical" }));
  await user.click(screen.getByRole("button", { name: "Confirm selection" }));
  await user.click(screen.getByRole("button", { name: /choose my Biome/ }));
  await user.click(screen.getByRole("button", { name: "Choose Cold" }));
  await user.click(screen.getByRole("button", { name: "Confirm selection" }));
  await user.click(screen.getByRole("button", { name: "Draw opening hands" }));
  await act(() => vi.runAllTimersAsync());
}

describe("App", () => {
  test("setup, private Biome selection, deal, and handoff lead to a playable hand", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await dealGame(user);

    const handoff = screen.getByRole("dialog", { name: "Private handoff" });
    expect(within(handoff).getByText(/goes first/)).toBeInTheDocument();
    expect(screen.getByText("Private hand sealed for handoff")).toBeInTheDocument();
    await user.click(within(handoff).getByRole("button", { name: /begin my turn/ }));

    // Tropical may ask to order the top two cards first.
    const order = screen.queryByRole("dialog", { name: "Biodiversity draw ordering" });
    if (order) await user.click(within(order).getAllByRole("button")[0]!);

    expect(screen.getByText(/Choose a card to play/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { pressed: false }).length).toBeGreaterThan(0);
  });

  test("a game in progress is offered for resume after a reload", async () => {
    const game = createGame("Ada", "Grace", ["arid", "aquatic"], ["deck-2", "deck-3"], { seed: 11 });
    saveGame(applyAction(game, { type: "acknowledgeHandoff" }));
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText(/Ada vs\. Grace · Turn 1/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume" }));
    const cover = screen.getByRole("dialog", { name: "Private handoff" });
    expect(within(cover).getByText("Resume your game")).toBeInTheDocument();
  });

  test("the card browser and rules open from setup", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Inspect Cards" }));
    expect(screen.getByRole("dialog", { name: "Inspect cards" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Deck 3: Aquatic Carnivores" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Return to setup" }));
    expect(screen.queryByRole("dialog", { name: "Inspect cards" })).not.toBeInTheDocument();
  });

  test("clicking a card with a finished face in the card browser shows it enlarged", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Inspect Cards" }));
    const browserCard = (name: string) =>
      screen.getAllByRole("article", { name: new RegExp(`^${name},`) })[0]!.closest("button")!;

    await user.click(browserCard("Spinosaurus"));
    const enlarged = screen.getByRole("dialog", { name: "Spinosaurus card" });
    expect(within(enlarged).getByRole("img", { name: "Spinosaurus card" })).toHaveAttribute(
      "src",
      expect.stringContaining("/card-faces/spinosaurus.webp"),
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Spinosaurus card" })).not.toBeInTheDocument();

    // Support cards have no finished face yet, so they only pin in the inspector.
    await user.click(browserCard("Wildfire"));
    expect(screen.queryByRole("dialog", { name: /card$/ })).not.toBeInTheDocument();
  });

  test("the card anatomy tutorial lights every part it explains, step by step, and is marked done", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Tutorials" }));
    await user.click(screen.getByRole("button", { name: /Anatomy of a card/ }));
    const player = screen.getByRole("dialog", { name: "Tutorial: Anatomy of a card" });
    expect(within(player).getByRole("button", { name: "Back" })).toBeDisabled();
    expect(within(player).getByRole("button", { name: "Next" })).toHaveFocus();

    const tutorial = TUTORIALS_BY_ID.get("card-anatomy")!;
    for (const [index, step] of tutorial.steps.entries()) {
      expect(within(player).getByRole("heading", { name: step.title })).toBeInTheDocument();
      expect(within(player).getByText(`Step ${index + 1} of ${tutorial.steps.length}`)).toBeInTheDocument();
      expect(player.querySelector(`[data-tutorial-target="${step.target}"]`), step.target).not.toBeNull();
      await user.click(
        within(player).getByRole("button", { name: index === tutorial.steps.length - 1 ? "Finish" : "Next" }),
      );
    }

    expect(screen.queryByRole("dialog", { name: /^Tutorial:/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anatomy of a card/ })).toHaveTextContent("✓ Done");
  });
});

describe("saved games", () => {
  test("round-trip through storage and re-link card definitions", () => {
    const game = applyAction(createGame("A", "B", [null, null], ["deck-1", "deck-2"], { seed: 9 }), {
      type: "acknowledgeHandoff",
    });
    saveGame(game);
    const loaded = loadSavedGame();
    expect(loaded).toEqual(game);
    expect(savedGameSummary()?.players).toEqual(["A", "B"]);
  });

  test("corrupt or incompatible saves are discarded instead of crashing", () => {
    window.localStorage.setItem("pcg.savedGame", "{not json");
    expect(loadSavedGame()).toBeNull();
    window.localStorage.setItem("pcg.savedGame", JSON.stringify({ version: 999, game: {} }));
    expect(loadSavedGame()).toBeNull();

    const game = createGame("A", "B", [null, null], ["deck-1", "deck-1"], { seed: 4 });
    game.players[0].deck.pop(); // a card vanishes: fails the invariant check
    saveGame(game);
    expect(loadSavedGame()).toBeNull();
    expect(savedGameSummary()).toBeNull();
  });

  test("finished games are not kept", () => {
    const game = createGame("A", "B", [null, null], ["deck-1", "deck-1"], { seed: 4 });
    saveGame(game);
    saveGame(applyAction(game, { type: "concede" }));
    expect(savedGameSummary()).toBeNull();
    clearSavedGame();
  });
});

describe("BattleModal", () => {
  function Harness({ initial, log }: { initial: GameState; log: GameAction[] }) {
    const [state, setState] = useState(initial);
    const dispatch = (action: GameAction) => {
      log.push(action);
      setState((current) => applyAction(current, action));
    };
    return state.pendingBattle ? (
      <BattleModal game={state} dispatch={dispatch} controller={null} />
    ) : (
      <p>Hunt resolved</p>
    );
  }

  test("Commit flips the coins in the engine, then the stored results resolve the Hunt", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const log: GameAction[] = [];
    render(<Harness initial={elusiveHunt()} log={log} />);

    expect(screen.getByText(/Commit Hunt will flip 1 Battle Coin/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Commit Hunt" }));
    expect(log).toEqual([{ type: "flipBattleCoins" }]);
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Flipping…" })).toBeDisabled();

    await act(() => vi.advanceTimersByTimeAsync(900));
    await user.click(screen.getByRole("button", { name: "Use these results" }));
    expect(log.at(-1)).toEqual({ type: "commitHunt" });
    expect(screen.getByText("Hunt resolved")).toBeInTheDocument();
  });
});

describe("move legality explanations", () => {
  /** Player 0's Development Phase: Velociraptor in Niche 2, Allosaurus and Compsognathus in hand. */
  function placementGame(): GameState {
    const state = createGame("Ada", "Grace", [null, null], ["deck-1", "deck-1"], { seed: 8 });
    Object.assign(state, { activePlayer: 0, turnNumber: 5, phase: "development", handoff: null });
    for (const player of state.players) {
      player.lanes = player.lanes.map(() => ({
        creature: null,
        attachment: null,
        engulfed: null,
        wildfire: null,
        drought: null,
      }));
      player.hand = [];
      player.turnsStarted = 3;
    }
    state.players[0].lanes[1]!.creature = inPlay(takeFromLibrary(state, 0, "velociraptor"));
    state.players[0].hand.push(takeFromLibrary(state, 0, "allosaurus"), takeFromLibrary(state, 0, "spinosaurus"));
    return state;
  }

  test("pointing at a Niche explains the override, and unplayable cards say why", async () => {
    const user = userEvent.setup();
    render(<GameScreen initialGame={placementGame()} resumed={false} onExit={() => {}} />);

    const spinosaurus = screen.getByRole("button", { name: /Spinosaurus/, description: /Can't play now/ });
    expect(within(spinosaurus).getByText("Can't play now")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Allosaurus, Archosaur/ }));
    await user.hover(screen.getByRole("button", { name: /Velociraptor in Niche 2/ }));
    const panels = screen.getAllByRole("region", { name: "Move explanation" });
    const panel = panels[0]!;
    expect(within(panel).getByText("Why can't Allosaurus replace Velociraptor?")).toBeInTheDocument();
    expect(within(panel).getByText(/Jurassic vs\. Cretaceous/)).toBeInTheDocument();
    expect(within(panel).getByText(/Level 1 → 2 is a legal step/)).toBeInTheDocument();
    expect(screen.getAllByText("2 of 4").length).toBeGreaterThan(0);

    await user.hover(screen.getByRole("button", { name: /Your Niche 1, empty/ }));
    expect(
      within(screen.getAllByRole("region", { name: "Move explanation" })[0]!).getByText(
        /Empty Niches take only Level 0 or 1/,
      ),
    ).toBeInTheDocument();
  });
});

describe("game over", () => {
  test("a draw shows both totals instead of a winner", () => {
    const state = createGame("Ada", "Grace", [null, null], ["deck-1", "deck-1"], { seed: 3 });
    Object.assign(state, {
      phase: "game-over",
      handoff: null,
      drawn: true,
      winReason: "Both decks ran out with the Victory totals tied at 0.",
    });
    render(<WinnerOverlay game={state} onRestart={() => {}} />);
    expect(screen.getByRole("heading", { name: "It's a draw" })).toBeInTheDocument();
    expect(screen.getByText("0–0")).toBeInTheDocument();
    expect(screen.getByText(/tied at 0/)).toBeInTheDocument();
  });
});

/** Lets the computer finish its moves; each move is a separate React update, so the clock advances in steps. */
async function letComputerPlay() {
  for (let step = 0; step < 80; step += 1) await act(() => vi.advanceTimersByTimeAsync(1_000));
}

describe("against the computer", () => {
  test("setup to first move: the computer picks its own Biome and nobody passes the device", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.click(screen.getByRole("radio", { name: /Computer · Easy/ }));
    await user.click(screen.getByRole("button", { name: "Continue to Biomes" }));
    // Cold: no start-of-turn choice for the person, so play runs straight to their Development Phase.
    await user.click(screen.getByRole("button", { name: "Choose Cold" }));
    await user.click(screen.getByRole("button", { name: "Confirm selection" }));
    expect(screen.getByText("The ecosystems are set.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Draw opening hands" }));
    await letComputerPlay();

    expect(screen.queryByRole("dialog", { name: "Private handoff" })).not.toBeInTheDocument();
    expect(screen.getByText("Computer · Easy")).toBeInTheDocument();
    // Whoever went first, play reaches the person's own turn with their hand on show.
    expect(screen.getByText(/Player One’s (Development|Battle) Phase/)).toBeInTheDocument();
    expect(screen.queryByText("Private hand sealed for handoff")).not.toBeInTheDocument();
    expect(loadSavedGame()?.computer).toEqual({ seat: 1, difficulty: "easy" });
  });

  test("on the computer's turn the person can watch but not move", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let game = createGame("Ada", "Computer", [null, null], ["deck-1", "deck-1"], { seed: 31 });
    game = { ...game, computer: { seat: game.handoff!.to, difficulty: "normal" } };
    game = applyAction(game, { type: "acknowledgeHandoff" });
    render(<GameScreen initialGame={game} resumed={false} onExit={() => {}} />);

    expect(screen.getByRole("region", { name: "Computer's turn" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End turn" })).not.toBeInTheDocument();
    await letComputerPlay();
    expect(screen.getByRole("button", { name: "End turn" })).toBeInTheDocument();
    expect(screen.getByText(/Ada’s Development Phase/)).toBeInTheDocument();
  });
});
