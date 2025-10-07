import unknownAuthorImage from '@/assets/images/unknown_artist.png';
import unknownBookImage from '@/assets/images/unknown_track.png';
import { Image } from 'react-native';

export const unknownAuthorImageUri =
  Image.resolveAssetSource(unknownAuthorImage).uri;
export const unknownBookImageUri =
  Image.resolveAssetSource(unknownBookImage).uri;
