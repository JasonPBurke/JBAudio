// Module-scope flag used to discriminate user-initiated navigation to
// /titleDetails from a React-tree remount that restores the titleDetails
// route. Set on every legitimate navigation to /titleDetails (book card
// press); TitleDetails consumes it on mount and dismisses itself if absent.
//
// Mirror of src/store/playerNavIntent.ts — same bug pattern, same fix.
// See ~/.claude/plans/when-opening-my-app-sunny-wigderson.md for the full
// PlayerScreen investigation and the titleDetails extension section.

let intentSet = false;

export const setTitleDetailsNavIntent = () => {
  intentSet = true;
};

export const consumeTitleDetailsNavIntent = (): boolean => {
  const v = intentSet;
  intentSet = false;
  return v;
};
