import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import database from '@/db';
import Settings, { LibraryFolderEntry } from '@/db/models/Settings';
import { Q } from '@nozbe/watermelondb';
import Book from '@/db/models/Book';
import Chapter from '@/db/models/Chapter';
import Series from '@/db/models/Series';
import SeriesBook from '@/db/models/SeriesBook';
import {
  selectOrphanedMemberships,
  selectEmptySeriesIds,
  partitionBooksByRemovedFolder,
} from '@/db/seriesOrphanPrune';
import { deleteArtworkFiles } from '@/helpers/artworkFiles';
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

/**
 * Persist the remaining ms of an armed-but-paused duration timer.
 *
 * Callers must keep this mutually exclusive with sleepTime: an armed duration
 * timer is either RUNNING (sleepTime set, this null) or FROZEN (this set,
 * sleepTime null). Leaving both set is what let a paused timer keep counting
 * down across a process restart.
 */
export async function updateFrozenRemaining(remainingMs: number | null) {
  return updateSetting((record) => {
    record.timerFrozenRemaining = remainingMs;
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
      frozenRemainingMs: settings.timerFrozenRemaining,
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
    frozenRemainingMs: null,
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
  // Pinned covers of any series this removal reaps — §K8. Collected inside the
  // write and released after it commits, exactly as `deleteSeries` and
  // `deleteEmptySeries` do: the row is already gone by then, so a failed unlink
  // costs one orphaned file rather than a dangling reference. Nothing else in
  // the app ever cleans these up.
  const pinnedArtwork: (string | null)[] = [];

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

    // Fetch every book's chapters once, then let `partitionBooksByRemovedFolder`
    // decide what goes and what the survivors contribute as live keys. The
    // split is NOT inlined here on purpose — see the block comment at step 4,
    // and `collectLiveKeys` for why the live set has to be every surviving
    // chapter url rather than one first-file path per book.
    const entries: { book: Book; chapters: Chapter[] }[] = [];
    for (const book of allBooks) {
      entries.push({ book, chapters: await (book.chapters as any).fetch() });
    }
    const { removedBooks: booksToDelete, liveKeys } =
      partitionBooksByRemovedFolder(entries, absoluteFolderPath);

    // 3. Prepare and execute batch deletion
    const deletions: any[] = [];
    for (const { book, chapters } of booksToDelete) {
      // Explicitly delete chapters first (WatermelonDB doesn't auto-cascade deletes)
      for (const chapter of chapters) {
        deletions.push(chapter.prepareDestroyPermanently());
      }
      // Then delete the book
      deletions.push(book.prepareDestroyPermanently());
    }

    // 4. Series resilience (same atomic batch — no nested write): drop
    // series_books rows whose structural key no longer backs a live book, then
    // auto-delete any series left with zero remaining membership.
    //
    // THE SECOND OF TWO PRUNE SITES. The other is `pruneOrphanedSeriesBooks` in
    // seriesQueries, called at the end of a scan. Neither owns the rule and the
    // two are NOT independent implementations to be reconciled by whoever finds
    // them: both delegate to `seriesOrphanPrune`, which is authoritative — for
    // the DECISION (`selectOrphanedMemberships`) and, since ticket 22, for the
    // INPUT too (`collectLiveKeys`; here via `partitionBooksByRemovedFolder`).
    // Sharing only the decision is what let the two drift: this site used to
    // feed one unsorted `chapters[0].url` per book where the scan fed every
    // surviving chapter url, so a survivor could contribute the wrong key and
    // have its row — and its whole series — destroyed. This site inlines the
    // batching only because it runs inside an open `database.write` and calling
    // the seriesQueries helpers would nest a writer. Change the decision there;
    // change the plumbing here.
    //
    // PROVENANCE IS DELIBERATELY IGNORED here as it is there — a hand-made
    // ('user') row and an 'excluded' tombstone are destroyed like a 'detected'
    // one, and a series that loses its last member ceases to exist, name and
    // ordering included. This site is the more obviously deliberate of the two:
    // the user tapped a button whose dialog says "remove this folder and all of
    // its books from your library". See
    // `docs/adr/0001-series-membership-is-keyed-by-file-path.md`.
    if (booksToDelete.length > 0) {
      const allSeriesBooks = await database
        .get<SeriesBook>('series_books')
        .query()
        .fetch();
      const seriesBooksToRemove = selectOrphanedMemberships(
        allSeriesBooks,
        liveKeys,
      );
      if (seriesBooksToRemove.length > 0) {
        const removedRowIds = new Set(seriesBooksToRemove.map((sb) => sb.id));
        for (const sb of seriesBooksToRemove) {
          deletions.push(sb.prepareDestroyPermanently());
        }
        const allSeries = await database.get<Series>('series').query().fetch();
        const emptyIds = new Set(
          selectEmptySeriesIds(
            allSeries.map((s) => s.id),
            allSeriesBooks
              .filter((sb) => !removedRowIds.has(sb.id))
              .map((sb) => ({ seriesId: (sb._raw as any).series_id })),
          ),
        );
        for (const s of allSeries) {
          if (emptyIds.has(s.id)) {
            pinnedArtwork.push(s.artwork);
            deletions.push(s.prepareDestroyPermanently());
          }
        }
      }
    }

    await writer.batch(...deletions);
  });

  await deleteArtworkFiles(pinnedArtwork);
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

/**
 * The settings table's first default-ON boolean.
 *
 * DELIBERATELY NOT the `=== true` / fallback-`false` idiom every other boolean
 * getter above uses. Both the null case (the column's state on a fresh install,
 * since `ensureSettingsRecord` seeds only three fields) and the no-record case
 * mean "the user has never expressed a preference", which for this setting is
 * ON. The house idiom would read both as OFF and silently strip the backdrop
 * from every existing tester. Covered by seriesBackgroundsSetting.test.ts.
 */
export async function getSeriesBackgroundsEnabled(): Promise<boolean> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    return settingsRecord[0].seriesBackgroundsEnabled !== false;
  }
  return true;
}

