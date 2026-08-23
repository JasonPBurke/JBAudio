/**
 * The lucide shim is a build artifact that must stay in sync with the app's
 * imports. Metro aliases `lucide-react-native` to it (see `metro.config.js`), so
 * an icon imported by a screen but missing from the shim resolves to
 * `undefined` — which fails only when that one screen renders, in a release
 * build, as a crash with no mention of lucide. This test turns that into a
 * failing suite the moment the import is added.
 *
 * It compares the committed file against what the generator would write, so it
 * catches removals (dead weight) as well as additions (a runtime crash).
 *
 * File reads live in the generator rather than here: this lane's tsconfig omits
 * the `node` types on purpose, and adding them to reach `fs` would pull
 * `NodeJS.Timeout` into a project whose `lib` includes `dom`.
 */

import { renderShim, readShim } from '../../../scripts/generateLucideShim';

/** Icon names re-exported by a shim's source. */
const exportedNames = (source: string): Set<string> =>
  new Set(
    source
      .split('\n')
      .map((line: string) => /export \{ default as (\w+) \}/.exec(line)?.[1])
      .filter((name): name is string => Boolean(name)),
  );

describe('lucide shim', () => {
  it('is in sync with the icons imported by src/', () => {
    const onDisk: string = readShim();
    const expected: string = renderShim();

    if (onDisk !== expected) {
      const have = exportedNames(onDisk);
      const want = exportedNames(expected);
      const missing = [...want].filter((name) => !have.has(name));
      const extra = [...have].filter((name) => !want.has(name));

      throw new Error(
        [
          'shims/lucideIcons.js is out of date.',
          missing.length &&
            `  missing (would crash at render): ${missing.join(', ')}`,
          extra.length && `  no longer imported (dead weight): ${extra.join(', ')}`,
          '  Fix: npm run generate:lucide-shim',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    expect(onDisk).toBe(expected);
  });

  it('re-exports by deep path so the barrel is never pulled in', () => {
    const exportLines: string[] = readShim()
      .split('\n')
      .filter((line: string) => line.startsWith('export '));

    expect(exportLines.length).toBeGreaterThan(0);

    for (const line of exportLines) {
      // A bare 'lucide-react-native' specifier here would re-enter the alias and
      // defeat the whole optimisation.
      expect(line).toMatch(
        /from 'lucide-react-native\/dist\/esm\/icons\/[a-z0-9-]+';$/,
      );
    }
  });
});
