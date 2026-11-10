import * as Updates from 'expo-updates';
import { useState } from 'react';
import { showMikiAlert } from '../components/MikiAlert';
import {
  beginUpdateApply,
  beginUpdateDownload,
  mikiReloadScreen,
  resetUpdateDownload,
} from '../components/UpdateDownload';

export type UpdateStatus = 'idle' | 'checking' | 'downloading';

export function useOtaUpdates() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');

  async function checkForUpdate(isAutomaticCheck = false) {
    if (!Updates.isEnabled) {
      showMikiAlert({
        title: 'Updates are resting',
        message: 'Install a release build with the Miki OTA configuration to check for updates.',
        tone: 'update',
      });
      return;
    }

    setUpdateStatus('checking');
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

      beginUpdateDownload();
      setUpdateStatus('downloading');
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew) {
        beginUpdateApply();
        await Updates.reloadAsync({ reloadScreenOptions: mikiReloadScreen });
        return;
      }

      resetUpdateDownload();
      showMikiAlert({
        title: 'That one slipped away',
        message: 'The update could not be downloaded.',
        tone: 'update',
      });
    } catch (error) {
      resetUpdateDownload();
      showMikiAlert({
        title: 'Couldn’t check just now',
        message: error instanceof Error ? error.message : 'Could not check for an update.',
        tone: 'note',
      });
    } finally {
      setUpdateStatus('idle');
    }
  }

  return { updateStatus, isCheckingUpdates: updateStatus !== 'idle', checkForUpdate };
}
