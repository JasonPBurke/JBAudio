//? equal to type Artist on video @4:09
export type Author = {
  authorName: string;
  books: Book[];
};

//? this is equal to type Playlist on video
export type Book = {
  bookId: string; // first chapter url
  author: string;
  bookTitle: string;
  chapters: Chapter[];
  artwork: string | null;
  bookProgress: {
    currentChapterIndex: number; //* on queueChange, update this to the current index
    currentChapterProgress: number; //* update 1000/5000ms as play progresses
  };
  metadata: {
    year: number | string;
    description: string;
    narrator: string;
    genre: string;
    sampleRate: number;
    totalTrackCount: number;
    ctime: Date;
    //TODO mtime: Date;
    //TODO lastPlayedChapterAndPosition: [Chapter, number];?? ...something like this
  };
};

export type Chapter = {
  author: string;
  bookTitle: string;
  chapterTitle: string;
  chapterNumber: number;
  url: string;
};

//? equal to type TrackWithPlaylist on video...DO I NEED THIS???
export type ChapterWithPlaylist = Chapter & {
  chapters: Chapter[];
};
