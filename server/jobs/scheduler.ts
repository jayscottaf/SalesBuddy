import { sendWeeklyDigestsIfDue } from './weeklyDigest';
import { sendBlockerReminders } from './blockerReminder';

const HOUR = 60 * 60 * 1000;

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  const runDigestCheck = async () => {
    try {
      const r = await sendWeeklyDigestsIfDue();
      if (r.attempted > 0) {
        console.log(`[scheduler] weekly digest attempted=${r.attempted} sent=${r.sent}`);
      }
    } catch (err) {
      console.error('[scheduler] weekly digest failed', err);
    }
  };

  const runBlockerCheck = async () => {
    try {
      const r = await sendBlockerReminders();
      if (r.attempted > 0) {
        console.log(`[scheduler] blocker reminder attempted=${r.attempted} sent=${r.sent}`);
      }
    } catch (err) {
      console.error('[scheduler] blocker reminder failed', err);
    }
  };

  // Kick off an initial check on a short delay so a restart during Friday still fires once.
  setTimeout(runDigestCheck, 60 * 1000).unref?.();
  setTimeout(runBlockerCheck, 90 * 1000).unref?.();

  setInterval(runDigestCheck, HOUR).unref?.();
  setInterval(runBlockerCheck, 6 * HOUR).unref?.();

  console.log('[scheduler] started — weekly digest hourly, blocker reminders every 6h');
}
