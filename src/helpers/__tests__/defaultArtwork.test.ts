import { resolveTrackArtwork } from '@/helpers/defaultArtwork';

describe('resolveTrackArtwork', () => {
  it('reports no cover for every empty representation', () => {
    expect(resolveTrackArtwork(null)).toBeUndefined();
    expect(resolveTrackArtwork(undefined)).toBeUndefined();
    expect(resolveTrackArtwork('')).toBeUndefined();
  });

  it('rejects a schemeless Android resource identifier', () => {
    // What Image.resolveAssetSource() yields in a release build. RN's <Image>
    // resolves it natively, but Coil (which TrackPlayer hands it to) cannot.
    expect(
      resolveTrackArtwork('src_assets_images_unknown_track'),
    ).toBeUndefined();
  });

  it('passes a Metro asset URL through — the migration, not this guard, removes it', () => {
    // A debug build's Image.resolveAssetSource() yields this, and rows
    // predating the v31 migration may still hold it. It has a scheme, so this
    // guard deliberately lets it pass. That is the intended boundary: the
    // migration nulls it at rest and usePopulateDatabase no longer writes it,
    // whereas teaching this function about Metro hosts would put a dev-server
    // detail into production artwork resolution.
    //
    // This case is here precisely because it is the one someone would
    // "obviously" want to make return undefined. It should not.
    const uri =
      'http://10.0.2.2:8081/assets/src/assets/images/unknown_track.png';
    expect(resolveTrackArtwork(uri)).toBe(uri);
  });

  it('passes a file:// cover through unchanged', () => {
    const uri =
      'file:///data/user/0/com.jbaudio/files/artwork/Pratchett_TheCarpetPeople_1a2b3c4d.webp';
    expect(resolveTrackArtwork(uri)).toBe(uri);
  });

  it('preserves the ?t= cache-buster written by replaceBookArtwork', () => {
    // replaceArtwork.ts appends ?t=Date.now() so Coil's cache key
    // changes when the user picks a new cover. Stripping it would show the
    // old cover after a replacement.
    const uri =
      'file:///data/user/0/com.jbaudio/files/artwork/Pratchett_TheCarpetPeople_1a2b3c4d.webp?t=1753000000000';
    expect(resolveTrackArtwork(uri)).toBe(uri);
  });
});
