import crypto from 'crypto';
import { asc, eq } from 'drizzle-orm';
import { db } from './db';
import { qaMessages, type QAMessage } from '../shared/schema';

export const qaStore = {
  list: async (analysisId: string): Promise<QAMessage[]> => {
    return db
      .select()
      .from(qaMessages)
      .where(eq(qaMessages.analysisId, analysisId))
      .orderBy(asc(qaMessages.createdAt));
  },

  append: async (
    analysisId: string,
    userId: string | undefined,
    role: 'user' | 'assistant',
    content: string
  ): Promise<QAMessage> => {
    const [row] = await db
      .insert(qaMessages)
      .values({
        id: crypto.randomUUID(),
        analysisId,
        userId,
        role,
        content,
      })
      .returning();
    return row;
  },
};
