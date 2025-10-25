import database from '@/db';
import Book from '@/db/models/Book';
import { Observable } from 'rxjs';

export function observeTotalBookCount(): Observable<number> {
  const booksCollection = database.collections.get<Book>('books');
  return booksCollection.query().observeCount(false);
}

export async function getTotalBookCount(): Promise<number> {
  const booksCollection = database.collections.get<Book>('books');
  const count = await booksCollection.query().fetchCount();
  return count;
}
