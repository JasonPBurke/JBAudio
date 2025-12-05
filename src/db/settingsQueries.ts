import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import database from '@/db';
import Settings from '@/db/models/Settings';
import { Q } from '@nozbe/watermelondb';

async function updateSetting(
  updater: (record: Settings) => void
): Promise<void> {
  await database.write(async () => {
    const settingsCollection =
      database.collections.get<Settings>('settings');
    const settingsRecords = await settingsCollection
      .query(Q.take(1))
      .fetch();
    const settingsRecord = settingsRecords[0];

    if (settingsRecord) {
      await settingsRecord.update(updater);
    } else {
      console.warn('No settings record found to update.');
    }
  });
}

export function updateSleepTime(duration: number | null) {
  return updateSetting((record) => {
    record.sleepTime = duration;
  });
}

export async function updateTimerDuration(duration: number | null) {
  return updateSetting((record) => {
    record.timerDuration = duration;
  });
}

export async function updateCustomTimer(
  hours: number | null,
  minutes: number | null
) {
  return updateSetting((record) => {
    record.customTimer =
      hours !== null && minutes !== null ? hours * 60 + minutes : null;
  });
}

export async function updateChapterTimer(timerChapters: number | null) {
  return updateSetting((record) => {
    record.timerChapters = timerChapters;
  });
}

export async function updateTimerActive(active: boolean) {
  return updateSetting((record) => {
    record.timerActive = active;
  });
}

export async function updateTimerFadeoutDuration(duration: number | null) {
  return updateSetting((record) => {
    record.timerFadeoutDuration = duration;
  });
}

export async function updateNumColumns(numColumns: number) {
  return updateSetting((record) => {
    record.numColumns = numColumns;
  });
}

export async function getTimerFadeoutDuration() {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    const settings = settingsRecord[0];
    return settings.timerFadeoutDuration;
  }
  return null;
}

export async function getNumColumns() {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    const settings = settingsRecord[0];
    return settings.numColumns;
  }
  return null;
}

export async function setNumColumns(numColumns: number) {
  await database.write(async () => {
    const settingsCollection =
      database.collections.get<Settings>('settings');
    const settingsRecords = await settingsCollection.query().fetch();

    if (settingsRecords.length > 0) {
      await settingsRecords[0].update((record) => {
        record.numColumns = numColumns;
      });
    } else {
      // If no settings record exists, create one.
      await settingsCollection.create((setting) => {
        setting.numColumns = numColumns;
        // Set defaults for other non-nullable fields
        setting.bookFolder = ''; // Not used, but non-nullable
        setting.timerActive = false;
      });
    }
  });
}

export function getNumColumnsObservable() {
  return database
    .get<Settings>('settings')
    .query(Q.take(1))
    .observe()
    .pipe(
      switchMap((settings) =>
        settings.length > 0 ? settings[0].observe() : of(null)
      ),
      switchMap((settingsRecord) =>
        of(settingsRecord ? settingsRecord.numColumns : null)
      )
    );
}

export async function updateLibraryPaths(paths: string[]) {
  await database.write(async () => {
    const settingsCollection =
      database.collections.get<Settings>('settings');
    const settingsRecords = await settingsCollection.query().fetch();

    if (settingsRecords.length > 0) {
      await settingsRecords[0].update((record) => {
        record.libraryPaths = paths;
      });
    } else {
      // If no settings record exists, create one.
      await settingsCollection.create((setting) => {
        setting.libraryPaths = paths;
        // Set defaults for other non-nullable fields
        setting.bookFolder = ''; // Not used, but non-nullable
        setting.numColumns = 2;
        setting.timerActive = false;
      });
    }
  });
}

export async function getLibraryPaths() {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    const settings = settingsRecord[0];
    return settings.libraryPaths;
  }
  return null;
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
      fadeoutDuration: settings.timerFadeoutDuration,
    };
  }
  return { timerDuration: null, timerActive: false };
}

export async function updateCurrentBookArtworkUri(uri: string | null) {
  return updateSetting((record) => {
    record.currentBookArtworkUri = uri;
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
