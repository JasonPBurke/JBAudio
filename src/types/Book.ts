export interface Chapter {
  author: string;
  bookTitle: string;
  chapterTitle: string;
  chapterNumber: number;
  chapterDuration: number;
  startMs: number;
  url: string;
}

export interface Book {
  bookId: string;
  author: string;
  bookTitle: string;
  chapters: Chapter[];
  artwork: string | null;
  artworkHeight: number | null;
  artworkWidth: number | null;
  artworkColors: Record<string, string | null>;
  bookDuration: number;
  bookProgress: {
    currentChapterIndex: number;
    currentChapterProgress: number | null;
  };
  bookProgressValue: number;
  metadata: {
    [key: string]: any;
  };
}

export interface Author {
  name: string;
  books: Book[];
}

export type BookEditableFields = Pick<Book, 'bookTitle' | 'author'> & {
  [K in 'narrator' | 'genre' | 'year' | 'description' | 'copyright']?:
    | string
    | null;
};
