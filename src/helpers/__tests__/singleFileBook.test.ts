import { getPreviousPressTarget } from '../singleFileBook';

// Chapters at 0:00, 10:00, 20:00 (startMs)
const chapters = [
  { startMs: 0 },
  { startMs: 600_000 },
  { startMs: 1_200_000 },
];

describe('getPreviousPressTarget', () => {
  it('restarts the current chapter when more than the threshold has elapsed', () => {
    // 16s into chapter 2 (starts at 600s)
    expect(getPreviousPressTarget(chapters, 616, 15)).toEqual({
      targetSeconds: 600,
      kind: 'restart',
    });
  });

  it('goes to the previous chapter when at most the threshold has elapsed', () => {
    // 10s into chapter 2 → chapter 1 start
    expect(getPreviousPressTarget(chapters, 610, 15)).toEqual({
      targetSeconds: 0,
      kind: 'previous',
    });
  });

  it('goes to the previous chapter at exactly the threshold (inclusive)', () => {
    // exactly 15s into chapter 3 → chapter 2 start
    expect(getPreviousPressTarget(chapters, 1215, 15)).toEqual({
      targetSeconds: 600,
      kind: 'previous',
    });
  });

  it('restarts the current chapter just past the threshold', () => {
    const result = getPreviousPressTarget(chapters, 1215.5, 15);
    expect(result.kind).toBe('restart');
    expect(result.targetSeconds).toBeCloseTo(1200);
  });

  it('returns book start as "previous" when early in the first chapter', () => {
    expect(getPreviousPressTarget(chapters, 10, 15)).toEqual({
      targetSeconds: 0,
      kind: 'previous',
    });
  });

  it('restarts the first chapter when beyond the threshold in it', () => {
    expect(getPreviousPressTarget(chapters, 300, 15)).toEqual({
      targetSeconds: 0,
      kind: 'restart',
    });
  });

  it('treats a single-chapter or empty list as a restart to 0', () => {
    expect(getPreviousPressTarget([{ startMs: 0 }], 500, 15)).toEqual({
      targetSeconds: 0,
      kind: 'restart',
    });
    expect(getPreviousPressTarget([], 500, 15)).toEqual({
      targetSeconds: 0,
      kind: 'restart',
    });
  });
});
