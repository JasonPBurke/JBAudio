import * as MediaLibrary from 'expo-media-library';
import * as RNFS from '@dr.pogodin/react-native-fs';
import type { LibraryFolderEntry } from '@/db/models/Settings';

export type CueScanContext = {
  rootAbsPath: string;
  treeUri: string;
};

export type EnumerationResult = {
  filesByDir: Map<string, string[]>;
  contexts: Map<string, CueScanContext>;
  allFiles: string[];
  nonFileUriSkipped: number;
};

const AUDIO_EXTENSIONS = ['.m4b', '.mp3'] as const;

const stripFileScheme = (uri: string): string | null => {
  if (!uri.startsWith('file://')) return null;
  try {
    return decodeURIComponent(uri.slice('file://'.length));
  } catch {
    return uri.slice('file://'.length);
  }
};

const isAudioFilename = (filename: string): boolean =>
  AUDIO_EXTENSIONS.some((ext) => filename.endsWith(ext));

export async function enumerateAudioViaMediaStore(
  libraryEntries: LibraryFolderEntry[],
): Promise<EnumerationResult> {
  if (libraryEntries.length === 0) {
    return {
      filesByDir: new Map(),
      contexts: new Map(),
      allFiles: [],
      nonFileUriSkipped: 0,
    };
  }

  const roots = libraryEntries.map((e) => ({
    absPath: `${RNFS.ExternalStorageDirectoryPath}/${e.path}`,
    treeUri: e.treeUri,
  }));

  const page = await MediaLibrary.getAssetsAsync({
    mediaType: MediaLibrary.MediaType.audio,
    first: 1_000_000,
  });

  const filesByDir = new Map<string, string[]>();
  const contexts = new Map<string, CueScanContext>();
  const allFiles: string[] = [];
  let nonFileUriSkipped = 0;

  for (const asset of page.assets) {
    if (!asset.uri.startsWith('file://')) {
      nonFileUriSkipped += 1;
      continue;
    }
    if (!isAudioFilename(asset.filename)) continue;

    const fsPath = stripFileScheme(asset.uri);
    if (!fsPath) continue;

    const root = roots.find(
      (r) => fsPath === r.absPath || fsPath.startsWith(r.absPath + '/'),
    );
    if (!root) continue;

    const lastSlash = fsPath.lastIndexOf('/');
    if (lastSlash < 0) continue;
    const dir = fsPath.substring(0, lastSlash);

    allFiles.push(fsPath);
    const list = filesByDir.get(dir) ?? [];
    list.push(fsPath);
    filesByDir.set(dir, list);
    if (!contexts.has(dir)) {
      contexts.set(dir, { rootAbsPath: root.absPath, treeUri: root.treeUri });
    }
  }

  for (const list of filesByDir.values()) {
    list.sort();
  }

  return { filesByDir, contexts, allFiles, nonFileUriSkipped };
}
