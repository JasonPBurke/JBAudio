import { ExpoMediaInfoViewProps } from './ExpoMediaInfo.types';

export default function ExpoMediaInfoView(props: ExpoMediaInfoViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
