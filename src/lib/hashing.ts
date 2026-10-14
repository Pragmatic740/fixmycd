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
 * Anonymous visitor key for view counting: salted hash of IP + user agent +
 * UTC day. Nothing reversible is stored, and the key changes every day so
 * visitors cannot be tracked across days.
 */
export function visitorHash(ip: string, userAgent: string | null, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return crypto
    .createHash('sha256')
    .update(`${ip}|${userAgent ?? ''}|${day}|${hashSalt()}`)
    .digest('hex')
    .slice(0, 32);
}

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|curl|wget|python-requests|headless/i;

/** Link-preview bots and crawlers shouldn't count as dashboard views. */
export function isLikelyBot(userAgent: string | null): boolean {
  return !!userAgent && BOT_UA.test(userAgent);
}
