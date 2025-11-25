import {
  type Draft,
  type PayloadAction,
  type SliceCaseReducers,
  createSlice,
} from '@reduxjs/toolkit';
import { type MoveName } from '@smogon/calc';
import {
  type CalcdexBattleState,
  type PlayAheadState,
  type PlayAheadPendingDecision,
  type PlayAheadMoveResult,
} from '@showdex/interfaces/calc';
import { cloneBattleState } from '@showdex/utils/battle';
import { logger, runtimer } from '@showdex/utils/debug';

/**
 * Redux state for all play-ahead simulations.
 *
 * * Key is the `battleId`, value is the simulation state for that battle.
 * * Each battle can have at most one active simulation at a time.
 *
 * @since 1.2.6
 */
export type PlayAheadSliceState = Record<string, PlayAheadState>;

/**
 * Reducer function definitions.
 *
 * @since 1.2.6
 */
export interface PlayAheadSliceReducers extends SliceCaseReducers<PlayAheadSliceState> {
  /**
   * Initializes a new play-ahead simulation for a battle.
   *
   * * Clones the current battle state as the starting point.
   * * Activates simulation mode for the UI.
   *
   * @since 1.2.6
   */
  initSimulation: (
    state: Draft<PlayAheadSliceState>,
    action: PayloadAction<{
      battleId: string;
      battleState: CalcdexBattleState;
      scope?: string;
    }>,
  ) => void;

  /**
   * Sets the player's selected move for the current simulated turn.
   *
   * @since 1.2.6
   */
  setPlayerMove: (
    state: Draft<PlayAheadSliceState>,
    action: PayloadAction<{
      battleId: string;
      move: MoveName;
      scope?: string;
    }>,
  ) => void;

  /**
   * Sets the opponent's selected move for the current simulated turn.
   *
   * @since 1.2.6
   */
  setOpponentMove: (
    state: Draft<PlayAheadSliceState>,
    action: PayloadAction<{
      battleId: string;
      move: MoveName;
      scope?: string;
    }>,
  ) => void;

  /**
   * Updates the simulated battle state after executing a turn.
   *
   * * Typically called by the `simulateTurnThunk` async thunk.
   * * Updates HP, boosts, status, field conditions, etc.
   *
   * @since 1.2.6
   */
  updateSimulatedState: (
    state: Draft<PlayAheadSliceState>,
    action: PayloadAction<{
      battleId: string;
      simulatedBattleState: CalcdexBattleState;
      turnResults: PlayAheadMoveResult[];
      scope?: string;
    }>,
  ) => void;

  /**
   * Adds a pending decision that requires user input.
   *
   * * For example, selecting which Pokemon to switch in after U-turn.
   * * Simulation is paused until all pending decisions are resolved.
   *
   * @since 1.2.6
   */
  addPendingDecision: (
    state: Draft<PlayAheadSliceState>,
    action: PayloadAction<{
      battleId: string;
      decision: PlayAheadPendingDecision;
      scope?: string;
    }>,
  ) => void;

  /**
   * Resolves a pending decision and removes it from the queue.
   *
   * @since 1.2.6
   */
  resolvePendingDecision: (
    state: Draft<PlayAheadSliceState>,
    action: PayloadAction<{
      battleId: string;
      decisionIndex: number;
      resolution: any; // Type depends on decision type
      scope?: string;
    }>,
  ) => void;

  /**
   * Advances to the next simulated turn.
   *
   * * Increments the turn counter.
   * * Clears move selections for the next turn.
   * * Adds current turn to history.
   *
   * @since 1.2.6
   */
  advanceTurn: (
    state: Draft<PlayAheadSliceState>,
    action: PayloadAction<{
      battleId: string;
      scope?: string;
    }>,
  ) => void;

  /**
   * Resets and deactivates the simulation, discarding all simulated state.
   *
   * @since 1.2.6
   */
  resetSimulation: (
    state: Draft<PlayAheadSliceState>,
    action: PayloadAction<{
      battleId: string;
      scope?: string;
    }>,
  ) => void;

  /**
   * Destroys the entire play-ahead state for a battle.
   *
   * * Typically called when a battle ends or is closed.
   *
   * @since 1.2.6
   */
  destroy: (
    state: Draft<PlayAheadSliceState>,
    action: PayloadAction<string | string[]>,
  ) => void;
}

const l = logger('@showdex/redux/store/playAheadSlice');

