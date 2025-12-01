import { NativeModule, requireNativeModule } from 'expo';

import { ExpoMediaInfoModuleEvents } from './ExpoMediaInfo.types';

declare class ExpoMediaInfoModule extends NativeModule<ExpoMediaInfoModuleEvents> {
  getMediaInfo(fileUri: string): Promise<string>;
  getCover(fileUri: string): Promise<string>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoMediaInfoModule>('ExpoMediaInfo');
