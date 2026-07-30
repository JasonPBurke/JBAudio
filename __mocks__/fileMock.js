/**
 * Stub for static image imports. Metro turns `import img from './x.png'` into a
 * numeric asset id; jest has no such transformer and would try to parse the PNG
 * bytes as JavaScript. Any opaque value works — consumers only pass it to
 * Image.resolveAssetSource / Asset.fromModule, both mocked in tests.
 */
module.exports = 1;
