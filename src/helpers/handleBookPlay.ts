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

  // If the book is already active, just resume playback without seeking
  if (isActiveBook) {
    await TrackPlayer.seekBy(-1);
    await TrackPlayer.play();
    return;
  }

  const progressInfo = await getChapterProgressInDB(book.bookId!);

  if (!progressInfo || progressInfo.chapterIndex === -1) return;

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
    await TrackPlayer.skip(progressInfo.chapterIndex);
    await TrackPlayer.seekTo(progressInfo.progress || 0);
    await TrackPlayer.play();
    await TrackPlayer.setVolume(1);

    if (book.bookId) {
      setActiveBookId(book.bookId);
      await updateLastActiveBook(book.bookId);
    }
  } else {
    await TrackPlayer.skip(progressInfo.chapterIndex);
    await TrackPlayer.seekTo(progressInfo.progress || 0);
    await TrackPlayer.play();
    await TrackPlayer.setVolume(1);
  }
};