export async function setSeriesBackgroundsEnabled(
  enabled: boolean,
): Promise<void> {
  return updateSetting((record) => {
    record.seriesBackgroundsEnabled = enabled;
  });
}

/**
 * §A9 — `Enable Series Detection`. **ON by default**, and therefore the SECOND
 * getter in this module that must invert the house idiom (see
 * `getSeriesBackgroundsEnabled` above for the full reasoning).
 *
 * Getting this one wrong is worse than getting the backdrop wrong: `=== true`
 * would read every existing tester's null column as OFF, and the whole feature
 * — the thing that fills the Series shelf without the user doing anything —
 * would simply never run, with no error and nothing in the log to explain it.
 *
 * The setter is ticket 07's, along with the card that calls it.
 */
export async function getSeriesDetectionEnabled(): Promise<boolean> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    return settingsRecord[0].seriesDetectionEnabled !== false;
  }
  return true;
}

/**
 * A9 — OFF writes `false` and nothing else. It does not touch a single series,
 * exactly as `setAutoChapterInterval(null)` never touches a generated chapter:
 * the toggle governs whether books are examined *as they scan in*, so a
 * preference change can never destroy data.
 */
export async function setSeriesDetectionEnabled(
  enabled: boolean,
): Promise<void> {
  return updateSetting((record) => {
    record.seriesDetectionEnabled = enabled;
  });
}

/**
 * §A3 / §A9 — `Also group by folder name`, the sub-option. **OFF by default**,
 * so this one KEEPS the house idiom, and the difference from the getter above
 * is deliberate rather than an inconsistency: conservative fidelity is what
 * abstention bias (A7) asks for, and full fidelity is a choice the user makes.
 *
 * Kept immediately below its sibling so the two defaults are read together —
 * either one copied onto the other is a bug.
 */
export async function getSeriesFolderGroupingEnabled(): Promise<boolean> {
  const settingsCollection = database.collections.get<Settings>('settings');
  const settingsRecord = await settingsCollection.query().fetch();

  if (settingsRecord.length > 0) {
    return settingsRecord[0].seriesFolderGroupingEnabled === true;
  }
  return false;
}

/**
 * Turning this on widens the cascade to folders no tag corroborates (A3's
 * "Full" column). It changes nothing until the next detection run — like its
 * sibling, the write is the whole of the side effect.
 */
export async function setSeriesFolderGroupingEnabled(
  enabled: boolean,
): Promise<void> {
  return updateSetting((record) => {
    record.seriesFolderGroupingEnabled = enabled;
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
