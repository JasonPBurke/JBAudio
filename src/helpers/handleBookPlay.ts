import { unknownBookImageUri } from '@/constants/images';
import { getChapterProgressInDB } from '@/db/chapterQueries';
import { Book } from '@/types/Book';
import TrackPlayer, { Track } from 'react-native-track-player';

export const handleBookPlay = async (
  book: Book | undefined,
  playing: boolean | undefined,
  isActiveBook: boolean,
  activeBookId: string | null,
  setActiveBookId: (bookId: string) => void
) => {
  if (!book) return;
  if (isActiveBook && playing) return;

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
    }
  } else {
    await TrackPlayer.skip(progressInfo.chapterIndex);
    await TrackPlayer.seekTo(progressInfo.progress || 0);
    await TrackPlayer.play();
    await TrackPlayer.setVolume(1);
  }
};
