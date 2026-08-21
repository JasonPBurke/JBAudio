/**
 * Setup for the `rn` jest project only. The `helpers` project never loads this.
 *
 * Kept deliberately SMALL. Every entry here is a native module with no JS
 * implementation under jest, added because a real test failed without it --
 * never speculatively. A mock written ahead of the test that needs it is a
 * mock nobody has checked against the real module, and it rots silently.
 *
 * When a new suite hits `undefined is not a function` from a native module, add
 * the smallest stand-in that lets the component mount, and say which suite
 * forced it. Anything that has to model real BEHAVIOUR to be useful belongs in
 * the test as an injected fake instead -- the pattern `ladderDecisions.ts`
 * already follows.
 */


// Reanimated 4 / worklets 0.7. `setUpTests()` is NOT enough here and fails
// before it can run: importing `react-native-reanimated` at all pulls in
// `react-native-worklets`, whose native half throws "Native part of Worklets
// doesn't seem to be initialized" in node. The shipped `/mock` entry point
// replaces the module wholesale and never reaches worklets.
// Forced by: useResetScrollOnTabChange.rn.test.tsx (the RN lane's first suite).
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
