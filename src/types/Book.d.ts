//? equal to type Artist on video @4:09
export type Author = {
  name: string; //!change to name to match watermelon db?
  books: Book[];
};

//? this is equal to type Playlist on video
export type Book = {
  bookId: string | null; // first chapter url
  author: string;
  bookTitle: string;
  chapters: Chapter[];
  bookDuration: number;
  artwork: string | null;
  artworkHeight: number | null;
  artworkWidth: number | null;
  artworkColors: {
    average: string | null;
    dominant: string | null;
    vibrant: string | null;
    darkVibrant: string | null;
    lightVibrant: string | null;
    muted: string | null;
    darkMuted: string | null;
    lightMuted: string | null;
  };
  bookProgress: {
    currentChapterIndex: number; //* on queueChange, update this to the current index
    currentChapterProgress: number | null; //* update 1000/5000ms as play progresses
  };
  bookProgressValue: number;
  metadata: {
    year: number | null;
    description: string | null;
    narrator: string | null;
    genre: string | null;
    sampleRate: number | null;
    totalTrackCount: number | null;
    ctime: Date;
    mtime: Date | null;
    //TODO lastPlayedChapterAndPosition: [Chapter, number];?? ...something like this
  };
};

export type Chapter = {
  author: string;
  bookTitle: string;
  chapterTitle: string;
  chapterNumber: number;
  chapterDuration: number;
  startMs?: number;
  url: string;
};

//? equal to type TrackWithPlaylist on video...DO I NEED THIS???
export type ChapterWithPlaylist = Chapter & {
  chapters: Chapter[];
};
