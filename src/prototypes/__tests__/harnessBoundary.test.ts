/**
 * The harness must stay inside its own directory.
 *
 * `src/prototypes/` is throwaway by construction and its teardown is a single
 * `rm -rf` (see ../README.md). That command is only safe while every reference
 * to the harness is either inside it or is itself removed by the same command.
 * One import in shipping code turns the documented teardown into a bundle-time
 * failure on a route nobody was editing — which is exactly what ticket 24 found
 * in `src/app/seriesDetail.tsx`.
 *
 * ⚠ WHY THIS IS A TEST AND NOT A GREP. The acceptance criterion this replaces
 * was "grep for it". `src/db/seriesQueries.ts` contains two raw U+0000 bytes,
 * which makes `grep`/`rg` treat it as BINARY and skip it silently — a sweep
 * that reports nothing is indistinguishable from a sweep that found nothing.
 * `readFileSync(…, 'utf8')` has no binary heuristic, so this walk sees every
 * file. Do not "simplify" it back into a shell grep.
 *
 * ⚠ WHY IT LIVES IN THE HARNESS DIRECTORY. Everything else under
 * `src/prototypes/` is deliberately untested (README: "no jest, no tablet pass,
 * no font-scale pass"). This one file is the exception because it does not test
 * prototype code — it tests the boundary around it — and keeping it here means
 * `rm -rf src/prototypes` removes the rule and its subject together, leaving no
 * dead test referencing a directory that no longer exists.
 *
 * ⚠ WHAT IT DOES NOT COVER. Two axes, and only the first is enforceable by
 * reading imports:
 *
 *   1. IMPORTS — covered, below.
 *   2. ROUTE REGISTRATIONS — `src/app/_layout.tsx` registers the harness's
 *      `seriesCreateProto` route by NAME STRING, not by importing it. Expo
 *      Router resolves routes from the filesystem, so no import exists to find.
 *      That is a real second footprint in shipping code, and the last test here
 *      covers the half that matters: once the route FILE is gone, nothing may
 *      still name it.
 */

/**
 * ⚠ `require`, not `import`. `tsconfig.json` pins `"types": ["jest"]`, which
 * deliberately keeps `@types/node`'s globals out of the type space of a React
 * Native app — so `import fs from 'fs'` does not resolve. Widening that setting
 * for one test file would change how `setTimeout` and friends type across every
 * app file (measured: still 0 errors, but it relaxes them for no benefit). The
 * handful of calls this walk needs are typed locally instead.
 */
type DirEntry = { name: string; isDirectory(): boolean };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as {
  readdirSync(dir: string, options: { withFileTypes: true }): DirEntry[];
  readFileSync(file: string, encoding: 'utf8'): string;
  existsSync(file: string): boolean;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path') as {
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
  sep: string;
};
declare const __dirname: string;

/**
 * Anchored to THIS FILE, never to `process.cwd()`. Jest does not chdir, so a
 * cwd-relative root throws ENOENT the moment the suite is run from a
 * subdirectory or an IDE runner — and it throws in the describe body, before
 * any assertion, so the boundary result is replaced by a broken-test error.
 */
const REPO_ROOT = path.join(__dirname, '..', '..', '..');

/**
 * The walk starts at the REPO root, not at `src/`. An importer in `index.js`,
 * `__mocks__/` or a root config file breaks the teardown exactly as one in
 * `src/` does, and rooting at `src/` made them invisible.
 */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.expo',
  '.scratch',
  'android',
  'ios',
  'assets',
  'patches',
]);

/** The harness itself, which may of course reference itself. */
const HARNESS_DIR = path.join('src', 'prototypes');

/** The route half of the harness — a route cannot live under `src/prototypes/`. */
const HARNESS_ROUTE_FILE = path.join('src', 'app', 'seriesCreateProto.tsx');
const HARNESS_ROUTE_NAME = 'seriesCreateProto';

/**
 * Files outside the harness that are ALLOWED to import it.
 *
 * Both are handled by ticket 18's teardown: `seriesCreateProto.tsx` is named in
 * the `rm` command itself, and the library screen's `THROWAWAY` sites are the
 * documented restore list in ../README.md.
 */
const ALLOWED_IMPORTERS = new Set([
  'src/app/(drawer)/(library)/index.tsx',
  'src/app/seriesCreateProto.tsx',
]);

