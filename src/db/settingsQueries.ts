import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import database from '@/db';
import Settings, { LibraryFolderEntry } from '@/db/models/Settings';
import { Q } from '@nozbe/watermelondb';
import Book from '@/db/models/Book';
import Series from '@/db/models/Series';
import SeriesBook from '@/db/models/SeriesBook';
import * as RNFS from '@dr.pogodin/react-native-fs';

export async function ensureSettingsRecord(): Promise<void> {
  await database.write(async () => {
    const settingsCollection =
      database.collections.get<Settings>('settings');
    const existing = await settingsCollection.query(Q.take(1)).fetch();
    if (existing.length === 0) {
      await settingsCollection.create((record) => {
        record.bookFolder = '';
        record.numColumns = 2;
        record.timerActive = false;
      });
    }
  });
}

async function updateSetting(
  updater: (record: Settings) => void,
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
      await settingsCollection.create((record) => {
        // Required non-nullable defaults for the singleton
        record.bookFolder = '';
        record.numColumns = 2;
        record.timerActive = false;
        // Apply the caller's mutation
        updater(record);
      });
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
  minutes: number | null,
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

export async function updateLastActiveBook(bookId: string) {
  return updateSetting((record) => {
    record.lastActiveBook = bookId;
  });
}

export async function updateNumColumns(numColumns: number) {
  return updateSetting((record) => {
    record.numColumns = numColumns;
  });
}

export async function getLastActiveBook() {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    const settings = settingsRecord[0];
    return settings.lastActiveBook;
  }
  return null;
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
  return updateSetting((record) => {
    record.numColumns = numColumns;
  });
}

export function getNumColumnsObservable() {
  return database
    .get<Settings>('settings')
    .query(Q.take(1))
    .observe()
    .pipe(
      switchMap((settings) =>
        settings.length > 0 ? settings[0].observe() : of(null),
      ),
      switchMap((settingsRecord) =>
        of(settingsRecord ? settingsRecord.numColumns : null),
      ),
    );
}

export async function updateLibraryFolderEntries(
  entries: LibraryFolderEntry[],
) {
  return updateSetting((record) => {
    record.libraryPaths =
      entries.length > 0 ? JSON.stringify(entries) : null;
  });
}

export async function getLibraryFolderEntries(): Promise<
  LibraryFolderEntry[]
> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    return settingsRecord[0].parsedLibraryFolderEntries;
  }
  return [];
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
      bedtimeModeEnabled: settings.bedtimeModeEnabled === true,
      bedtimeStart: settings.bedtimeStart,
      bedtimeEnd: settings.bedtimeEnd,
      customTimer: settings.customTimer,
    };
  }
  return {
    timerDuration: null,
    timerActive: false,
    timerChapters: null,
    sleepTime: null,
    fadeoutDuration: null,
    bedtimeModeEnabled: false,
    bedtimeStart: null,
    bedtimeEnd: null,
    customTimer: null,
  };
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
      settings.currentBookArtworkUri,
    );
    return settings.currentBookArtworkUri;
  }
  return null;
}

export const getLibraryFolders = async (): Promise<string[]> => {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecords = await settingsCollection.query(Q.take(1)).fetch();
  if (settingsRecords.length > 0) {
    const settings = settingsRecords[0];
    return settings.parsedLibraryPaths;
  }
  return [];
};

export const removeLibraryFolder = async (folderPath: string) => {
  await database.write(async (writer) => {
    const settingsCollection =
      database.collections.get<Settings>('settings');
    const settingsRecords = await settingsCollection
      .query(Q.take(1))
      .fetch();
    if (!settingsRecords.length) return;

    const settings = settingsRecords[0];

    // 1. Remove the folder entry from settings (match by path)
    const currentEntries = settings.parsedLibraryFolderEntries;
    const updatedEntries = currentEntries.filter(
      (entry) => entry.path !== folderPath,
    );
    await settings.update((s) => {
      s.libraryPaths =
        updatedEntries.length > 0 ? JSON.stringify(updatedEntries) : null;
    });

    // 2. Find all books that are inside the removed folder path
    // Construct absolute path since chapter URLs are stored as absolute paths
    const absoluteFolderPath = `${RNFS.ExternalStorageDirectoryPath}/${folderPath}`;
    const booksCollection = database.collections.get<Book>('books');
    const allBooks = await booksCollection.query().fetch();

    const booksToDelete = [];
    // Structural keys (first-file paths) of the books being removed — used to
    // prune dangling series membership below.
    const removedKeys = new Set<string>();
    for (const book of allBooks) {
      const chapters = await (book.chapters as any).fetch();
      if (
        chapters.length > 0 &&
        chapters[0].url.startsWith(absoluteFolderPath)
      ) {
        booksToDelete.push(book);
        removedKeys.add(chapters[0].url);
      }
    }

    // 3. Prepare and execute batch deletion
    const deletions: any[] = [];
    for (const book of booksToDelete) {
      // Explicitly delete chapters first (WatermelonDB doesn't auto-cascade deletes)
      const chapters = await (book.chapters as any).fetch();
      for (const chapter of chapters) {
        deletions.push(chapter.prepareDestroyPermanently());
      }
      // Then delete the book
      deletions.push(book.prepareDestroyPermanently());
    }

    // 4. Series resilience (same atomic batch — no nested write): drop
    // series_books rows referencing the removed books' structural keys, then
    // auto-delete any series left with zero remaining membership.
    if (removedKeys.size > 0) {
      const allSeriesBooks = await database
        .get<SeriesBook>('series_books')
        .query()
        .fetch();
      const remainingBySeries = new Map<string, number>();
      const seriesBooksToRemove: SeriesBook[] = [];
      for (const sb of allSeriesBooks) {
        const seriesId = (sb._raw as any).series_id;
        if (removedKeys.has(sb.bookKey)) {
          seriesBooksToRemove.push(sb);
        } else {
          remainingBySeries.set(
            seriesId,
            (remainingBySeries.get(seriesId) ?? 0) + 1,
          );
        }
      }
      if (seriesBooksToRemove.length > 0) {
        for (const sb of seriesBooksToRemove) {
          deletions.push(sb.prepareDestroyPermanently());
        }
        const allSeries = await database.get<Series>('series').query().fetch();
        for (const s of allSeries) {
          if (!remainingBySeries.get(s.id)) {
            deletions.push(s.prepareDestroyPermanently());
          }
        }
      }
    }

    await writer.batch(...deletions);
  });
};

