import crypto from 'crypto';

let processSalt: string | null = null;

/**
 * Salt for hashing visitor data. HASH_SALT should be set in production; if it
 * is missing we use a random per-process salt rather than a public default, so
 * hashes can never be reversed by someone who has read this source code.
 */
function hashSalt(): string {
  if (process.env.HASH_SALT) return process.env.HASH_SALT;
  if (!processSalt) {
    processSalt = crypto.randomBytes(16).toString('hex');
    if (process.env.NODE_ENV === 'production') {
      console.warn('HASH_SALT is not set; using a random per-process salt (view de-duplication is per instance).');
    }
  }
  return processSalt;
}

/**
 * Hash a user agent string for anonymous dedup tracking.
 * Never store raw user agents — hash with a salt.
 */
export function hashUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const salt = hashSalt();
  return crypto
    .createHash('sha256')
    .update(userAgent + salt)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Reduce a referrer URL to just its hostname to avoid capturing full URLs.
 */
export function extractReferrer(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    return url.hostname;
  } catch {
    return null;
  }
}