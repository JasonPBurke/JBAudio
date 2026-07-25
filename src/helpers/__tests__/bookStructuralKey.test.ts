import { bookStructuralKey } from '@/helpers/bookStructuralKey';

test('returns first chapter url', () => {
  expect(
    bookStructuralKey({
      chapters: [{ url: '/a/1.mp3' } as any, { url: '/a/2.mp3' } as any],
    }),
  ).toBe('/a/1.mp3');
});

test('null when no chapters', () => {
  expect(bookStructuralKey({ chapters: [] })).toBeNull();
});
