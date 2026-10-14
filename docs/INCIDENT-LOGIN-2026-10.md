# Incident: production login fails with "Failed query: select … from "users""

## Symptom

On the production deployment of `main`, every login attempt shows:

```
Failed query: select "id", "email", "display_name", "password_hash", "role", "status",
"bio", "is_synthetic", "dataset_key", "disabled_at", "created_at", "email_notifications"
from "users" where "users"."email" = $1 limit $2
```

The last deployment where login worked was `4305a82` ("style(globals): save panel and
wrap map controls", 24 July 2026).

## Root cause

The code and the production database schema are out of sync.

PRs merged in September/October added two columns to the `users` table in
`src/db/schema.ts` and to `migrate.ts`:

| Column                | Added in | PR |
|-----------------------|----------|----|
| `status`              | `2516642` feat(auth): add signup approval queue | #9 |
| `email_notifications` | `c7b714b` feat(pdf): add incident sheet PDF export (W2-4/W2-5) | #11 |

Drizzle's `db.select().from(users)` selects every column declared in the schema, so the
login query asks for `status` and `email_notifications`. `migrate.ts` was never run
against the production database, and the Vercel build only ran `next build`, so the
production database still has the July table and Postgres rejects the query:

```
column "status" does not exist
```

That message never appeared on screen. PR #11 also upgraded `drizzle-orm` from 0.33 to
0.45, which wraps driver errors in a `DrizzleQueryError` whose `message` is
`Failed query: …`, with the real Postgres error on `error.cause`. The login route returned
`error.message` to the browser, which is why the screen showed raw SQL and the user's
email.

Production runtime logs (deployment `dpl_7YfUpGaASuJatJ2ostyUeLmzCb13`, 11 Oct) confirm it:
`POST /api/auth/login` → 500 with
`[cause]: column "status" does not exist` (Postgres `42703`, `errorMissingColumn`).

### Impact beyond login

Login is only the most visible failure. Two things widen it:

- `getSessionUser()` (`src/lib/auth.ts`) does `db.select().from(users)`, so **every
  request that carries a session cookie** fails. Logged-in users would see the feed,
  notifications, upvotes, comments posting, review and admin all return 500.
- `endorsements`, `share_view_events` and `beta_subscribers` tables don't exist yet.

Measured locally against a database built with the 24 July migration, running the
current `main` code:

| Endpoint | Logged out | Logged in | After migration |
|---|---|---|---|
| `GET /api/reports` (feed) | 200 | **500** | 200 |
| `GET /api/reports/[id]`, `/comments` | 200 | – | 200 |
| `GET /api/reports/[id]/endorsements` | **500** | – | 200 |
| `GET /api/reports/[id]/pdf` (PDF export) | **500** | – | 200 |
| `GET /api/users/[id]` (public profile `/dashboard/u/…`) | **500** | – | 200 |
| `POST /api/auth/login` | **500** | – | 200 |
| `POST /api/auth/signup` | **500** | – | 201 |
| `POST /api/beta-subscribe` | **500** | – | 201 |
| `GET /api/auth/me` | 401 | **500** | 200 |
| `GET /api/notifications` | – | **500** | 200 |
| `POST /api/reports/[id]/upvote` | – | **500** | 200 |
| `GET /api/admin/users`, `/api/admin/analytics/shares` | – | **500** | 200 |

Because no one can log in, and session cookies expire after 7 days (the broken deploy
went out 3 Oct), the live site is effectively **read-only for everyone**. Guests can
browse the feed and reports, but nobody can log in, sign up, post, comment, upvote,
moderate or administer. Public profiles, endorsements and PDF export are broken even for
guests. Shared analytics links (`/v/[token]`) still load. Their view-tracking insert
fails but is caught and only logged.

**No data was lost or corrupted.** Every failing query fails before writing, and the
migration only adds columns and tables. Existing users get `status = 'approved'`.

### Reproduction (done locally)

1. Create an empty Postgres database and run `migrate.ts` from `4305a82` (July schema).
2. Run the current `main` login query: it fails with the exact message above, and
   `error.cause.message` is `column "status" does not exist`.
3. Run the current `migrate.ts`: the same query succeeds and `POST /api/auth/login`
   returns 200.

## Fix

1. **Run migrations on every Vercel build.** `package.json` now has
   `"vercel-build": "tsx migrate.ts && next build --webpack"`. Vercel runs `vercel-build`
   instead of `build` when it exists. `migrate.ts` is idempotent (`CREATE … IF NOT
   EXISTS`, `ADD COLUMN IF NOT EXISTS`, NULL backfills), so it is safe on every
   deploy. If the migration fails, the build fails, so a deployment can no longer
   go live against a database that doesn't match its schema.
   - Existing users get `status = 'approved'` and `email_notifications = true` by
     column default, so current accounts keep working.
   - If preview deployments share the production `DATABASE_URL`, previews also run
     the (additive) migrations against production. Give previews their own database
     (e.g. a Neon branch) if that is not wanted.
2. **Stop leaking SQL to the browser.** `src/app/api/auth/login/route.ts` now logs the
   error and its `cause` server-side (visible in Vercel runtime logs) and returns a
   generic message.

### To restore production right now

Either redeploy `main` after this fix is merged (the build runs the migration), or run
it once by hand against the production database:

```bash
DATABASE_URL="<production connection string>" npm run db:migrate
```

## Follow-ups (done in the hardening PR)

- Every API route now returns a generic 500 and logs the cause
  (`serverError()` in `src/lib/http.ts`).
- `tests/integration/migrations.test.ts` fails CI if any column declared
  in `src/db/schema.ts` is not created by the migrations, and checks that
  a July-2026 database upgrades cleanly. CI also runs the full test suite
  against Postgres on every pull request.
- Migrations run inside one transaction, so a failure can't leave the
  schema half-applied.
- The session lookup selects explicit columns, so adding a column can no
  longer break every signed-in request.
