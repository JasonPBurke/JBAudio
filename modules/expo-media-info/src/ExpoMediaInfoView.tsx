import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoMediaInfoViewProps } from './ExpoMediaInfo.types';

const NativeView: React.ComponentType<ExpoMediaInfoViewProps> =
  requireNativeView('ExpoMediaInfo');

export default function ExpoMediaInfoView(props: ExpoMediaInfoViewProps) {
  return <NativeView {...props} />;
}
