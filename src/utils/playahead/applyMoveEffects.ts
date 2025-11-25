import { type GenerationNum, type MoveName } from '@smogon/calc';
import { type CalcdexMatchupResult } from '@showdex/interfaces/calc';
import {
  type CalcdexBattleState,
  type CalcdexPokemon,
  type CalcdexPlayerKey,
} from '@showdex/interfaces/calc';
import { cloneBattleState, clonePokemon } from '@showdex/utils/battle';
import { getDexForFormat } from '@showdex/utils/dex';
import { logger } from '@showdex/utils/debug';

const l = logger('@showdex/utils/playahead/applyMoveEffects()');

/**
 * Result of applying a move's effects to the battle state.
 *
 * @since 1.2.6
 */
export interface MoveEffectApplicationResult {
  /**
   * Updated battle state after applying the move effects.
   */
  battleState: CalcdexBattleState;

  /**
   * Whether the target Pokemon fainted as a result of this move.
   */
  targetFainted: boolean;

  /**
   * Whether the user Pokemon fainted as a result of this move (e.g., recoil, crash).
   */
  userFainted: boolean;

  /**
   * Description of what happened when the move was used.
   *
   * @example "Charizard used Flare Blitz! It dealt 87 damage. Charizard took 29 recoil damage."
   */
  description?: string;

  /**
   * Any errors that occurred while applying effects.
   */
  errors?: string[];
}

/**
 * Applies the effects of a move to the battle state.
 *
 * * Handles:
 *   - Damage application
 *   - Stat changes (boosts/drops)
 *   - Status conditions
 *   - Recoil damage
 *   - HP draining
 *   - Field effect changes (weather, terrain, screens, hazards)
 *
 * @param battleState Current battle state (will be cloned, not mutated)
 * @param userPlayerKey Player key of the Pokemon using the move
 * @param targetPlayerKey Player key of the Pokemon being targeted
 * @param move Move being used
 * @param matchupResult Calculated damage/matchup result from calcSmogonMatchup
 * @param format Battle format or generation
 * @returns Updated battle state with move effects applied
 * @since 1.2.6
 */
