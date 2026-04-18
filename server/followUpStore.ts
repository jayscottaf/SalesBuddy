import crypto from 'crypto';
import { and, eq, lt, or, isNull, lte } from 'drizzle-orm';
import { db } from './db';
import { followUpTasks, type FollowUpTask } from '../shared/schema';

export interface CreateFollowUpInput {
  analysisId: string;
  userId?: string;
  teamId?: string;
  accountName?: string;
  type: 'blocker' | 'nextStep';
  title: string;
  dueAt?: Date;
}

export const followUpStore = {
  createMany: async (inputs: CreateFollowUpInput[]): Promise<void> => {
    if (!inputs.length) return;
    await db.insert(followUpTasks).values(
      inputs.map(i => ({
        id: crypto.randomUUID(),
        analysisId: i.analysisId,
        userId: i.userId,
        teamId: i.teamId,
        accountName: i.accountName,
        type: i.type,
        title: i.title,
        dueAt: i.dueAt,
        status: 'open',
      }))
    );
  },

  listForUser: async (userId: string): Promise<FollowUpTask[]> => {
    return db
      .select()
      .from(followUpTasks)
      .where(and(eq(followUpTasks.userId, userId), eq(followUpTasks.status, 'open')));
  },

  // For the reminder job: tasks whose dueAt is past and either no reminder sent or last reminder was before `reminderCutoff`.
  findDueReminders: async (reminderCutoff: Date): Promise<FollowUpTask[]> => {
    const now = new Date();
    return db
      .select()
      .from(followUpTasks)
      .where(
        and(
          eq(followUpTasks.status, 'open'),
          eq(followUpTasks.type, 'blocker'),
          lte(followUpTasks.dueAt, now),
          or(isNull(followUpTasks.lastReminderAt), lt(followUpTasks.lastReminderAt, reminderCutoff))
        )
      );
  },

  markReminderSent: async (id: string): Promise<void> => {
    await db
      .update(followUpTasks)
      .set({ lastReminderAt: new Date() })
      .where(eq(followUpTasks.id, id));
  },

  resolve: async (id: string, userId: string): Promise<boolean> => {
    const res = await db
      .update(followUpTasks)
      .set({ status: 'resolved', resolvedAt: new Date() })
      .where(and(eq(followUpTasks.id, id), eq(followUpTasks.userId, userId)));
    return (res as any).rowCount !== 0;
  },
};