export async function getThemeMode(): Promise<string | null> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    const settings = settingsRecord[0];
    return settings.themeMode;
  }
  return null;
}

export async function setThemeMode(mode: string): Promise<void> {
  return updateSetting((record) => {
    record.themeMode = mode;
  });
}

export async function getCustomPrimaryColor(): Promise<string | null> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    const settings = settingsRecord[0];
    return settings.customPrimaryColor;
  }
  return null;
}

export async function setCustomPrimaryColor(
  color: string | null,
): Promise<void> {
  return updateSetting((record) => {
    record.customPrimaryColor = color;
  });
}

export async function getBedtimeSettings() {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    const settings = settingsRecord[0];
    return {
      bedtimeStart: settings.bedtimeStart,
      bedtimeEnd: settings.bedtimeEnd,
      bedtimeModeEnabled: settings.bedtimeModeEnabled === true,
    };
  }
  return {
    bedtimeStart: null,
    bedtimeEnd: null,
    bedtimeModeEnabled: false,
  };
}

export async function getBedtimeModeEnabled(): Promise<boolean> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    return settingsRecord[0].bedtimeModeEnabled === true;
  }
  return false;
}

export async function setBedtimeModeEnabled(
  enabled: boolean,
): Promise<void> {
  return updateSetting((record) => {
    record.bedtimeModeEnabled = enabled;
  });
}

export async function setBedtimeSettings(
  bedtimeStart: number | null,
  bedtimeEnd: number | null,
): Promise<void> {
  return updateSetting((record) => {
    record.bedtimeStart = bedtimeStart;
    record.bedtimeEnd = bedtimeEnd;
  });
}

export async function getSkipBackDuration(): Promise<number> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    return settingsRecord[0].skipBackDuration ?? 30;
  }
  return 30;
}

export async function getSkipForwardDuration(): Promise<number> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    return settingsRecord[0].skipForwardDuration ?? 30;
  }
  return 30;
}

export async function updateSkipBackDuration(value: number): Promise<void> {
  return updateSetting((record) => {
    record.skipBackDuration = value;
  });
}

export async function updateSkipForwardDuration(value: number): Promise<void> {
  return updateSetting((record) => {
    record.skipForwardDuration = value;
  });
}

export async function getPlaybackRate(): Promise<number> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    return settingsRecord[0].playbackRate ?? 1.0;
  }
  return 1.0;
}

export async function updatePlaybackRate(value: number): Promise<void> {
  return updateSetting((record) => {
    record.playbackRate = value;
  });
}

export async function getLastNonDefaultRate(): Promise<number | null> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    return settingsRecord[0].lastNonDefaultRate;
  }
  return null;
}

export async function updateLastNonDefaultRate(
  value: number,
): Promise<void> {
  return updateSetting((record) => {
    record.lastNonDefaultRate = value;
  });
}

export async function getAutoChapterInterval(): Promise<number | null> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    return settingsRecord[0].autoChapterInterval;
  }
  return null;
}

export async function setAutoChapterInterval(
  interval: number | null,
): Promise<void> {
  return updateSetting((record) => {
    record.autoChapterInterval = interval;
  });
}

export async function getAutoAccentEnabled(): Promise<boolean> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    return settingsRecord[0].autoAccentEnabled === true;
  }
  return false;
}

export async function setAutoAccentEnabled(
  enabled: boolean,
): Promise<void> {
  return updateSetting((record) => {
    record.autoAccentEnabled = enabled;
  });
}

export async function getShakeToResetEnabled(): Promise<boolean> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    return settingsRecord[0].shakeToResetEnabled === true;
  }
  return false;
}

export async function setShakeToResetEnabled(
  enabled: boolean,
): Promise<void> {
  return updateSetting((record) => {
    record.shakeToResetEnabled = enabled;
  });
}

export async function getLastScanAt(): Promise<number | null> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    return settingsRecord[0].lastScanAt;
  }
  return null;
}

export async function setLastScanAt(timestamp: number): Promise<void> {
  return updateSetting((record) => {
    record.lastScanAt = timestamp;
  });
}

export async function getBooksWithoutChapterData(): Promise<Book[]> {
  const booksCollection = database.collections.get<Book>('books');
  const allBooks = await booksCollection.query().fetch();

  const booksWithoutChapters: Book[] = [];

  for (const book of allBooks) {
    // Skip books that already have auto-generated chapters
    if (book.hasAutoGeneratedChapters) continue;

    const chapters = await (book.chapters as any).fetch();
    // A book "without chapter data" has either:
    // - No chapters at all
    // - Only a single chapter that spans the entire book (typical for files without embedded chapters)
    if (chapters.length === 0 || chapters.length === 1) {
      booksWithoutChapters.push(book);
    }
  }

  return booksWithoutChapters;
}
