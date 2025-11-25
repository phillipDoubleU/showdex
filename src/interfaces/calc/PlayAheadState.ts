import { type MoveName } from '@smogon/calc';
import { type CalcdexBattleState } from './CalcdexBattleState';
import { type CalcdexPokemon } from './CalcdexPokemon';
import { type CalcdexPlayerKey } from './CalcdexPlayerKey';

/**
 * Result of a simulated move in the play-ahead system.
 *
 * @since 1.2.6
 */
export interface PlayAheadMoveResult {
  /**
   * The Pokemon that used the move.
   */
  pokemon: CalcdexPokemon;

  /**
   * The move that was used.
   */
  move: MoveName;

  /**
   * Player key of the Pokemon that used the move.
   */
  playerKey: CalcdexPlayerKey;

  /**
   * Calculated damage range (e.g., [85, 100] meaning 85-100 HP damage).
   */
  damageRange?: number[];

  /**
   * Damage percentage string (e.g., "38.2-45.1%").
   */
  damagePercent?: string;

  /**
   * KO chance description (e.g., "guaranteed 2HKO", "possible OHKO").
   */
  koChance?: string;

  /**
   * Whether this move goes first based on priority/speed.
   */
  movesFirst?: boolean;

  /**
   * Priority value of the move (-7 to +5).
   */
  priority?: number;

  /**
   * Calculated effective speed for move order determination.
   */
  effectiveSpeed?: number;
}

/**
 * Pending user decision for edge cases in simulation.
 *
 * @since 1.2.6
 */
export interface PlayAheadPendingDecision {
  /**
   * Type of decision required from the user.
   */
  type:
    | 'switch-in'        // User must select which Pokemon switches in (U-turn, Volt Switch, etc.)
    | 'random-effect'    // User must decide if a random effect occurs (Scald burn, flinch, etc.)
    | 'multi-hit'        // User must decide how many times a multi-hit move hits
    | 'focus-sash'       // User must decide if Focus Sash activates
    | 'berry-activation' // User must decide if a berry activates
    | 'ability-trigger'; // User must decide if an ability triggers

  /**
   * Which player this decision is for.
   */
  playerKey: CalcdexPlayerKey;

  /**
   * The move that triggered this decision.
   */
  moveName?: MoveName;

  /**
   * Description of what the user needs to decide.
   *
   * @example "Does Scald burn the opponent? (30% chance)"
   * @example "Which Pokemon does the opponent switch to after Volt Switch?"
   */
  description: string;

  /**
   * Additional metadata specific to the decision type.
   */
  metadata?: {
    /**
     * For 'switch-in': indices of available Pokemon to switch to.
     */
    availablePokemonIndices?: number[];

    /**
     * For 'random-effect': probability of the effect occurring.
     *
     * @example 0.3 for 30% burn chance
     */
    probability?: number;

    /**
     * For 'random-effect': name of the effect.
     *
     * @example "burn", "paralysis", "flinch"
     */
    effectName?: string;

    /**
     * For 'multi-hit': range of possible hits.
     *
     * @example [2, 5] for moves that hit 2-5 times
     */
    hitRange?: [number, number];

    /**
     * For 'berry-activation' or 'ability-trigger': name of item/ability.
     */
    triggerName?: string;
  };
}

/**
 * Complete state for the play-ahead simulation system.
 *
 * * Allows users to select moves for both players and simulate the turn outcome.
 * * Supports chaining multiple simulated turns to "play ahead" of the actual battle.
 * * State is temporary and can be reset at any time.
 *
 * @since 1.2.6
 */
export interface PlayAheadState {
  /**
   * Battle ID that this simulation is for.
   *
   * * Corresponds to the `battleId` in `CalcdexBattleState`.
   * * If `null`, simulation is inactive.
   */
  battleId?: string;

  /**
   * Whether simulation mode is currently active.
   *
   * * When `true`, the UI shows simulation controls and displays simulated state.
   * * When `false`, simulation state is hidden and can be discarded.
   *
   * @default false
   */
  active: boolean;

  /**
   * Number of simulated turns that have been executed.
   *
   * * Starts at `0` when simulation begins.
   * * Increments each time the user advances a turn.
   * * Displayed to the user as "Turn +N" to show how many turns ahead they are.
   *
   * @default 0
   */
  simulatedTurns: number;

  /**
   * The player's selected move for the current simulated turn.
   *
   * * User selects this from their Pokemon's moveset.
   * * `null` if no move selected yet.
   */
  playerMove?: MoveName;

  /**
   * The opponent's selected move for the current simulated turn.
   *
   * * User selects this from opponent's moveset.
   * * `null` if no move selected yet.
   */
  opponentMove?: MoveName;

  /**
   * Simulated battle state after applying all turns.
   *
   * * This is a deep clone of the current `CalcdexBattleState`.
   * * All simulated changes are applied to this state (HP, boosts, status, etc.).
   * * Displayed alongside or instead of the live battle state in the UI.
   */
  simulatedBattleState?: CalcdexBattleState;

  /**
   * Results of the most recent simulated turn.
   *
   * * Contains move order, damage dealt, and outcomes.
   * * Displayed to the user to show what would happen.
   * * Array typically has 2 elements (player move result, opponent move result).
   *   - If one Pokemon faints before moving, array may have only 1 element.
   */
  turnResults?: PlayAheadMoveResult[];

  /**
   * Pending decisions required from the user before simulation can proceed.
   *
   * * For example, if U-turn is used, user must select which Pokemon to switch in.
   * * Simulation is paused until all pending decisions are resolved.
   * * Empty array means no decisions pending.
   *
   * @default []
   */
  pendingDecisions: PlayAheadPendingDecision[];

  /**
   * History of all simulated turns for this session.
   *
   * * Allows user to see what happened in each simulated turn.
   * * Could be used for undo/redo functionality in the future.
   * * Each element contains the turn number and results.
   *
   * @default []
   */
  turnHistory?: Array<{
    /**
     * Turn number (1, 2, 3, etc.).
     */
    turn: number;

    /**
     * Player move used this turn.
     */
    playerMove: MoveName;

    /**
     * Opponent move used this turn.
     */
    opponentMove: MoveName;

    /**
     * Results of this turn's simulation.
     */
    results: PlayAheadMoveResult[];
  }>;

  /**
   * Errors that occurred during simulation, if any.
   *
   * * Could include unsupported moves, calculation failures, etc.
   * * Displayed to the user as warnings.
   */
  errors?: string[];
}