export const playAheadSlice = createSlice<PlayAheadSliceState, PlayAheadSliceReducers, string>({
  name: 'playAhead',

  initialState: {},

  reducers: {
    initSimulation: (state, action) => {
      const endTimer = runtimer(`playAheadSlice.initSimulation() via ${action.payload?.scope || '(anon)'}`, l);

      const { battleId, battleState, scope } = action.payload;

      if (!battleId) {
        endTimer('(invalid battleId)');
        return;
      }

      if (!battleState) {
        l.warn(
          'initSimulation() called without battleState',
          '\n', 'battleId', battleId,
          '\n', 'scope', scope,
        );
        endTimer('(invalid battleState)');
        return;
      }

      // Clone the current battle state as the starting point for simulation
      const simulatedBattleState = cloneBattleState(battleState);

      // Initialize a fresh simulation state
      state[battleId] = {
        battleId,
        active: true,
        simulatedTurns: 0,
        playerMove: null,
        opponentMove: null,
        simulatedBattleState,
        turnResults: [],
        pendingDecisions: [],
        turnHistory: [],
        errors: [],
      };

      endTimer('(success)');
    },

    setPlayerMove: (state, action) => {
      const { battleId, move } = action.payload;

      if (!battleId || !state[battleId]?.active) {
        return;
      }

      state[battleId].playerMove = move;
    },

    setOpponentMove: (state, action) => {
      const { battleId, move } = action.payload;

      if (!battleId || !state[battleId]?.active) {
        return;
      }

      state[battleId].opponentMove = move;
    },

    updateSimulatedState: (state, action) => {
      const { battleId, simulatedBattleState, turnResults } = action.payload;

      if (!battleId || !state[battleId]?.active) {
        return;
      }

      state[battleId].simulatedBattleState = simulatedBattleState;
      state[battleId].turnResults = turnResults;
    },

    addPendingDecision: (state, action) => {
      const { battleId, decision } = action.payload;

      if (!battleId || !state[battleId]?.active) {
        return;
      }

      state[battleId].pendingDecisions.push(decision);
    },

    resolvePendingDecision: (state, action) => {
      const { battleId, decisionIndex } = action.payload;

      if (!battleId || !state[battleId]?.active) {
        return;
      }

      // Remove the resolved decision from the queue
      state[battleId].pendingDecisions.splice(decisionIndex, 1);
    },

    advanceTurn: (state, action) => {
      const endTimer = runtimer(`playAheadSlice.advanceTurn() via ${action.payload?.scope || '(anon)'}`, l);

      const { battleId } = action.payload;

      if (!battleId || !state[battleId]?.active) {
        endTimer('(invalid state)');
        return;
      }

      const playAheadState = state[battleId];

      // Save current turn to history
      if (playAheadState.playerMove && playAheadState.opponentMove && playAheadState.turnResults) {
        playAheadState.turnHistory = playAheadState.turnHistory || [];
        playAheadState.turnHistory.push({
          turn: playAheadState.simulatedTurns + 1,
          playerMove: playAheadState.playerMove,
          opponentMove: playAheadState.opponentMove,
          results: playAheadState.turnResults,
        });
      }

      // Increment turn counter
      playAheadState.simulatedTurns += 1;

      // Clear move selections for next turn
      playAheadState.playerMove = null;
      playAheadState.opponentMove = null;
      playAheadState.turnResults = [];

      endTimer('(success)');
    },

    resetSimulation: (state, action) => {
      const { battleId } = action.payload;

      if (!battleId || !state[battleId]) {
        return;
      }

      // Completely remove the simulation state for this battle
      delete state[battleId];
    },

    destroy: (state, action) => {
      const battleIds = Array.isArray(action.payload) ? action.payload : [action.payload];

      for (const battleId of battleIds) {
        if (state[battleId]) {
          delete state[battleId];
        }
      }
    },
  },
});

/**
 * Redux action creators.
 *
 * @since 1.2.6
 */
export const playAheadActions = playAheadSlice.actions;

/**
 * Type-safe hook for dispatching play-ahead actions.
 *
 * @since 1.2.6
 */
export { useDispatch as usePlayAheadDispatch } from './hooks';

/**
 * Type-safe hook for selecting play-ahead state.
 *
 * @example
 * ```ts
 * const playAheadState = usePlayAheadSelector((state) => state.playAhead['battle-gen9ou-123']);
 * ```
 *
 * @since 1.2.6
 */
export { useSelector as usePlayAheadSelector } from './hooks';
