import { unknownBookImageUri } from '@/constants/images';
import { getChapterProgressInDB } from '@/db/chapterQueries';
import { Book } from '@/types/Book';
import { getBookById } from '@/db/bookQueries';
import TrackPlayer, { Track } from 'react-native-track-player';
import {
  getLastActiveBook,
  updateLastActiveBook,
} from '@/db/settingsQueries';

export enum BookProgressState {
  NotStarted = 0,
  Started = 1,
  Finished = 2,
}

export const handleBookPlay = async (
  book: Book | undefined,
  playing: boolean | undefined,
  isActiveBook: boolean,
  activeBookId: string | null,
  setActiveBookId: (bookId: string) => void
) => {
  if (!book) return;
  if (isActiveBook && playing) return;

  // If the book has not been started, update its progress value in the DB
  if (book.bookProgressValue === BookProgressState.NotStarted) {
    (async () => {
      try {
        const bookModel = await getBookById(book.bookId!);
        if (bookModel) {
          await bookModel.updateBookProgress(BookProgressState.Started);
        }
      } catch (error) {
        console.error('Failed to update book progress:', error);
      }
    })();
  }

  const progressInfo = await getChapterProgressInDB(book.bookId!);

  // Default to chapter 0 if no valid progress info exists (prevents silent failure)
  const chapterIndex =
    progressInfo?.chapterIndex !== undefined && progressInfo.chapterIndex >= 0
      ? progressInfo.chapterIndex
      : 0;
  const chapterProgress = progressInfo?.progress ?? 0;

  const isChangingBook = book.bookId !== activeBookId;

  if (isChangingBook) {
    await TrackPlayer.reset();
    const tracks: Track[] = book.chapters.map((chapter) => ({
      url: chapter.url,
      title: chapter.chapterTitle,
      artist: chapter.author,
      artwork: book.artwork ?? unknownBookImageUri,
      album: book.bookTitle,
      bookId: book.bookId,
    }));

    await TrackPlayer.add(tracks);
    await TrackPlayer.skip(chapterIndex);
    await TrackPlayer.seekTo(chapterProgress);
    await TrackPlayer.play();
    await TrackPlayer.setVolume(1);

    if (book.bookId) {
      setActiveBookId(book.bookId);
      await updateLastActiveBook(book.bookId);
    }
  } else {
    await TrackPlayer.skip(chapterIndex);
    await TrackPlayer.seekTo(chapterProgress);
    await TrackPlayer.play();
    await TrackPlayer.setVolume(1);
  }
};
