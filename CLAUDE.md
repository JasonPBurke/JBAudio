# Sonicbooks (JBAudio)

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature-slug>/` in this repo — there is no
remote issue tracker in use. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name, recorded as a `Status:` line in
the issue file. See `docs/agents/triage-labels.md`.

### Testing

Jest runs **two projects**. Pure TypeScript lives in the `helpers` lane (node, no preset, ~2 s);
anything importing React Native must be named `*.rn.test.tsx` to land in the `rn` lane
(`jest-expo/android` + `@testing-library/react-native`). **Read
`docs/testing/jest-projects-and-rn-tests.md` before writing a component or hook test** — it holds
eight traps that all fail quietly, including that `jest.useFakeTimers()` breaks RNTL 14's async
render and that FlashList's `computeVisibleIndices()` throws under jest.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root, both created lazily.
See `docs/agents/domain.md`.
