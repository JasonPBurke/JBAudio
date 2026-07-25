import { computeMembershipDiff } from '@/db/seriesMembershipDiff';

test('adds new, deletes removed, repositions moved', () => {
  const existing = [
    { bookKey: 'a', position: 0 },
    { bookKey: 'b', position: 1 },
    { bookKey: 'c', position: 2 },
  ];
  const desired = ['c', 'a', 'd']; // b removed, d added, order changed
  const diff = computeMembershipDiff(existing, desired);

  expect(diff.toDelete.sort()).toEqual(['b']);
  expect(diff.toCreate).toEqual([{ bookKey: 'd', position: 2 }]);
  expect(diff.toReposition).toEqual([
    { bookKey: 'c', position: 0 },
    { bookKey: 'a', position: 1 },
  ]);
});

test('no change → empty diff', () => {
  const existing = [
    { bookKey: 'a', position: 0 },
    { bookKey: 'b', position: 1 },
  ];
  const diff = computeMembershipDiff(existing, ['a', 'b']);
  expect(diff.toCreate).toEqual([]);
  expect(diff.toDelete).toEqual([]);
  expect(diff.toReposition).toEqual([]);
});
