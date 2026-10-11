# Changes since the 24 July 2026 deployment (PRs #1–#17)

Everything merged to `main` after `4305a82` (the last production deploy where login
worked). All 17 PRs were authored and merged by Thomas Boimah (`tboimah`) between
8 Sept and 3 Oct 2026. Total diff is 52 files, about +6,000 / −1,800 lines.

Legend: 🗄️ = needs a database migration, ⚠️ = issue found during this review.

## Summary

| PR | Merged | Feature | DB change |
|----|--------|---------|-----------|
| #1 | 09-09 | Fix trending API date type; rename `middleware.ts` → `proxy.ts` (Next 16 convention); add `.neon` | – |
| #2 | 09-11 | Reverse geocoding on map click | – |
| #3 | 09-17 | Read GPS from photo EXIF to auto-fill location | – |
| #4 | 09-17 | In-app photo / video / audio recording | – |
| #5 | 09-17 | Comment list + report detail UI polish | – |
| #6 | 09-25 | Fix profile page "email undefined" | – |
| #7 | 09-25 | Fix dropdown modal position; geocode street address + ZIP | – |
| #8 | 09-25 | Public read-only dashboard for anonymous visitors | – |
| #9 | 09-25 | Signup approval queue | 🗄️ `users.status`, `beta_subscribers` |
| #10 | 09-25 | Expert endorsements with severity levels | 🗄️ `endorsements` |
| #11 | 09-25 | PDF incident sheet; email + in-app notifications; beta subscribe API | 🗄️ `users.email_notifications` |
| #12 | 09-25 | Feed filters: severity, date range, bounding box, radius | – |
| #13 | 10-03 | PWA: service worker, manifest, installability | – |
| #14 | 10-03 | `/install` guide page + `docs/PWA_TUTORIAL.md` | – |
| #15 | 10-03 | Share-link view tracking; shared view shows all charts | 🗄️ `share_view_events` |
| #16 | 10-03 | Seed endorsements for demo data | – |
| #17 | 10-03 | Dashboard layout tweak; public analytics route tweak | – |

The 🗄️ PRs are why production login broke: see `docs/INCIDENT-LOGIN-2026-10.md`.

## Feature details

### Reporting flow (#2, #3, #4, #7)

- **`GET /api/geocode?lat=&lng=`** (new) → `{ city, stateProvince, postalCode, county }`.
  Backed by `src/lib/geo/census.ts`, which calls the US Census geocoder
  (`geocoding.geo.census.gov`), with OpenStreetMap Nominatim as reverse-geocode
  fallback. Census address lookup (`onelineaddress`) is used for street + ZIP.
- **`PinPickerMap`**: clicking the map reverse-geocodes and fills city/state/ZIP in
  `AdvancedReportForm`.
- **EXIF GPS** (`exifr` dependency): choosing a photo with GPS metadata moves the pin to
  where it was taken.
- **`InAppMediaRecorder`** (new component, ~300 lines): records photo, video and audio in
  the browser via `getUserMedia` / `MediaRecorder` and feeds the result into the form's
  upload path (Vercel Blob).

### Public read-only mode (#8)

- `src/proxy.ts` now only forces login for `/dashboard/notifications`,
  `/dashboard/profile`, `/dashboard/review` and `/dashboard/admin`. Before, **all**
  `/dashboard/*` routes required a session. Feed, explore, analytics and report detail
  are now visible to anonymous users.
- `dashboard/layout.tsx` hides Report / Notifications / Profile / Log Out for guests and
  shows a "browsing as a guest" panel with Sign in / Create Account.

### Signup approval queue (#9) 🗄️

- New `users.status` column: `pending | approved | rejected`, default `approved`
  (so existing users are unaffected once migrated).
- `POST /api/auth/signup` now creates users as `pending` and **no longer logs them in**.
- `POST /api/auth/login` rejects `pending` / `rejected` users with 403.
- `GET /api/admin/users?status=pending` + `PATCH { userId, status }` power an
  approve/reject list on `dashboard/admin`.
