import crypto from 'crypto';
import { after } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { notifications, users } from '../db/schema';

export type NotificationType = 'comment' | 'upvote' | 'status_change' | 'endorsement' | 'follow';

/**
 * Run work after the response has been sent (emails, slow side effects), so a
 * slow or failing provider never delays or breaks the request.
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>): void {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[after:${label}]`, error);
    }
  });
}

/** Create an in-app notification. Never notifies people about their own actions. */
export async function createNotification(input: {
  recipientId: string;
  actorId: string | null;
  type: NotificationType;
  reportId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (input.actorId && input.actorId === input.recipientId) return;
  try {
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: input.recipientId,
      type: input.type,
      actorId: input.actorId,
      reportId: input.reportId ?? null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      read: false,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

/** Email address of a user who still wants activity emails (null otherwise). */
export async function emailRecipient(userId: string): Promise<{ email: string; displayName: string | null } | null> {
  const [row] = await db
    .select({ email: users.email, displayName: users.displayName })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.emailNotifications, true), isNull(users.disabledAt)))
    .limit(1);
  return row ?? null;
}
