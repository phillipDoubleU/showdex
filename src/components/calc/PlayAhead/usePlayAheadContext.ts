import * as React from 'react';
import { type MoveName } from '@smogon/calc';
import {
  type CalcdexBattleState,
  type CalcdexPlayerKey,
  type PlayAheadPendingDecision,
} from '@showdex/interfaces/calc';
import { playAheadActions, useDispatch } from '@showdex/redux/store';
import { simulateTurn } from '@showdex/utils/playahead';
import { logger } from '@showdex/utils/debug';
import { type PlayAheadContextValue, PlayAheadContext } from './PlayAheadContext';

const l = logger('@showdex/components/calc/usePlayAheadContext()');

/**
 * PlayAhead Context value with abstracted dispatchers.
 *
 * @since 1.2.6
 */
export interface PlayAheadContextConsumables extends PlayAheadContextValue {
  /**
   * Initializes a new simulation for the battle.
   *
   * @param battleState Current battle state to clone as simulation starting point
   * @param scope Optional scope string for debugging
   */
  initSimulation: (battleState: CalcdexBattleState, scope?: string) => void;

  /**
   * Sets the player's selected move for simulation.
   *
   * @param move Move to select
   * @param scope Optional scope string for debugging
   */
  setPlayerMove: (move: MoveName, scope?: string) => void;

  /**
   * Sets the opponent's selected move for simulation.
   *
   * @param move Move to select
   * @param scope Optional scope string for debugging
   */
  setOpponentMove: (move: MoveName, scope?: string) => void;

  /**
   * Executes the simulation with currently selected moves.
   *
   * * Requires both player and opponent moves to be selected.
   * * Updates the simulated battle state with results.
   *
   * @param currentBattleState Current battle state (for re-calculating if needed)
   * @param playerKey Player key for the user
   * @param opponentKey Player key for the opponent
   * @param scope Optional scope string for debugging
   */
  executeSimulation: (
    currentBattleState: CalcdexBattleState,
    playerKey: CalcdexPlayerKey,
    opponentKey: CalcdexPlayerKey,
    scope?: string,
  ) => void;

  /**
   * Adds a pending decision that requires user input.
   *
   * @param decision Decision to add
   * @param scope Optional scope string for debugging
   */
  addPendingDecision: (decision: PlayAheadPendingDecision, scope?: string) => void;

  /**
   * Resolves a pending decision.
   *
   * @param decisionIndex Index of the decision to resolve
   * @param resolution Resolution data (type depends on decision type)
   * @param scope Optional scope string for debugging
   */
  resolvePendingDecision: (decisionIndex: number, resolution: any, scope?: string) => void;

  /**
   * Advances to the next simulated turn.
   *
   * * Increments turn counter.
   * * Clears move selections.
   * * Adds current turn to history.
   *
   * @param scope Optional scope string for debugging
   */
  advanceTurn: (scope?: string) => void;

  /**
   * Resets and discards the simulation.
   *
   * * Deactivates simulation mode.
   * * Clears all simulated state.
   *
   * @param scope Optional scope string for debugging
   */
  resetSimulation: (scope?: string) => void;

  /**
   * Whether simulation is currently active.
   */
  readonly isActive: boolean;

  /**
   * Whether both moves have been selected (ready to execute).
   */
  readonly canExecute: boolean;

  /**
   * Number of pending decisions.
   */
  readonly pendingDecisionCount: number;
}

/**
 * Hook for consuming PlayAheadContext with dispatch functions.
 *
 * * Provides functions to control simulation (init, execute, advance, reset).
 * * Automatically handles Redux dispatching.
 *
 * @since 1.2.6
 */