/**
 * Every module specifier in a file — `from '…'`, `require('…')`,
 * `jest.mock('…')`, `import('…')` and side-effect `import '…'`.
 *
 * ⚠ Specifiers, NOT a substring search of the whole file. Searching raw text
 * fails in both directions at once: it misses `../prototypes/useSeriesSource`
 * (which resolves identically to the alias) and it fires on PROSE — this repo's
 * shipping files carry long doc blocks that name the harness by path, so a
 * comment explaining this very rule would have been reported as a leak.
 */
function importSpecifiers(source: string): string[] {
  const pattern =
    /(?:\bfrom\s*|\brequire\s*\(\s*|\bjest\.mock\s*\(\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;
  const found: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) found.push(match[1]);
  return found;
}

/** True for `@/prototypes/x`, `../prototypes/x`, `./prototypes`, etc. */
function isHarnessSpecifier(specifier: string): boolean {
  return /(?:^|\/)prototypes(?:\/|$)/.test(specifier);
}

function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(REPO_ROOT, full);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || rel === HARNESS_DIR) continue;
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('prototype harness boundary', () => {
  const files = collectSourceFiles(REPO_ROOT);
  const read = (file: string) => fs.readFileSync(file, 'utf8');

  const importers = files
    .filter((file) => importSpecifiers(read(file)).some(isHarnessSpecifier))
    .map((file) => toPosix(path.relative(REPO_ROOT, file)));

  /*
   * The matcher is what the boundary rule actually rests on, so it is tested
   * against a fixture rather than trusted. A fixture also keeps this honest
   * during ticket 18: once the harness is gone the sweep below finds nothing,
   * and without this test the suite would pass by testing nothing at all.
   */
  it('recognises every import form, and does not mistake prose for one', () => {
    const fixture = `
      // Mentions @/prototypes/useSeriesSource in a comment — NOT an import.
      const note = 'see src/prototypes/README.md';
      import { a } from '@/prototypes/useSeriesSource';
      import b from '../prototypes/SeriesProtoSlot';
      import '@/prototypes/sideEffect';
      const c = require('@/prototypes/wizard/ProtoWizard');
      jest.mock('../../prototypes/protoStore');
      const d = await import('@/prototypes/lazy');
      import { keep } from '@/store/seriesStore';
    `;
    const harness = importSpecifiers(fixture).filter(isHarnessSpecifier);

    expect(harness).toEqual([
      '@/prototypes/useSeriesSource',
      '../prototypes/SeriesProtoSlot',
      '@/prototypes/sideEffect',
      '@/prototypes/wizard/ProtoWizard',
      '../../prototypes/protoStore',
      '@/prototypes/lazy',
    ]);
    // The comment and the string literal above must not appear anywhere.
    expect(harness).not.toContain('src/prototypes/README.md');
    expect(importSpecifiers(fixture)).toContain('@/store/seriesStore');
  });

  it('sees files it can compare against — the walk is not vacuously empty', () => {
    // Guards the failure mode where a bad root or a broken skip list makes
    // every assertion below pass by finding nothing at all.
    expect(files.length).toBeGreaterThan(100);
  });

  it('is imported only by files ticket 18 deletes or restores', () => {
    const leaks = importers.filter((file) => !ALLOWED_IMPORTERS.has(file));
    expect(leaks).toEqual([]);
  });

  /*
   * Deliberately a SUBSET check, not set equality: an allowlisted file that has
   * stopped importing the harness is teardown in progress, not a defect, and
   * this test must not fire while ticket 18 is mid-flight.
   */

  it('leaves nothing naming the prototype route once its file is gone', () => {
    // Inert until ticket 18 deletes the route file — at which point a leftover
    // `<Stack.Screen name='seriesCreateProto'>` in `_layout.tsx` is a route
    // registration pointing at nothing. No import exists to catch that, which
    // is why it is checked by name.
    if (fs.existsSync(path.join(REPO_ROOT, HARNESS_ROUTE_FILE))) return;

    const stragglers = files
      .filter((file) => read(file).includes(HARNESS_ROUTE_NAME))
      .map((file) => toPosix(path.relative(REPO_ROOT, file)));
    expect(stragglers).toEqual([]);
  });
});

export {};
