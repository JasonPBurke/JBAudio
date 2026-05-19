import { NativeModules } from 'react-native';

type SafCueReaderModuleType = {
  readCueText(treeUri: string, relativePath: string): Promise<string>;
};

const { SafCueReaderModule } = NativeModules as {
  SafCueReaderModule?: SafCueReaderModuleType;
};

export async function readCueText(
  treeUri: string,
  relativePath: string,
): Promise<string> {
  if (!SafCueReaderModule) {
    throw new Error('SafCueReaderModule is not available on this platform');
  }
  return SafCueReaderModule.readCueText(treeUri, relativePath);
}
