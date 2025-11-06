import database from '@/db';
import Settings from '@/db/models/Settings';

export async function updateTimerDuration(duration: number | null) {
  await database.write(async () => {
    const settingsCollection =
      database.collections.get<Settings>('settings');
    // Assuming there's only one settings record, or we need to find the correct one
    const settingsRecord = await settingsCollection.query().fetch();

    if (settingsRecord.length > 0) {
      await settingsRecord[0].update((record) => {
        record.timerDuration = duration;
      });
    } else {
      // Handle case where no settings record exists, if necessary
      console.warn('No settings record found to update timerDuration.');
    }
  });
}

export async function updateCustomTimer(
  hours: number | null,
  minutes: number | null
) {
  await database.write(async () => {
    const settingsCollection =
      database.collections.get<Settings>('settings');
    const settingsRecord = await settingsCollection.query().fetch();

    if (settingsRecord.length > 0) {
      await settingsRecord[0].update((record) => {
        record.customTimer =
          hours !== null && minutes !== null ? hours * 60 + minutes : null;
      });
    } else {
      console.warn('No settings record found to update customTimer.');
    }
  });
}

export async function updateTimerActive(active: boolean) {
  await database.write(async () => {
    const settingsCollection =
      database.collections.get<Settings>('settings');
    const settingsRecord = await settingsCollection.query().fetch();

    if (settingsRecord.length > 0) {
      await settingsRecord[0].update((record) => {
        record.timerActive = active;
      });
    } else {
      console.warn('No settings record found to update timerActive.');
    }
  });
}

export async function getTimerSettings() {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    const settings = settingsRecord[0];
    return {
      timerDuration: settings.timerDuration,
      timerActive: settings.timerActive,
    };
  }
  return { timerDuration: null, timerActive: false };
}
