import * as React from 'react';
import { useTranslation } from 'react-i18next';
import cx from 'classnames';
import { Button, ToggleButton } from '@showdex/components/ui';
import { useColorScheme } from '@showdex/redux/store';
import { logger } from '@showdex/utils/debug';
import { useCalcdexContext } from '../CalcdexContext';
import { usePlayAheadContext } from './usePlayAheadContext';
import styles from './PlayAheadControls.module.scss';

export interface PlayAheadControlsProps {
  className?: string;
  style?: React.CSSProperties;
}

const l = logger('@showdex/components/calc/PlayAheadControls');

/**
 * Controls for the play-ahead simulation feature.
 *
 * * Enables/disables simulation mode
 * * Executes turn simulation
 * * Advances to next turn
 * * Resets simulation
 *
 * @since 1.2.6
 */
export const PlayAheadControls = ({
  className,
  style,
}: PlayAheadControlsProps): JSX.Element => {
  const { t } = useTranslation('calcdex');
  const colorScheme = useColorScheme();

  const { state: calcdexState } = useCalcdexContext();
  const {
    state: playAheadState,
    isActive,
    canExecute,
    initSimulation,
    executeSimulation,
    advanceTurn,
    resetSimulation,
  } = usePlayAheadContext();

  const {
    playerKey,
    opponentKey,
  } = calcdexState;

  // Handle enabling simulation
  const handleEnable = React.useCallback(() => {
    if (isActive) {
      // If already active, disable it
      resetSimulation('PlayAheadControls:handleEnable()');
    } else {
      // Initialize simulation with current battle state
      initSimulation(calcdexState, 'PlayAheadControls:handleEnable()');
    }
  }, [isActive, calcdexState, initSimulation, resetSimulation]);

  // Handle executing turn
  const handleExecute = React.useCallback(() => {
    if (!canExecute) {
      l.warn(
        'handleExecute() called but cannot execute',
        '\n', 'playerMove', playAheadState?.playerMove,
        '\n', 'opponentMove', playAheadState?.opponentMove,
      );
      return;
    }

    executeSimulation(
      calcdexState,
      playerKey,
      opponentKey,
      'PlayAheadControls:handleExecute()',
    );
  }, [canExecute, playAheadState, calcdexState, playerKey, opponentKey, executeSimulation]);

  // Handle advancing turn
  const handleAdvance = React.useCallback(() => {
    advanceTurn('PlayAheadControls:handleAdvance()');
  }, [advanceTurn]);

  // Handle reset
  const handleReset = React.useCallback(() => {
    resetSimulation('PlayAheadControls:handleReset()');
  }, [resetSimulation]);

  const turnsAhead = playAheadState?.simulatedTurns ?? 0;
  const hasExecuted = !!playAheadState?.turnResults?.length;

  return (
    <div
      className={cx(
        styles.container,
        !!colorScheme && styles[colorScheme],
        isActive && styles.active,
        className,
      )}
      style={style}
    >
      <div className={styles.header}>
        <div className={styles.title}>
          {t('playAhead.title', 'Play Ahead')}
        </div>
        {isActive && turnsAhead > 0 && (
          <div className={styles.turnCounter}>
            {t('playAhead.turnsAhead', 'Turn +{{count}}', { count: turnsAhead })}
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <ToggleButton
          className={styles.toggleButton}
          label={isActive
            ? t('playAhead.disable', 'Disable Simulation')
            : t('playAhead.enable', 'Enable Simulation')
          }
          active={isActive}
          onPress={handleEnable}
        />

        {isActive && (
          <>
            <Button
              className={styles.executeButton}
              label={t('playAhead.execute', 'Simulate Turn')}
              disabled={!canExecute}
              onPress={handleExecute}
            />

            {hasExecuted && (
              <>
                <Button
                  className={styles.advanceButton}
                  label={t('playAhead.advance', 'Next Turn ›')}
                  onPress={handleAdvance}
                />

                <Button
                  className={styles.resetButton}
                  theme="error"
                  label={t('playAhead.reset', 'Reset')}
                  onPress={handleReset}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
