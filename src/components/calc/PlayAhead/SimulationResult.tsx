import * as React from 'react';
import { useTranslation } from 'react-i18next';
import cx from 'classnames';
import { useColorScheme } from '@showdex/redux/store';
import { logger } from '@showdex/utils/debug';
import { usePlayAheadContext } from './usePlayAheadContext';
import styles from './SimulationResult.module.scss';

export interface SimulationResultProps {
  className?: string;
  style?: React.CSSProperties;
}

const l = logger('@showdex/components/calc/SimulationResult');

/**
 * Displays the results of a play-ahead turn simulation.
 *
 * * Shows move execution order
 * * Displays damage dealt by each move
 * * Highlights KOs and HP changes
 *
 * @since 1.2.6
 */
export const SimulationResult = ({
  className,
  style,
}: SimulationResultProps): JSX.Element => {
  const { t } = useTranslation('calcdex');
  const colorScheme = useColorScheme();

  const {
    state: playAheadState,
    isActive,
  } = usePlayAheadContext();

  const turnResults = playAheadState?.turnResults || [];
  const hasResults = isActive && turnResults.length > 0;

  if (!hasResults) {
    return null;
  }

  return (
    <div
      className={cx(
        styles.container,
        !!colorScheme && styles[colorScheme],
        className,
      )}
      style={style}
    >
      <div className={styles.header}>
        {t('playAhead.results.title', 'Turn Results')}
      </div>

      <div className={styles.results}>
        {turnResults.map((result, index) => {
          const {
            playerKey,
            moveName,
            description,
            targetFainted,
            userFainted,
            errors,
          } = result;

          const hasError = !!errors?.length;

          return (
            <div
              key={`SimulationResult:TurnResult:${index}`}
              className={cx(
                styles.moveResult,
                (targetFainted || userFainted) && styles.fainted,
                hasError && styles.error,
              )}
            >
              <div className={styles.moveHeader}>
                <div className={styles.playerLabel}>
                  {t('playAhead.results.player', '{{playerKey}}', { playerKey: playerKey.toUpperCase() })}
                </div>
                <div className={styles.moveName}>
                  {moveName}
                </div>
              </div>

              <div className={styles.description}>
                {description || t('playAhead.results.noDescription', 'No description available')}
              </div>

              {targetFainted && (
                <div className={cx(styles.status, styles.ko)}>
                  {t('playAhead.results.targetFainted', 'Target fainted!')}
                </div>
              )}

              {userFainted && (
                <div className={cx(styles.status, styles.ko)}>
                  {t('playAhead.results.userFainted', 'User fainted from recoil!')}
                </div>
              )}

              {hasError && (
                <div className={cx(styles.status, styles.errorText)}>
                  {t('playAhead.results.error', 'Error: {{error}}', { error: errors[0] })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {playAheadState?.errors?.length > 0 && (
        <div className={styles.globalErrors}>
          <div className={styles.errorHeader}>
            {t('playAhead.results.errors', 'Simulation Errors')}
          </div>
          {playAheadState.errors.map((error, index) => (
            <div
              key={`SimulationResult:Error:${index}`}
              className={styles.errorText}
            >
              {error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
