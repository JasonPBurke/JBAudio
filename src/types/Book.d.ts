export type Chapter = {
  chapterTitle: string;
  bookTitle: string;
  author: string;
  chapterNumber: number;
  year: string;
  url: string;
};

export type Book = {
  //? author: string;
  bookTitle: string;
  chapters: Chapter[];
  artwork: string;
};

export type Author = {
  authorName: string;
  books: Book[];
  artwork: string | null;
};
