export type ExpoMediaInfoModuleEvents = {
  //TODO: add events
};

export type ExpoMediaInfoViewProps = {
  url: string;
  onLoad: (event: ExpoMediaInfoModuleEvents) => void;
  onError: (event: ExpoMediaInfoModuleEvents) => void;
};

export type MediaInfoResult = {
  raw: string;
  json: unknown;
};
