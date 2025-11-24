// Reexport the native module. On web, it will be resolved to ExpoMediaInfoModule.web.ts
// and on native platforms to ExpoMediaInfoModule.ts
export { default } from './src/ExpoMediaInfoModule';
export { default as ExpoMediaInfoView } from './src/ExpoMediaInfoView';
export * from  './src/ExpoMediaInfo.types';
