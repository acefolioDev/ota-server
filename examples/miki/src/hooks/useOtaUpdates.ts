import * as Updates from 'expo-updates';
import { useState } from 'react';
import { showMikiAlert } from '../components/MikiAlert';

export function useOtaUpdates() {
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  async function checkForUpdate(isAutomaticCheck = false) {
    if (!Updates.isEnabled) {
      showMikiAlert({
        title: 'Updates are resting',
        message: 'Install a release build with the Miki OTA configuration to check for updates.',
        tone: 'update',
      });
      return;
    }

    setIsCheckingUpdates(true);
    try {
      const update = await Updates.checkForUpdateAsync();

      if (!update.isAvailable) {
        if (!isAutomaticCheck) {
          showMikiAlert({
            title: 'You’re all caught up',
            message: 'There are no new Miki updates right now.',
            tone: 'good',
          });
        }
        return;
      }

      const result = await Updates.fetchUpdateAsync();
      if (result.isNew) {
        await Updates.reloadAsync();
      } else {
        showMikiAlert({
          title: 'That one slipped away',
          message: 'The update could not be downloaded.',
          tone: 'update',
        });
      }
    } catch (error) {
      showMikiAlert({
        title: 'Couldn’t check just now',
        message: error instanceof Error ? error.message : 'Could not check for an update.',
        tone: 'note',
      });
    } finally {
      setIsCheckingUpdates(false);
    }
  }

  return { isCheckingUpdates, checkForUpdate };
}
