import database from '@/db';
import Settings from '@/db/models/Settings';

export async function updateTimerDuration(duration: number | null) {
  await database.write(async () => {
    const settingsCollection =
      database.collections.get<Settings>('settings');
    // Assuming there's only one settings record, or we need to find the correct one
    const settingsRecord = await settingsCollection.query().fetch();

    if (settingsRecord.length > 0) {
      await settingsRecord[0].update((record) => {
        record.timerDuration = duration;
      });
    } else {
      // Handle case where no settings record exists, if necessary
      console.warn('No settings record found to update timerDuration.');
    }
  });
}
