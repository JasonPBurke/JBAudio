/**
 * Persist a `TimerCommand` and run its timer action.
 *
 * The impure half of `helpers/sleepTimerSelection.ts`, kept apart from it so
 * the decisions stay testable in the fast lane. This is the ONLY place a
 * selection reaches the database, which is the property the whole fix rests on:
 * "at most one option is selected" is now a fact about a single column, and a
 * single column can only be written here.
 *
 * `openOptions` is deliberately NOT handled. It is the one action with no
 * persistent effect — it asks the player screen to present the options sheet —
 * so the caller keeps it and this function stays free of UI.
 */
import {
  updateChapterTimer,
  updateTimerDuration,
  updateTimerMode,
} from '@/db/settingsQueries';
import type { TimerCommand } from '@/helpers/sleepTimerSelection';
import * as sleepTimer from '@/setup/sleepTimer';

export async function applyTimerCommand(
  command: TimerCommand,
): Promise<TimerCommand['action']> {
  // The selection is written BEFORE the timer acts. `activate()` reads nothing
  // back, so the order is not load-bearing for correctness, but it keeps the
  // row consistent for any observer that wakes between the two awaits.
  if (command.patch.mode !== undefined) {
    await updateTimerMode(command.patch.mode);
  }
  if (command.patch.durationMs !== undefined) {
    await updateTimerDuration(command.patch.durationMs);
  }
  if (command.patch.chapters !== undefined) {
    await updateChapterTimer(command.patch.chapters);
  }

  switch (command.action.kind) {
    case 'cancel':
      await sleepTimer.cancel();
      break;
    case 'arm':
      await sleepTimer.activate(
        command.action.mode === 'duration'
          ? { kind: 'duration', durationMs: command.action.durationMs }
          : {
              kind: 'chapter',
              chaptersRemaining: command.action.chaptersRemaining,
            },
      );
      break;
    case 'none':
    case 'openOptions':
      break;
  }

  return command.action;
}
