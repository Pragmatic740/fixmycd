import crypto from 'crypto';
import { desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { adminAuditLog, ethicsVersions } from '@/db/schema';
import { DEFAULT_ETHICS_BODY } from '@/lib/ethics-text';

export type CurrentEthics = { version: number; body: string; publishedAt: string | null };

/** The newest published Code of Ethics, or the built-in first version if none was published yet. */
export async function getCurrentEthics(): Promise<CurrentEthics> {
  const [row] = await db
    .select({ version: ethicsVersions.version, body: ethicsVersions.body, publishedAt: ethicsVersions.publishedAt })
    .from(ethicsVersions)
    .orderBy(desc(ethicsVersions.version))
    .limit(1);
  if (!row) return { version: 1, body: DEFAULT_ETHICS_BODY, publishedAt: null };
  return { version: row.version, body: row.body, publishedAt: row.publishedAt.toISOString() };
}

/** Publish a new version (admins only; the caller checks the role). Recorded in the audit log. */
export async function publishEthics(body: string, actorId: string): Promise<CurrentEthics> {
  return db.transaction(async (tx) => {
    // Serialize publishes so two admins can't take the same version number.
    await tx.execute(sql`LOCK TABLE ethics_versions IN SHARE ROW EXCLUSIVE MODE`);
    const [latest] = await tx
      .select({ version: ethicsVersions.version })
      .from(ethicsVersions)
      .orderBy(desc(ethicsVersions.version))
      .limit(1);
    // The built-in text counts as version 1.
    const version = (latest?.version ?? 1) + 1;
    const publishedAt = new Date();
    const id = crypto.randomUUID();
    await tx.insert(ethicsVersions).values({ id, version, body, publishedBy: actorId, publishedAt });
    await tx.insert(adminAuditLog).values({
      id: crypto.randomUUID(),
      actorId,
      action: 'ethics.publish',
      targetType: 'ethics',
      targetId: id,
      detailsJson: JSON.stringify({ version, length: body.length }),
      createdAt: publishedAt,
    });
    return { version, body, publishedAt: publishedAt.toISOString() };
  });
}
