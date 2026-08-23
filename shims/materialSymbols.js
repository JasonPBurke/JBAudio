/**
 * Metro alias for `@expo-google-fonts/material-symbols` — see `metro.config.js`.
 *
 * WHY THIS EXISTS
 * ---------------
 * Nothing in this app uses expo-router's native tabs or expo-symbols' <SymbolView>.
 * They still reach the bundle because expo-router re-exports its native-tabs module,
 * and `expo-symbols/build/SymbolView.js` imports `useFonts` from this package's
 * BARREL. That barrel eagerly `require()`s all seven Material Symbols weights at
 * module scope:
 *
 *   export const MaterialSymbols_100Thin = require('./100Thin/...ttf');   // ~950 KB
 *   ...seven of these...                                                 // ~6.4 MB
 *
 * Metro registers every one and copies it into `android/.../res/raw`, so all 6.4 MB
 * ships to every user for a feature the app never renders. Measured: dropping the six
 * unused weights takes the bundled asset payload from 6.97 MB to 1.47 MB.
 *
 * WHY DROPPING SIX WEIGHTS IS SAFE
 * --------------------------------
 * `expo-symbols/build/utils.js` statically imports ONLY `./android/weights/regular`,
 * and `materialImageSource.js` hardcodes `getFont('regular')`. The other six weight
 * modules are reachable only if a caller imports one itself and passes it as
 * `weight={{ android: <that module> }}` — and each of those modules imports its font
 * by DEEP path (`@expo-google-fonts/material-symbols/700Bold`), which this alias does
 * not intercept. So an app that opts into a heavier weight still resolves it and pays
 * for that one font on demand. Only the barrel's eager side-effect requires are removed.
 *
 * If you ever adopt native tabs and see a missing glyph, delete the alias in
 * metro.config.js rather than editing this file.
 */

export * from '@expo-google-fonts/material-symbols/useFonts';
export { default as __metadata__ } from '@expo-google-fonts/material-symbols/metadata.json';

export const MaterialSymbols_400Regular = require('@expo-google-fonts/material-symbols/400Regular/MaterialSymbols_400Regular.ttf');
