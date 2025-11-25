import { type GenerationNum, type MoveName } from '@smogon/calc';
import {
  type CalcdexBattleState,
  type CalcdexPlayerKey,
  type PlayAheadMoveResult,
} from '@showdex/interfaces/calc';
import { cloneBattleState } from '@showdex/utils/battle';
import { calcSmogonMatchup } from '@showdex/utils/calc';
import { logger } from '@showdex/utils/debug';
import { determineMoveOrder } from './determineMoveOrder';
import { applyMoveEffects } from './applyMoveEffects';

const l = logger('@showdex/utils/playahead/simulateTurn()');

/**
 * Result of simulating a complete turn with both players' moves.
 *
 * @since 1.2.6
 */
export interface TurnSimulationResult {
  /**
   * Updated battle state after both moves have been executed.
   */
  battleState: CalcdexBattleState;

  /**
   * Results for each move executed, in order.
   *
   * * Typically has 2 elements (first move, second move).
   * * May have only 1 element if the first move causes a KO.
   */
  moveResults: PlayAheadMoveResult[];

  /**
   * Any errors that occurred during simulation.
   */
  errors?: string[];
}

/**
 * Simulates a complete turn of battle with both players selecting moves.
 *
 * * Determines move order based on priority and speed.
 * * Applies damage and effects for each move in order.
 * * Handles KOs (second move doesn't execute if first move causes a KO).
 * * Returns the updated battle state and detailed results for each move.
 *
 * @param battleState Current battle state
 * @param playerKey Player key of the user's Pokemon
 * @param opponentKey Player key of the opponent's Pokemon
 * @param playerMove Move selected by the player
 * @param opponentMove Move selected by the opponent
 * @param format Battle format or generation
 * @returns Simulation result with updated battle state and move results
 * @since 1.2.6
 */
