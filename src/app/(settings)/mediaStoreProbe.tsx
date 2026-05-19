import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as RNFS from '@dr.pogodin/react-native-fs';

import SettingsHeader from '@/components/SettingsHeader';
import { screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import { getLibraryFolderEntries } from '@/db/settingsQueries';

const EXISTS_SAMPLE_SIZE = 50;
const EXTERNAL_ROOT = `${RNFS.ExternalStorageDirectoryPath}/`;

type SampleRow = {
  filename: string;
  uri: string;
  fsPath: string | null;
  inLibraryRoot: boolean;
  exists: boolean | null;
};

type ProbeResults = {
  permissionStatus: string;
  libraryRootAbsPaths: string[];
  getAssetsMs: number;
  totalAssets: number;
  truncated: boolean;
  schemeFileCount: number;
  schemeContentCount: number;
  schemeOtherCount: number;
  topPrefixes: { prefix: string; count: number }[];
  inLibraryRootCount: number;
  existsSampleSize: number;
  existsSampleMs: number;
  existsTrueCount: number;
  samples: SampleRow[];
};

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const stripFileScheme = (uri: string): string | null => {
  if (!uri.startsWith('file://')) return null;
  try {
    return decodeURIComponent(uri.replace(/^file:\/\//, ''));
  } catch {
    return uri.replace(/^file:\/\//, '');
  }
};

const bucketPrefix = (fsPath: string): string => {
  if (!fsPath.startsWith(EXTERNAL_ROOT)) return fsPath.split('/').slice(0, 4).join('/') + '/';
  const tail = fsPath.slice(EXTERNAL_ROOT.length);
  const firstSeg = tail.split('/')[0];
  return EXTERNAL_ROOT + firstSeg + '/';
};

const pickRandomIndices = (n: number, k: number): number[] => {
  if (k >= n) return Array.from({ length: n }, (_, i) => i);
  const set = new Set<number>();
  while (set.size < k) set.add(Math.floor(Math.random() * n));
  return Array.from(set);
};

const MediaStoreProbeScreen = () => {
  const { colors: themeColors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ProbeResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runProbe = async () => {
    setBusy(true);
    setError(null);
    setResults(null);

    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      const permissionStatus = perm.status;

      const folderEntries = await getLibraryFolderEntries();
      const libraryRootAbsPaths = folderEntries.map(
        (e) => `${RNFS.ExternalStorageDirectoryPath}/${e.path}`,
      );

      const t0 = Date.now();
      const page = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.audio,
        first: 100_000,
      });
      const getAssetsMs = Date.now() - t0;
      const assets = page.assets;

      // URI scheme tally + path bucketing + in-root count, all in one pass.
      let schemeFileCount = 0;
      let schemeContentCount = 0;
      let schemeOtherCount = 0;
      let inLibraryRootCount = 0;
      const prefixCounts = new Map<string, number>();
      const filePaths: (string | null)[] = new Array(assets.length);

      for (let i = 0; i < assets.length; i++) {
        const uri = assets[i].uri;
        if (uri.startsWith('file://')) {
          schemeFileCount++;
          const fsPath = stripFileScheme(uri);
          filePaths[i] = fsPath;
          if (fsPath) {
            const prefix = bucketPrefix(fsPath);
            prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
            if (
              libraryRootAbsPaths.some(
                (root) => fsPath === root || fsPath.startsWith(root + '/'),
              )
            ) {
              inLibraryRootCount++;
            }
          }
        } else if (uri.startsWith('content://')) {
          schemeContentCount++;
          filePaths[i] = null;
        } else {
          schemeOtherCount++;
          filePaths[i] = null;
        }
      }

      const topPrefixes = Array.from(prefixCounts.entries())
        .map(([prefix, count]) => ({ prefix, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // RNFS.exists on a random sample, in parallel.
      const fileIndices = filePaths
        .map((p, i) => (p ? i : -1))
        .filter((i) => i >= 0);
      const sampleIndices = pickRandomIndices(
        fileIndices.length,
        EXISTS_SAMPLE_SIZE,
      ).map((j) => fileIndices[j]);

      const tExists = Date.now();
      const existsResults = await Promise.all(
        sampleIndices.map(async (i) => {
          const p = filePaths[i] as string;
          try {
            return await RNFS.exists(p);
          } catch {
            return false;
          }
        }),
      );
      const existsSampleMs = Date.now() - tExists;
      const existsTrueCount = existsResults.filter(Boolean).length;

      // Build sample rows from the first 10 indices.
      const samples: SampleRow[] = [];
      for (let i = 0; i < Math.min(10, assets.length); i++) {
        const a = assets[i];
        const fsPath = filePaths[i];
        let exists: boolean | null = null;
        if (fsPath) {
          try {
            exists = await RNFS.exists(fsPath);
          } catch {
            exists = false;
          }
        }
        const inLibraryRoot =
          fsPath != null &&
          libraryRootAbsPaths.some(
            (root) => fsPath === root || fsPath.startsWith(root + '/'),
          );
        samples.push({
          filename: a.filename,
          uri: a.uri,
          fsPath,
          inLibraryRoot,
          exists,
        });
      }

      setResults({
        permissionStatus,
        libraryRootAbsPaths,
        getAssetsMs,
        totalAssets: page.totalCount,
        truncated: page.hasNextPage,
        schemeFileCount,
        schemeContentCount,
        schemeOtherCount,
        topPrefixes,
        inLibraryRootCount,
        existsSampleSize: sampleIndices.length,
        existsSampleMs,
        existsTrueCount,
        samples,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.modalBackground },
      ]}
    >
      <SettingsHeader title='MediaStore Probe' />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={runProbe}
          disabled={busy}
          style={[
            styles.button,
            {
              backgroundColor: themeColors.primary,
              opacity: busy ? 0.5 : 1,
            },
          ]}
        >
          <Text
            style={[styles.buttonText, { color: themeColors.modalBackground }]}
          >
            {busy ? 'Running…' : 'Run probe'}
          </Text>
        </Pressable>

        <Text style={[styles.hint, { color: themeColors.textMuted }]}>
          Queries MediaStore for all audio on device, classifies URI schemes,
          buckets by top-level path, and runs RNFS.exists() on a random sample
          of {EXISTS_SAMPLE_SIZE} files to confirm openability.
        </Text>

        {error && (
          <Text style={[styles.error, { color: themeColors.textMuted }]}>
            Error: {error}
          </Text>
        )}

        {results && (
          <View style={styles.results}>
            <Section title='Permission' themeColors={themeColors}>
              <KV
                k='status'
                v={results.permissionStatus}
                themeColors={themeColors}
              />
            </Section>

            <Section title='Library roots' themeColors={themeColors}>
              {results.libraryRootAbsPaths.length === 0 ? (
                <Text
                  style={[styles.mono, { color: themeColors.textMuted }]}
                >
                  (none in settings — add a library folder first; under-root
                  count below will read 0)
                </Text>
              ) : (
                results.libraryRootAbsPaths.map((p) => (
                  <Text
                    key={p}
                    style={[styles.mono, { color: themeColors.textMuted }]}
                  >
                    {p}
                  </Text>
                ))
              )}
            </Section>

            <Section
              title='getAssetsAsync (all audio)'
              themeColors={themeColors}
            >
              <KV
                k='time'
                v={`${results.getAssetsMs} ms`}
                themeColors={themeColors}
              />
              <KV
                k='total'
                v={`${results.totalAssets}${
                  results.truncated ? ' (page truncated)' : ''
                }`}
                themeColors={themeColors}
              />
            </Section>

            <Section title='URI scheme tally' themeColors={themeColors}>
              <KV
                k='file://'
                v={`${results.schemeFileCount} / ${results.totalAssets}`}
                themeColors={themeColors}
              />
              <KV
                k='content://'
                v={`${results.schemeContentCount} / ${results.totalAssets}`}
                themeColors={themeColors}
              />
              <KV
                k='other'
                v={`${results.schemeOtherCount} / ${results.totalAssets}`}
                themeColors={themeColors}
              />
              <KV
                k='under library root (settings-based)'
                v={`${results.inLibraryRootCount} / ${results.totalAssets}`}
                themeColors={themeColors}
              />
            </Section>

            <Section
              title='Top path prefixes (file:// only)'
              themeColors={themeColors}
            >
              {results.topPrefixes.length === 0 ? (
                <Text
                  style={[styles.mono, { color: themeColors.textMuted }]}
                >
                  (none)
                </Text>
              ) : (
                results.topPrefixes.map(({ prefix, count }) => (
                  <View key={prefix} style={styles.kv}>
                    <Text
                      style={[styles.mono, { color: themeColors.textMuted }]}
                      numberOfLines={2}
                    >
                      {prefix}
                    </Text>
                    <Text
                      style={[
                        styles.kvVal,
                        { color: themeColors.text },
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                ))
              )}
            </Section>

            <Section
              title={`RNFS.exists() sample (random ${results.existsSampleSize})`}
              themeColors={themeColors}
            >
              <KV
                k='total time'
                v={`${results.existsSampleMs} ms (parallel)`}
                themeColors={themeColors}
              />
              <KV
                k='exists true'
                v={`${results.existsTrueCount} / ${results.existsSampleSize}`}
                themeColors={themeColors}
              />
            </Section>

            <Section title='Sample rows (first 10)' themeColors={themeColors}>
              {results.samples.map((s, i) => (
                <View
                  key={`${s.uri}-${i}`}
                  style={[
                    styles.sampleRow,
                    { borderColor: themeColors.textMuted },
                  ]}
                >
                  <Text
                    style={[styles.mono, { color: themeColors.text }]}
                    numberOfLines={1}
                  >
                    {s.filename}
                  </Text>
                  <Text
                    style={[styles.monoSm, { color: themeColors.textMuted }]}
                    numberOfLines={2}
                  >
                    fsPath: {s.fsPath ?? '(non-file scheme)'}
                  </Text>
                  <Text
                    style={[styles.monoSm, { color: themeColors.textMuted }]}
                  >
                    inRoot: {s.inLibraryRoot ? 'yes' : 'no'}    exists:{' '}
                    {s.exists === null ? '—' : s.exists ? 'yes' : 'no'}
                  </Text>
                </View>
              ))}
            </Section>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

type SectionProps = {
  title: string;
  children: React.ReactNode;
  themeColors: ThemeColors;
};

const Section = ({ title, children, themeColors }: SectionProps) => (
  <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
      {title}
    </Text>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

type KVProps = {
  k: string;
  v: string;
  themeColors: ThemeColors;
};

const KV = ({ k, v, themeColors }: KVProps) => (
  <View style={styles.kv}>
    <Text style={[styles.kvKey, { color: themeColors.textMuted }]}>{k}</Text>
    <Text style={[styles.kvVal, { color: themeColors.text }]}>{v}</Text>
  </View>
);

export default MediaStoreProbeScreen;

const styles = StyleSheet.create({
  container: { paddingTop: 50, flex: 1 },
  scrollView: { paddingTop: 20 },
  scrollContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 300,
    flexGrow: 1,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: 16,
  },
  hint: {
    marginTop: 12,
    fontFamily: 'Rubik',
    fontSize: 12,
    lineHeight: 16,
  },
  error: {
    marginTop: 16,
    fontFamily: 'Rubik',
    fontSize: 14,
  },
  results: { marginTop: 20, gap: 18 },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: 15,
  },
  sectionBody: { gap: 4 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  kvKey: { fontFamily: 'Rubik', fontSize: 13, flex: 1 },
  kvVal: {
    fontFamily: 'Rubik',
    fontWeight: '500',
    fontSize: 13,
    textAlign: 'right',
    flexShrink: 1,
  },
  mono: { fontSize: 11, fontFamily: 'Rubik', flex: 1 },
  monoSm: { fontSize: 10, fontFamily: 'Rubik' },
  sampleRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    opacity: 0.95,
  },
});
