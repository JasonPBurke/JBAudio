import { useEffect } from 'react';
import { render } from '@testing-library/react-native';

import { usePublishSectionRanges } from '@/hooks/usePublishSectionRanges';
import type { SectionRange } from '@/helpers/ladderDecisions';
import { book, header, row } from '@/helpers/__tests__/support/sectionedItems';

/**
 * The section ranges' PUBLICATION, which is the half `computeSectionRanges`'s
 * own suite structurally cannot see: that suite is handed an array and returns
 * one, and knows nothing about when the answer reaches the screen.
 *
 * ⚠ Spec §H5 makes the timing a CONTRACT REQUIREMENT rather than an
 * implementation detail, and the hook's own docblock carries the reasoning. The
 * short version, because it is what this suite exists to defend: publishing
 * after paint lands the rung on a section the user was never in, and every
 * obvious sanity check still passes.
 */


/**
 * The probe's own `useEffect` is declared BEFORE the hook runs, and that
 * ordering is the whole test: React flushes every LAYOUT effect before any
 * passive effect, so a hook publishing from a layout effect records `ranges`
 * first even though its effect was registered second. Move the publication to
 * a passive effect and registration order decides instead, putting `paint`
 * first.
 *
 * A passive effect is the closest observable jest offers to "after paint" --
 * it is the phase React itself defers until the browser/RN has painted.
 */
function Probe({
  items,
  publish,
  phases = [],
}: {
  items: { sectionId: string }[];
  /** Handed to the hook AS GIVEN, `undefined` included. */
  publish?: (ranges: SectionRange[]) => void;
  phases?: string[];
}) {
  useEffect(() => {
    phases.push('paint');
  });
  usePublishSectionRanges(items, publish);
  return null;
}

describe('usePublishSectionRanges', () => {
  it('publishes the produced ranges', async () => {
    const onRanges = jest.fn();

    await render(
      <Probe
        items={[header('recentlyAdded'), row('recentlyAdded'), header('a'), book('a', 'b1')]}
        publish={onRanges}
      />,
    );

    expect(onRanges).toHaveBeenCalledWith([
      { sectionId: 'recentlyAdded', start: 0, end: 1 },
      { sectionId: 'a', start: 2, end: 3 },
    ]);
  });

  it('publishes BEFORE PAINT, from a layout effect (§H5)', async () => {
    const phases: string[] = [];

    await render(
      <Probe
        items={[header('a'), row('a')]}
        publish={() => phases.push('ranges')}
        phases={phases}
      />,
    );

    expect(phases).toEqual(['ranges', 'paint']);
  });

  it('republishes when a section expands and the spans move', async () => {
    // The real trigger, and the one the ladder cannot survive being stale on:
    // expanding `recentlyAdded` turns one row into 25 book cells and shifts
    // every author section's `start` down by 24.
    const onRanges = jest.fn();
    const collapsed = [header('recentlyAdded'), row('recentlyAdded'), header('a'), row('a')];
    const expanded = [
      header('recentlyAdded'),
      ...Array.from({ length: 25 }, (_, i) => book('recentlyAdded', `r${i}`)),
      header('a'),
      row('a'),
    ];

    const { rerender } = await render(
      <Probe items={collapsed} publish={onRanges} />,
    );
    await rerender(<Probe items={expanded} publish={onRanges} />);

    expect(onRanges).toHaveBeenLastCalledWith([
      { sectionId: 'recentlyAdded', start: 0, end: 25 },
      { sectionId: 'a', start: 26, end: 27 },
    ]);
  });

  it('tolerates a view that publishes nothing', async () => {
    // `onSectionRangesChange` is the contract's ONE optional member (§H8):
    // only `booksHome` has sections, so the other three views never pass it.
    await expect(
      render(<Probe items={[header('a'), row('a')]} />),
    ).resolves.toBeTruthy();
  });
});
