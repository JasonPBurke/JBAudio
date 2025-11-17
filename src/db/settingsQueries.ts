import database from '@/db';
import Settings from '@/db/models/Settings';

export async function updateSleepTime(duration: number | null) {
  await database.write(async () => {
    const settingsCollection =
      database.collections.get<Settings>('settings');

    const settingsRecord = await settingsCollection.query().fetch();

    if (settingsRecord.length > 0) {
      await settingsRecord[0].update((record) => {
        record.sleepTime = duration;
      });
    } else {
      console.warn('No settings record found to update sleepTime.');
    }
  });
}

export async function updateTimerDuration(duration: number | null) {
  await database.write(async () => {
    const settingsCollection =
      database.collections.get<Settings>('settings');

    const settingsRecord = await settingsCollection.query().fetch();

    if (settingsRecord.length > 0) {
      await settingsRecord[0].update((record) => {
        record.timerDuration = duration;
      });
    } else {
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

export async function updateChapterTimer(timerChapters: number | null) {
  await database.write(async () => {
    const settingsCollection =
      database.collections.get<Settings>('settings');

    const settingsRecord = await settingsCollection.query().fetch();

    if (settingsRecord.length > 0) {
      await settingsRecord[0].update((record) => {
        record.timerChapters = timerChapters;
      });
    } else {
      console.warn('No settings record found to update timerChapters.');
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
      timerChapters: settings.timerChapters,
      sleepTime: settings.sleepTime,
    };
  }
  return { timerDuration: null, timerActive: false };
}

export async function updateCurrentBookArtworkUri(uri: string | null) {
  await database.write(async () => {
    const settingsCollection =
      database.collections.get<Settings>('settings');

    const settingsRecord = await settingsCollection.query().fetch();

    if (settingsRecord.length > 0) {
      await settingsRecord[0].update((record) => {
        record.currentBookArtworkUri = uri;
      });
    } else {
      console.warn(
        'No settings record found to update currentBookArtworkUri.'
      );
    }
  });
}

export async function getCurrentBookArtworkUri() {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    const settings = settingsRecord[0];
    console.log(
      'settings.currentBookArtworkUri',
      settings.currentBookArtworkUri
    );
    return settings.currentBookArtworkUri;
  }
  return null;
}
