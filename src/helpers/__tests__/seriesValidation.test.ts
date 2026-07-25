import {
  seriesAuthorStepIssues,
  seriesBookStepIssues,
  seriesEditIssues,
} from '@/helpers/seriesValidation';

const series = [
  { id: 's1', name: 'Dune Saga' },
  { id: 's2', name: 'Foundation' },
];

describe('author step', () => {
  test('no authors selected', () => {
    expect(seriesAuthorStepIssues([])).toEqual(['Select at least one author.']);
  });

  test('one author selected is valid', () => {
    expect(seriesAuthorStepIssues(['Frank Herbert'])).toEqual([]);
  });
});

describe('book step (create)', () => {
  const base = {
    name: 'Wheel of Time',
    selectedBookKeys: ['/a/1.m4b'],
    series,
    isEdit: false,
  };

  test('valid create', () => {
    expect(seriesBookStepIssues(base)).toEqual([]);
  });

  test('blank name', () => {
    expect(seriesBookStepIssues({ ...base, name: '  ' })).toEqual([
      'Enter a series name.',
    ]);
  });

  test('no books', () => {
    expect(seriesBookStepIssues({ ...base, selectedBookKeys: [] })).toEqual([
      'Select at least one book.',
    ]);
  });

  test('duplicate name', () => {
    expect(seriesBookStepIssues({ ...base, name: 'dune saga' })).toEqual([
      'A series named "dune saga" already exists. Choose a different name.',
    ]);
  });

  test('multiple problems are all reported, name first', () => {
    expect(
      seriesBookStepIssues({
        ...base,
        name: 'Foundation',
        selectedBookKeys: [],
      }),
    ).toEqual([
      'A series named "Foundation" already exists. Choose a different name.',
      'Select at least one book.',
    ]);
  });

  test('edit mode ignores the name entirely', () => {
    expect(
      seriesBookStepIssues({ ...base, isEdit: true, name: 'Dune Saga' }),
    ).toEqual([]);
  });

  test('edit mode still requires a book', () => {
    expect(
      seriesBookStepIssues({ ...base, isEdit: true, selectedBookKeys: [] }),
    ).toEqual(['Select at least one book.']);
  });
});

describe('edit screen', () => {
  test('valid rename', () => {
    expect(seriesEditIssues({ name: 'Dune Chronicles', series })).toEqual([]);
  });

  test('blank name', () => {
    expect(seriesEditIssues({ name: '', series })).toEqual([
      'Enter a series name.',
    ]);
  });

  test('renaming to its own name is valid', () => {
    expect(
      seriesEditIssues({ name: 'Dune Saga', series, excludeId: 's1' }),
    ).toEqual([]);
  });

  test('renaming onto another series is a duplicate', () => {
    expect(
      seriesEditIssues({ name: 'Foundation', series, excludeId: 's1' }),
    ).toEqual([
      'A series named "Foundation" already exists. Choose a different name.',
    ]);
  });
});
