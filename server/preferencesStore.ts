import { eq } from 'drizzle-orm';
import { db } from './db';
import { userPreferences, type UserPreferences } from '../shared/schema';

const DEFAULTS = {
  digestEnabled: true,
  followUpEmailsEnabled: true,
  blockerReminderDays: 14,
};

export const preferencesStore = {
  getOrDefault: async (userId: string): Promise<UserPreferences> => {
    const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    if (row) return row;
    return {
      userId,
      ...DEFAULTS,
      updatedAt: new Date(),
    };
  },

  upsert: async (userId: string, patch: Partial<typeof DEFAULTS>): Promise<UserPreferences> => {
    const existing = await preferencesStore.getOrDefault(userId);
    const merged = { ...existing, ...patch, userId, updatedAt: new Date() };
    await db
      .insert(userPreferences)
      .values(merged)
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...patch, updatedAt: new Date() },
      });
    return merged;
  },
};