export const simulateTurn = (
  battleState: CalcdexBattleState,
  playerKey: CalcdexPlayerKey,
  opponentKey: CalcdexPlayerKey,
  playerMove: MoveName,
  opponentMove: MoveName,
  format?: string | GenerationNum,
): TurnSimulationResult => {
  // Clone battle state to avoid mutating original
  let currentBattleState = cloneBattleState(battleState);

  const errors: string[] = [];
  const moveResults: PlayAheadMoveResult[] = [];

  // Get players and active Pokemon
  const player = currentBattleState[playerKey];
  const opponent = currentBattleState[opponentKey];

  if (!player || !opponent) {
    l.warn(
      'simulateTurn() called with invalid player keys',
      '\n', 'playerKey', playerKey,
      '\n', 'opponentKey', opponentKey,
    );

    return {
      battleState: currentBattleState,
      moveResults: [],
      errors: ['Invalid player keys'],
    };
  }

  const playerIndex = player.activeIndices?.[0] ?? player.selectionIndex ?? 0;
  const opponentIndex = opponent.activeIndices?.[0] ?? opponent.selectionIndex ?? 0;

  const playerPokemon = player.pokemon?.[playerIndex];
  const opponentPokemon = opponent.pokemon?.[opponentIndex];

  if (!playerPokemon || !opponentPokemon) {
    l.warn(
      'simulateTurn() called with no active Pokemon',
      '\n', 'playerPokemon', playerPokemon,
      '\n', 'opponentPokemon', opponentPokemon,
    );

    return {
      battleState: currentBattleState,
      moveResults: [],
      errors: ['No active Pokemon'],
    };
  }

  // Determine which Pokemon moves first
  const moveOrder = determineMoveOrder(
    format || currentBattleState.format,
    playerPokemon,
    opponentPokemon,
    playerMove,
    opponentMove,
    player,
    opponent,
    currentBattleState.field,
    [player, opponent],
  );

  l.debug(
    'Move order determined',
    '\n', 'firstPlayerKey', moveOrder.firstPlayerKey,
    '\n', 'firstMove', moveOrder.firstMove,
    '\n', 'firstPriority', moveOrder.firstPriority,
    '\n', 'firstSpeed', moveOrder.firstSpeed,
    '\n', 'reason', moveOrder.reason,
  );

  // Execute first move
  const firstMoveUser = currentBattleState[moveOrder.firstPlayerKey];
  const firstMoveTarget = currentBattleState[moveOrder.secondPlayerKey];
  const firstMoveUserIndex = firstMoveUser.activeIndices?.[0] ?? firstMoveUser.selectionIndex ?? 0;
  const firstMoveTargetIndex = firstMoveTarget.activeIndices?.[0] ?? firstMoveTarget.selectionIndex ?? 0;
  const firstMoveUserPokemon = firstMoveUser.pokemon?.[firstMoveUserIndex];
  const firstMoveTargetPokemon = firstMoveTarget.pokemon?.[firstMoveTargetIndex];

  // Calculate damage for first move
  const firstMatchup = calcSmogonMatchup(
    format || currentBattleState.format,
    currentBattleState.gameType,
    firstMoveUserPokemon,
    firstMoveTargetPokemon,
    moveOrder.firstMove,
    firstMoveUser,
    firstMoveTarget,
    [firstMoveUser, firstMoveTarget],
    currentBattleState.field,
    {}, // settings - can pass empty object for now
  );

  // Apply first move effects
  const firstMoveResult = applyMoveEffects(
    currentBattleState,
    moveOrder.firstPlayerKey,
    moveOrder.secondPlayerKey,
    moveOrder.firstMove,
    firstMatchup,
    format || currentBattleState.format,
  );

  // Update battle state with first move results
  currentBattleState = firstMoveResult.battleState;

  // Add first move result
  moveResults.push({
    pokemon: firstMoveUserPokemon,
    move: moveOrder.firstMove,
    playerKey: moveOrder.firstPlayerKey,
    damageRange: firstMatchup?.damageRange,
    damagePercent: firstMatchup?.description,
    koChance: firstMatchup?.koChance,
    movesFirst: true,
    priority: moveOrder.firstPriority,
    effectiveSpeed: moveOrder.firstSpeed,
  });

  if (firstMoveResult.errors?.length) {
    errors.push(...firstMoveResult.errors);
  }

  // If target fainted from first move, don't execute second move
  if (firstMoveResult.targetFainted) {
    l.debug('Target fainted from first move, skipping second move');

    return {
      battleState: currentBattleState,
      moveResults,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // If user fainted from first move (e.g., recoil), don't execute second move
  if (firstMoveResult.userFainted) {
    l.debug('User fainted from first move (recoil?), skipping second move');

    return {
      battleState: currentBattleState,
      moveResults,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // Execute second move
  const secondMoveUser = currentBattleState[moveOrder.secondPlayerKey];
  const secondMoveTarget = currentBattleState[moveOrder.firstPlayerKey];
  const secondMoveUserIndex = secondMoveUser.activeIndices?.[0] ?? secondMoveUser.selectionIndex ?? 0;
  const secondMoveTargetIndex = secondMoveTarget.activeIndices?.[0] ?? secondMoveTarget.selectionIndex ?? 0;
  const secondMoveUserPokemon = secondMoveUser.pokemon?.[secondMoveUserIndex];
  const secondMoveTargetPokemon = secondMoveTarget.pokemon?.[secondMoveTargetIndex];

  // Calculate damage for second move
  const secondMatchup = calcSmogonMatchup(
    format || currentBattleState.format,
    currentBattleState.gameType,
    secondMoveUserPokemon,
    secondMoveTargetPokemon,
    moveOrder.secondMove,
    secondMoveUser,
    secondMoveTarget,
    [secondMoveUser, secondMoveTarget],
    currentBattleState.field,
    {}, // settings
  );

  // Apply second move effects
  const secondMoveResult = applyMoveEffects(
    currentBattleState,
    moveOrder.secondPlayerKey,
    moveOrder.firstPlayerKey,
    moveOrder.secondMove,
    secondMatchup,
    format || currentBattleState.format,
  );

  // Update battle state with second move results
  currentBattleState = secondMoveResult.battleState;

  // Add second move result
  moveResults.push({
    pokemon: secondMoveUserPokemon,
    move: moveOrder.secondMove,
    playerKey: moveOrder.secondPlayerKey,
    damageRange: secondMatchup?.damageRange,
    damagePercent: secondMatchup?.description,
    koChance: secondMatchup?.koChance,
    movesFirst: false,
    priority: moveOrder.secondPriority,
    effectiveSpeed: moveOrder.secondSpeed,
  });

  if (secondMoveResult.errors?.length) {
    errors.push(...secondMoveResult.errors);
  }

  return {
    battleState: currentBattleState,
    moveResults,
    errors: errors.length > 0 ? errors : undefined,
  };
};
