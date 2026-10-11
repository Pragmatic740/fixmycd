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

The same missing schema also affects (at least) the admin users list, signup approvals,
endorsements (`endorsements` table), share-view tracking (`share_view_events` table), the
beta subscribe API (`beta_subscribers`), and anything else that selects all `users`
columns.

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

## Follow-ups

- Other API routes still return `error.message` to clients on 500 (e.g. endorsements,
  beta-subscribe, review, admin routes). Same leak, lower exposure.
- Consider a check in CI that runs `migrate.ts` against a throwaway Postgres and then
  hits `/api/auth/login`. That would have caught this before merge.