- New `beta_subscribers` table (used by #11's beta subscribe API).
- ⚠️ `src/app/signup/page.tsx` still does `router.push('/dashboard')` after signup, so a
  new user lands on the dashboard as a guest and never sees the "pending approval"
  message the API returns.

### Expert endorsements (#10, #16) 🗄️

- New `endorsements` table (one per report per expert, unique index).
- `GET/POST/DELETE /api/reports/[id]/endorsements`. POST/DELETE need `requireExpert()`
  (new in `src/lib/auth.ts`: roles `referee`, `admin`, `super_admin`). POST upserts a
  severity 1–5 and an optional note.
- `EndorsementsSection` component on the report detail page.
- `seed.ts` seeds endorsements on every 37th report and clears them in `--replace-demo`.

### PDF incident sheet, notifications, beta subscribe (#11) 🗄️

- **`GET /api/reports/[id]/pdf`** (`pdf-lib`): one-page incident sheet with location,
  submitter, AI summary, endorsements, comments, status history and the report photo.
  Public (no auth). Hidden reports return 404.
- **Email notifications** via Resend (`src/lib/email.ts`) for new comments, upvotes and
  status changes, sent only when `users.email_notifications` is not false. With no
  `RESEND_API_KEY` set, emails are skipped with a warning.
- **In-app notifications** are now written for status changes too (comments and upvotes
  already had them). Notification and email failures no longer fail the request.
- **`POST /api/beta-subscribe`** stores an email in `beta_subscribers`;
  `sendBetaReleaseNotification` exists but nothing calls it yet.
- Dependency upgrades: `drizzle-orm` 0.33 → 0.45, `drizzle-kit` 0.24 → 0.31,
  `@vercel/blob` 0.27 → 2.8, `next` 16.2.10 → ^16.3.4.
- ⚠️ **Regression, fixed on this branch:** the rewrite of `PATCH /api/review/[id]` dropped
  three behaviors: status validation against `REPORT_STATUSES`, the OpenAI one-line
  summary on `accepted`, and setting `resolved_at` on `resolved`. Without `resolved_at`,
  the analytics "time to resolution" metrics ignored everything resolved after 25 Sept.
  All three are restored. The new notifications are kept.
- ⚠️ API contract changes: upvote `POST` now returns `{ success: true }` (was
  `{ upvoted: true }`), and an existing upvote returns **400** instead of 200. Review
  `PATCH` returns `{ success: true }` instead of the updated report. The current UI does
  not read these bodies, so nothing breaks today.
- ⚠️ Email HTML interpolates `reportTitle`, `commenterName` and `commentBody` without
  escaping, so users can inject HTML into notification emails sent to others.
- ⚠️ The comment email says "turn off email notifications in your profile settings",
  but no UI sets `email_notifications` yet.
- ⚠️ The PDF route fetches `report.imageUrl` server-side with no host allow-list.

### Feed filters (#12)

- `GET /api/reports` and `src/lib/reports.ts` accept `severityMin`, `severityMax`,
  `startDate`, `endDate`, a bounding box (`west`, `south`, `east`, `north`) and a radius
  (`radiusLat`, `radiusLng`, `radiusKm`).
- `ReportFilters` / `FeedContent` expose them in the UI.

### PWA (#13, #14)

- `public/sw.js`: precaches the app shell (`/`, `/dashboard`, `/login`, …), network-first
  with cache fallback, skips `/api/` and non-GET. `PWARegister` registers it in
  production only. `next.config.ts` serves `/sw.js` with `no-cache` headers.
- `app/layout.tsx` adds manifest, icons, Apple web-app metadata and `viewport` /
  `themeColor`.
- `/install` page plus `docs/PWA_TUTORIAL.md`; "Install App" link in the sidebar.
- ⚠️ The service worker caches every successful same-origin GET, including
  authenticated dashboard HTML. After logout on a shared device, offline visits can show
  the previous user's cached pages. The cache name is fixed at `fixmydistrict-v1`, so
  stale entries are only replaced when the network succeeds.

### Share-link view tracking (#15) 🗄️

- New `share_view_events` table. The public `summary` endpoint for `/v/[token]` logs a
  view with the referrer hostname and a salted SHA-256 of the user agent
  (`src/lib/hashing.ts`, `HASH_SALT`). Repeat views from the same UA within an hour are
  ignored.
- `GET /api/admin/analytics/shares` now returns `viewCount` and `lastViewedAt`, shown in
  `AnalyticsDashboardControls`.
- `/v/[token]` now renders all charts and fixes map point display.
- ⚠️ When the user agent is missing, the dedupe compares against `''` but the row stores
  `NULL`, so those views are never de-duplicated.

## New environment variables

Added to `.env.example` on this branch. Set them in Vercel for production:

| Variable | Used by | Required? |
|----------|---------|-----------|
| `RESEND_API_KEY` | email notifications | optional (emails skipped without it) |
| `EMAIL_FROM` | email sender | optional (defaults to `onboarding@resend.dev`) |
| `NEXT_PUBLIC_BASE_URL` | links in emails | yes if email is enabled (defaults to `http://localhost:3000`) |
| `HASH_SALT` | share-view UA hashing | recommended (has a hard-coded default) |
