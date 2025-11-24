import { registerWebModule, NativeModule } from 'expo';
import MediaInfoFactory from 'mediainfo.js';
import { ChangeEventPayload } from './ExpoMediaInfo.types';

type ExpoMediaInfoModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class ExpoMediaInfoModule extends NativeModule<ExpoMediaInfoModuleEvents> {
  PI = Math.PI;

  async getMediaInfo(file: File) {
    const mediaInfo = await MediaInfoFactory();
    const result = await mediaInfo.analyzeData(() => file.size, (chunkSize, offset) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.error) {
            reject(event.target.error);
          }
          resolve(new Uint8Array(event.target?.result as ArrayBuffer));
        };
        const slice = file.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
      });
    });
    return result;
  }

  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(ExpoMediaInfoModule, 'ExpoMediaInfoModule');
