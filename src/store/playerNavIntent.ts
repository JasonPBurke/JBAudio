// Module-scope flag used to discriminate user-initiated navigation to /player
// from a React-tree remount that restores the player route. Set on every
// legitimate navigation to /player; PlayerScreen consumes it on mount and
// dismisses itself if absent.
//
// Why: Activity recreation (e.g. after swiping the app from recents while the
// process survives via the TrackPlayer foreground service) unmounts and
// remounts the React tree. Navigation state held outside the tree restores
// [drawer, player], which would otherwise show as a dim formSheet backdrop
// over the library on relaunch.

let intentSet = false;

export const setPlayerNavIntent = () => {
  intentSet = true;
};

export const consumePlayerNavIntent = (): boolean => {
  const v = intentSet;
  intentSet = false;
  return v;
};
