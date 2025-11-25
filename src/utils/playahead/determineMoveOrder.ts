import { type GenerationNum, type MoveName } from '@smogon/calc';
import {
  type CalcdexBattleField,
  type CalcdexPlayer,
  type CalcdexPlayerKey,
  type CalcdexPokemon,
} from '@showdex/interfaces/calc';
import { getDexForFormat } from '@showdex/utils/dex';
import { calcPokemonFinalStats } from '@showdex/utils/calc';

/**
 * Information about which Pokemon moves first and why.
 *
 * @since 1.2.6
 */
export interface MoveOrderInfo {
  /**
   * Player key of the Pokemon that moves first.
   */
  firstPlayerKey: CalcdexPlayerKey;

  /**
   * Player key of the Pokemon that moves second.
   */
  secondPlayerKey: CalcdexPlayerKey;

  /**
   * The move that goes first.
   */
  firstMove: MoveName;

  /**
   * The move that goes second.
   */
  secondMove: MoveName;

  /**
   * Priority value of the first move.
   */
  firstPriority: number;

  /**
   * Priority value of the second move.
   */
  secondPriority: number;

  /**
   * Effective speed of the first Pokemon (after all modifiers).
   */
  firstSpeed: number;

  /**
   * Effective speed of the second Pokemon (after all modifiers).
   */
  secondSpeed: number;

  /**
   * Reason why the first Pokemon moves first.
   *
   * * `'priority'` - First move has higher priority
   * * `'speed'` - First Pokemon is faster
   * * `'trick-room'` - First Pokemon is slower (Trick Room active)
   * * `'random'` - Speed tie, randomly chosen
   */
  reason: 'priority' | 'speed' | 'trick-room' | 'random';
}

/**
 * Determines which Pokemon moves first based on move priority and effective speed.
 *
 * * Takes into account:
 *   - Move priority brackets (-7 to +5)
 *   - Effective speed after all modifiers (items, abilities, status, field conditions)
 *   - Trick Room (reverses speed order)
 *   - Speed ties (randomly decided, 50/50)
 *
 * @since 1.2.6
 */
export const determineMoveOrder = (
  format: string | GenerationNum,
  p1Pokemon: CalcdexPokemon,
  p2Pokemon: CalcdexPokemon,
  p1Move: MoveName,
  p2Move: MoveName,
  p1Player?: CalcdexPlayer,
  p2Player?: CalcdexPlayer,
  field?: CalcdexBattleField,
  allPlayers?: CalcdexPlayer[],
): MoveOrderInfo => {
  const dex = getDexForFormat(format);

  // Get move data from dex
  const p1DexMove = dex?.moves.get(p1Move);
  const p2DexMove = dex?.moves.get(p2Move);

  // Get move priorities (default to 0 if not found)
  const p1Priority = p1DexMove?.priority ?? 0;
  const p2Priority = p2DexMove?.priority ?? 0;

  // Calculate effective speed for both Pokemon
  const p1StatsRecord = calcPokemonFinalStats(
    format,
    p1Pokemon,
    p2Pokemon,
    p1Player,
    p2Player,
    field,
    allPlayers,
  );

  const p2StatsRecord = calcPokemonFinalStats(
    format,
    p2Pokemon,
    p1Pokemon,
    p2Player,
    p1Player,
    field,
    allPlayers,
  );

  const p1Speed = p1StatsRecord.stats()?.spe ?? 0;
  const p2Speed = p2StatsRecord.stats()?.spe ?? 0;

  const p1Key = p1Pokemon.playerKey || 'p1';
  const p2Key = p2Pokemon.playerKey || 'p2';

  // Priority moves always go first
  if (p1Priority !== p2Priority) {
    const firstPlayerKey = p1Priority > p2Priority ? p1Key : p2Key;
    const secondPlayerKey = p1Priority > p2Priority ? p2Key : p1Key;

    return {
      firstPlayerKey,
      secondPlayerKey,
      firstMove: p1Priority > p2Priority ? p1Move : p2Move,
      secondMove: p1Priority > p2Priority ? p2Move : p1Move,
      firstPriority: Math.max(p1Priority, p2Priority),
      secondPriority: Math.min(p1Priority, p2Priority),
      firstSpeed: p1Priority > p2Priority ? p1Speed : p2Speed,
      secondSpeed: p1Priority > p2Priority ? p2Speed : p1Speed,
      reason: 'priority',
    };
  }

  // If priorities are equal, determine by speed
  // Check if Trick Room is active (reverses speed order)
  const isTrickRoom = field?.isTrickRoom ?? false;

  // Speed tie handling
  if (p1Speed === p2Speed) {
    // 50/50 random - using Math.random() for simplicity
    const p1GoesFirst = Math.random() < 0.5;

    return {
      firstPlayerKey: p1GoesFirst ? p1Key : p2Key,
      secondPlayerKey: p1GoesFirst ? p2Key : p1Key,
      firstMove: p1GoesFirst ? p1Move : p2Move,
      secondMove: p1GoesFirst ? p2Move : p1Move,
      firstPriority: p1Priority,
      secondPriority: p2Priority,
      firstSpeed: p1Speed,
      secondSpeed: p2Speed,
      reason: 'random',
    };
  }

  // Normal speed comparison
  let p1GoesFirst: boolean;

  if (isTrickRoom) {
    // In Trick Room, slower Pokemon goes first
    p1GoesFirst = p1Speed < p2Speed;
  } else {
    // Normally, faster Pokemon goes first
    p1GoesFirst = p1Speed > p2Speed;
  }

  return {
    firstPlayerKey: p1GoesFirst ? p1Key : p2Key,
    secondPlayerKey: p1GoesFirst ? p2Key : p1Key,
    firstMove: p1GoesFirst ? p1Move : p2Move,
    secondMove: p1GoesFirst ? p2Move : p1Move,
    firstPriority: p1Priority,
    secondPriority: p2Priority,
    firstSpeed: p1GoesFirst ? p1Speed : p2Speed,
    secondSpeed: p1GoesFirst ? p2Speed : p1Speed,
    reason: isTrickRoom ? 'trick-room' : 'speed',
  };
};
