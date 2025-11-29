import { useEffect, useState } from 'react';
import { useActiveTrack, useProgress } from 'react-native-track-player';
import { useBook } from '@/store/library';
import { Chapter } from '@/types/Book';

export const useCurrentChapter = () => {
  const activeTrack = useActiveTrack();
  const { position } = useProgress();
  const book = useBook(activeTrack?.artist ?? '', activeTrack?.album ?? '');

  const [currentChapter, setCurrentChapter] = useState<Chapter | undefined>();

  useEffect(() => {
    if (!book || !book.chapters) {
      setCurrentChapter(undefined);
      return;
    }

    const isSingleFileBook =
      book.chapters.length > 1 &&
      book.chapters.every((c) => c.url === book.chapters[0].url);

    let chapter: Chapter | undefined;

    if (isSingleFileBook) {
      // For single-file books, find chapter based on playback position
      chapter = [...book.chapters]
        .reverse()
        .find((ch) => ((ch.startMs || 0) / 1000) <= position);
    } else {
      // For multi-file books, find chapter based on active track URL
      chapter = book.chapters.find((ch) => ch.url === activeTrack?.url);
    }

    // Fallback for when chapters might not be perfectly aligned
    if (!chapter && activeTrack) {
      chapter = book.chapters.find((ch) => ch.url === activeTrack.url);
    }

    setCurrentChapter((current) => {
      if (chapter?.url !== current?.url || chapter?.chapterTitle !== current?.chapterTitle) {
        return chapter;
      }
      return current;
    });
  }, [position, book, activeTrack]);

  return currentChapter;
};
