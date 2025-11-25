import * as React from 'react';
import { type PlayAheadState } from '@showdex/interfaces/calc';

/**
 * State stored in the PlayAhead Context.
 *
 * @since 1.2.6
 */
export interface PlayAheadContextValue {
  /**
   * The current play-ahead simulation state for this battle.
   *
   * * Will be `null` if no simulation is active.
   */
  state: PlayAheadState | null;

  /**
   * Battle ID this context is for.
   */
  battleId: string;
}

export const PlayAheadContext = React.createContext<PlayAheadContextValue>({
  state: null,
  battleId: '',
});
