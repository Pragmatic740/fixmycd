# Security model

How FixMyDistrict authenticates people, decides what they may do, and
handles untrusted input. Keep this up to date when changing any of it.

## Accounts and sessions

- **Passwords** are hashed with bcrypt (cost 12 for new hashes; older
  hashes keep working). New passwords must be 8–72 bytes (bcrypt ignores
  anything past 72 bytes). Emails are stored trimmed and lowercased and
  matched case-insensitively.
- **Sessions** live in the `sessions` table. Login creates a random
  256-bit token, sends it in the `fmd_session` cookie (`HttpOnly`,
  `SameSite=Lax`, `Secure` in production, 7 days) and stores only its
  SHA-256 hash. `getSessionUser()` (`src/lib/auth.ts`) accepts a token only
  if the session is unexpired and the account is `approved` and not
  disabled. Logout deletes the session server-side.
- The pre-October `session_user_id` cookie held the raw user id and was
  forgeable; it is ignored and cleared.
- **Disabling, rejecting or changing the role of an account** deletes all
  its sessions immediately.
- **Signup** creates a `pending` account that cannot log in until an admin
  approves it. The response is the same whether or not the email is
  already registered.
- **Login** returns the same error for unknown emails and wrong passwords,
  and only reveals "disabled"/"pending" after a correct password.

## Roles

| Role | Can |
| --- | --- |
| viewer / submitter | report, comment, upvote, flag, follow |
| referee | + review queue, change report status, endorse |
| admin | + manage non-admin users, analytics, share links, CSV import, beta launch email |
| super_admin | + manage admins and grant super_admin |

Nobody can change their own role, status or disabled flag through the
admin API. Every admin change is written to `admin_audit_log`.
`tests/integration/authorization-matrix.test.ts` checks every protected
route against every role.

## Rate limits

Postgres-backed fixed windows (`src/lib/rate-limit.ts`, table
`rate_limits`); exceeding one returns `429` with `Retry-After`.

| Action | Limit |
| --- | --- |
| login | 30 / 15 min per IP, 10 / 15 min per account |
| signup, beta subscribe | 5 / hour per IP |
| create report | 20 / hour per user |
| comment | 20 / 10 min per user+IP |
| flag | 20 / hour per user |
| upload | 30 / 10 min per user+IP |
| geocode | 60 / min per IP |
| PDF export | 20 / min per IP |

## Input and output

- Every request body and query string is validated with zod
  (`src/lib/validation.ts`); invalid input gets `400` with per-field
  messages. User text has control characters (incl. NUL) stripped.
- Unexpected errors are logged with their cause and answered with a
  generic `500` (`serverError()` in `src/lib/http.ts`). Never return
  `error.message` to clients: Drizzle errors contain SQL and parameters.
- Public responses never include emails, password hashes or reporter ids
  for share links (`tests/integration/privacy-moderation.test.ts` scans
  them). Hidden reports/comments and content from disabled accounts are
  not served.
- User text is rendered by React (escaped). The explore map builds popups
  with `textContent`. Emails HTML-escape every value and strip line breaks
  from subjects. CSV exports prefix formula-like cells with `'`.

## Media and uploads

- `/api/upload` identifies files by their first bytes (JPEG, PNG, WebP,
  GIF, HEIC, MP4/MOV, WebM, MP3/M4A/OGG/WAV); SVG and HTML are refused.
  Files are stored under server-generated names with an explicit
  content type. Max 10 MB.
- Report media URLs must be on the allowlist in `src/lib/media-url.ts`
  (Vercel Blob, `images.unsplash.com`, Google Street View stills, small
  base64 `data:` URLs from the local upload fallback).
- The PDF export fetches images only from that allowlist, without
  following redirects, with a 5 MB cap and timeout (prevents server-side
  request forgery).

## Browser protections

- Headers (`next.config.ts`): HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`
  (camera/microphone/geolocation for this site only).
- Content-Security-Policy is sent as **Report-Only**. Once no unexpected
  violations show up, rename the header to `Content-Security-Policy`.
- The proxy (`src/proxy.ts`) rejects state-changing `/api` requests whose
  `Origin`/`Sec-Fetch-Site` says they come from another site.
- The service worker never caches `/dashboard`, `/api` or RSC responses,
  and logout clears all caches.

## Secrets and environment

| Variable | Needed for |
| --- | --- |
| `DATABASE_URL` | everything (migrations run on each Vercel build) |
| `UNSUBSCRIBE_SECRET` | one-click unsubscribe links in emails |
| `HASH_SALT` | stable visitor de-duplication for share-link views |
| `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_BASE_URL` | emails |

The demo seed accounts (`seed.ts`) use the documented demo password; never
run the seed scripts against a database with real users unless that is
intended, because they reset the demo accounts' passwords.

## Reporting a vulnerability

Please email the maintainers instead of opening a public issue.