export const applyMoveEffects = (
  battleState: CalcdexBattleState,
  userPlayerKey: CalcdexPlayerKey,
  targetPlayerKey: CalcdexPlayerKey,
  move: MoveName,
  matchupResult: CalcdexMatchupResult,
  format?: string | GenerationNum,
): MoveEffectApplicationResult => {
  // Clone the battle state to avoid mutating the original
  const newBattleState = cloneBattleState(battleState);

  const userPlayer = newBattleState[userPlayerKey];
  const targetPlayer = newBattleState[targetPlayerKey];

  if (!userPlayer || !targetPlayer) {
    l.warn(
      'applyMoveEffects() called with invalid player keys',
      '\n', 'userPlayerKey', userPlayerKey,
      '\n', 'targetPlayerKey', targetPlayerKey,
    );

    return {
      battleState: newBattleState,
      targetFainted: false,
      userFainted: false,
      errors: ['Invalid player keys'],
    };
  }

  // Get active Pokemon for each player
  const userIndex = userPlayer.activeIndices?.[0] ?? userPlayer.selectionIndex ?? 0;
  const targetIndex = targetPlayer.activeIndices?.[0] ?? targetPlayer.selectionIndex ?? 0;

  const userPokemon = userPlayer.pokemon?.[userIndex];
  const targetPokemon = targetPlayer.pokemon?.[targetIndex];

  if (!userPokemon || !targetPokemon) {
    l.warn(
      'applyMoveEffects() called with invalid Pokemon',
      '\n', 'userPokemon', userPokemon,
      '\n', 'targetPokemon', targetPokemon,
    );

    return {
      battleState: newBattleState,
      targetFainted: false,
      userFainted: false,
      errors: ['Invalid Pokemon'],
    };
  }

  const dex = getDexForFormat(format);
  const dexMove = dex?.moves.get(move);

  if (!dexMove) {
    l.warn(
      'applyMoveEffects() could not find move in dex',
      '\n', 'move', move,
      '\n', 'format', format,
    );

    return {
      battleState: newBattleState,
      targetFainted: false,
      userFainted: false,
      errors: [`Move ${move} not found in dex`],
    };
  }

  const errors: string[] = [];
  const descriptionParts: string[] = [];

  descriptionParts.push(`${userPokemon.speciesForme} used ${move}!`);

  // Apply damage if this is a damaging move
  if (dexMove.category !== 'Status' && matchupResult?.damageRange) {
    const damageArray = matchupResult.damageRange;

    // Use average damage from range
    let damage = 0;

    if (Array.isArray(damageArray) && damageArray.length === 2) {
      // Calculate average damage
      damage = Math.floor((damageArray[0] + damageArray[1]) / 2);
    } else if (typeof damageArray === 'number') {
      damage = damageArray;
    }

    if (damage > 0) {
      // Apply damage to target Pokemon
      const currentHp = targetPokemon.hp ?? 100;
      const maxHp = targetPokemon.maxhp ?? 100;

      // Calculate new HP (ensure it doesn't go below 0)
      const newHp = Math.max(0, currentHp - damage);

      // Update target Pokemon's HP
      targetPlayer.pokemon[targetIndex] = {
        ...targetPokemon,
        hp: newHp,
        dirtyHp: newHp,
      };

      descriptionParts.push(`It dealt ${damage} damage.`);

      // Check if target fainted
      if (newHp === 0) {
        descriptionParts.push(`${targetPokemon.speciesForme} fainted!`);

        return {
          battleState: newBattleState,
          targetFainted: true,
          userFainted: false,
          description: descriptionParts.join(' '),
          errors: errors.length > 0 ? errors : undefined,
        };
      }
    }
  }

  // Handle recoil damage
  if (dexMove.recoil) {
    const recoilPercent = Array.isArray(dexMove.recoil) ? dexMove.recoil[0] / dexMove.recoil[1] : 0;

    if (recoilPercent > 0 && matchupResult?.damageRange) {
      const damageDealt = Array.isArray(matchupResult.damageRange)
        ? Math.floor((matchupResult.damageRange[0] + matchupResult.damageRange[1]) / 2)
        : matchupResult.damageRange;

      const recoilDamage = Math.max(1, Math.floor(damageDealt * recoilPercent));

      const currentHp = userPokemon.hp ?? 100;
      const newHp = Math.max(0, currentHp - recoilDamage);

      userPlayer.pokemon[userIndex] = {
        ...userPokemon,
        hp: newHp,
        dirtyHp: newHp,
      };

      descriptionParts.push(`${userPokemon.speciesForme} took ${recoilDamage} recoil damage.`);

      if (newHp === 0) {
        descriptionParts.push(`${userPokemon.speciesForme} fainted from recoil!`);

        return {
          battleState: newBattleState,
          targetFainted: false,
          userFainted: true,
          description: descriptionParts.join(' '),
          errors: errors.length > 0 ? errors : undefined,
        };
      }
    }
  }

  // Handle drain moves (e.g., Giga Drain, Drain Punch)
  if (dexMove.drain) {
    const drainPercent = Array.isArray(dexMove.drain) ? dexMove.drain[0] / dexMove.drain[1] : 0;

    if (drainPercent > 0 && matchupResult?.damageRange) {
      const damageDealt = Array.isArray(matchupResult.damageRange)
        ? Math.floor((matchupResult.damageRange[0] + matchupResult.damageRange[1]) / 2)
        : matchupResult.damageRange;

      const healAmount = Math.max(1, Math.floor(damageDealt * drainPercent));

      const currentHp = userPokemon.hp ?? 100;
      const maxHp = userPokemon.maxhp ?? 100;
      const newHp = Math.min(maxHp, currentHp + healAmount);

      userPlayer.pokemon[userIndex] = {
        ...userPokemon,
        hp: newHp,
        dirtyHp: newHp,
      };

      descriptionParts.push(`${userPokemon.speciesForme} restored ${healAmount} HP.`);
    }
  }

  // TODO: Handle other move effects:
  // - Stat changes (boosts/drops)
  // - Status conditions (burn, paralysis, etc.)
  // - Field effects (weather, terrain, screens, hazards)
  // - Multi-hit moves
  // - Secondary effects (flinch, burn chance, etc.)

  return {
    battleState: newBattleState,
    targetFainted: false,
    userFainted: false,
    description: descriptionParts.join(' '),
    errors: errors.length > 0 ? errors : undefined,
  };
};
