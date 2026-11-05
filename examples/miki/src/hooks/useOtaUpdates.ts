import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Alert } from 'react-native';

export function useOtaUpdates() {
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  async function checkForUpdate() {
    if (!Updates.isEnabled) {
      Alert.alert(
        'Updates unavailable',
        'Install a release build with the Miki OTA configuration to check for updates.',
      );
      return;
    }

    setIsCheckingUpdates(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) {
        Alert.alert('You’re up to date', 'There are no new Miki updates right now.');
        return;
      }

      const result = await Updates.fetchUpdateAsync();
      if (result.isNew) {
        await Updates.reloadAsync();
      } else {
        Alert.alert('Update unavailable', 'The update could not be downloaded.');
      }
    } catch (error) {
      Alert.alert(
        'Update check failed',
        error instanceof Error ? error.message : 'Could not check for an update.',
      );
    } finally {
      setIsCheckingUpdates(false);
    }
  }

  return { isCheckingUpdates, checkForUpdate };
}