export const usePlayAheadContext = (): PlayAheadContextConsumables => {
  const ctx = React.useContext(PlayAheadContext);
  const dispatch = useDispatch();

  const { state, battleId } = ctx;

  // Initialize simulation
  const initSimulation = React.useCallback(
    (battleState: CalcdexBattleState, scope?: string) => {
      dispatch(playAheadActions.initSimulation({
        battleId,
        battleState,
        scope: scope || 'usePlayAheadContext:initSimulation()',
      }));
    },
    [dispatch, battleId],
  );

  // Set player move
  const setPlayerMove = React.useCallback(
    (move: MoveName, scope?: string) => {
      dispatch(playAheadActions.setPlayerMove({
        battleId,
        move,
        scope: scope || 'usePlayAheadContext:setPlayerMove()',
      }));
    },
    [dispatch, battleId],
  );

  // Set opponent move
  const setOpponentMove = React.useCallback(
    (move: MoveName, scope?: string) => {
      dispatch(playAheadActions.setOpponentMove({
        battleId,
        move,
        scope: scope || 'usePlayAheadContext:setOpponentMove()',
      }));
    },
    [dispatch, battleId],
  );

  // Execute simulation
  const executeSimulation = React.useCallback(
    (
      currentBattleState: CalcdexBattleState,
      playerKey: CalcdexPlayerKey,
      opponentKey: CalcdexPlayerKey,
      scope?: string,
    ) => {
      if (!state?.playerMove || !state?.opponentMove) {
        l.warn(
          'executeSimulation() called without both moves selected',
          '\n', 'playerMove', state?.playerMove,
          '\n', 'opponentMove', state?.opponentMove,
        );
        return;
      }

      // Use the simulated battle state if it exists, otherwise use current
      const battleStateToUse = state.simulatedBattleState || currentBattleState;

      // Run the simulation
      const result = simulateTurn(
        battleStateToUse,
        playerKey,
        opponentKey,
        state.playerMove,
        state.opponentMove,
        currentBattleState.format,
      );

      // Update Redux with results
      dispatch(playAheadActions.updateSimulatedState({
        battleId,
        simulatedBattleState: result.battleState,
        turnResults: result.moveResults,
        scope: scope || 'usePlayAheadContext:executeSimulation()',
      }));

      if (result.errors?.length) {
        l.warn(
          'Simulation completed with errors',
          '\n', 'errors', result.errors,
        );
      }
    },
    [dispatch, battleId, state],
  );

  // Add pending decision
  const addPendingDecision = React.useCallback(
    (decision: PlayAheadPendingDecision, scope?: string) => {
      dispatch(playAheadActions.addPendingDecision({
        battleId,
        decision,
        scope: scope || 'usePlayAheadContext:addPendingDecision()',
      }));
    },
    [dispatch, battleId],
  );

  // Resolve pending decision
  const resolvePendingDecision = React.useCallback(
    (decisionIndex: number, resolution: any, scope?: string) => {
      dispatch(playAheadActions.resolvePendingDecision({
        battleId,
        decisionIndex,
        resolution,
        scope: scope || 'usePlayAheadContext:resolvePendingDecision()',
      }));
    },
    [dispatch, battleId],
  );

  // Advance turn
  const advanceTurn = React.useCallback(
    (scope?: string) => {
      dispatch(playAheadActions.advanceTurn({
        battleId,
        scope: scope || 'usePlayAheadContext:advanceTurn()',
      }));
    },
    [dispatch, battleId],
  );

  // Reset simulation
  const resetSimulation = React.useCallback(
    (scope?: string) => {
      dispatch(playAheadActions.resetSimulation({
        battleId,
        scope: scope || 'usePlayAheadContext:resetSimulation()',
      }));
    },
    [dispatch, battleId],
  );

  // Computed properties
  const isActive = state?.active ?? false;
  const canExecute = !!(state?.playerMove && state?.opponentMove);
  const pendingDecisionCount = state?.pendingDecisions?.length ?? 0;

  return {
    ...ctx,
    initSimulation,
    setPlayerMove,
    setOpponentMove,
    executeSimulation,
    addPendingDecision,
    resolvePendingDecision,
    advanceTurn,
    resetSimulation,
    isActive,
    canExecute,
    pendingDecisionCount,
  };
};
