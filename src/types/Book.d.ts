//? equal to type Artist on video @4:09
export type Author = {
  authorName: string;
  books: Book[];
};

//? this is equal to type Playlist on video
export type Book = {
  author: string;
  bookTitle: string;
  chapters: Chapter[];
  artwork: string;
  metadata: [];
};

export type Chapter = {
  chapterTitle: string;
  bookTitle: string;
  author: string;
  chapterNumber: number;
  year: string;
  url: string;
};

//? equal to type TrackWithPlaylist on video...DO I NEED THIS???
export type ChapterWithPlaylist = Chapter & {
  chapters: Chapter[];
};
