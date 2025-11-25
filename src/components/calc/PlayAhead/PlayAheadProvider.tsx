import * as React from 'react';
import { useSelector } from '@showdex/redux/store';
import { PlayAheadContext } from './PlayAheadContext';

export interface PlayAheadProviderProps {
  /**
   * Battle ID to provide play-ahead state for.
   */
  battleId: string;

  /**
   * Child components that will consume the PlayAheadContext.
   */
  children: React.ReactNode;
}

/**
 * Provider component for PlayAheadContext.
 *
 * * Connects to Redux to provide play-ahead state for a specific battle.
 * * Should be wrapped around components that need access to simulation controls.
 *
 * @since 1.2.6
 */
export const PlayAheadProvider = ({
  battleId,
  children,
}: PlayAheadProviderProps): JSX.Element => {
  // Subscribe to play-ahead state from Redux
  const playAheadState = useSelector((state) => state.playAhead?.[battleId] || null);

  const contextValue = React.useMemo(
    () => ({
      state: playAheadState,
      battleId,
    }),
    [playAheadState, battleId],
  );

  return (
    <PlayAheadContext.Provider value={contextValue}>
      {children}
    </PlayAheadContext.Provider>
  );
};
