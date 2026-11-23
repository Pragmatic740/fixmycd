# FixMyDistrict Public API

Base URL: `/api/public`

## GET /api/public/reports/[id]

Returns a public report by ID (non-hidden reports only).

**Response:**
```json
{
  "id": "uuid",
  "referenceNo": "FMD-1001",
  "title": "Deep Pothole on 4th St",
  "description": "...",
  "latitude": -17.8292,
  "longitude": 31.0522,
  "severity": 4,
  "status": "submitted",
  "category": "Road",
  "imageUrl": "https://...",
  "aiSummary": null,
  "createdAt": "2026-07-10T...",
  "userDisplayName": "Tendai Moyo"
}
```

## Authenticated endpoints

See `/api/reports`, `/api/reports/[id]/upvote`, `/api/reports/[id]/comments` for full CRUD and social features.


## Added in November 2026

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/analytics/[endpoint]` | signed in | `summary`, `timeseries`, `breakdowns`, `scatter`, `map`, `boundaries`, `reports` (`?format=csv`); `users` and `quality` are admin-only. Non-admins never get reporter ids, emails or roles. |
| GET, POST, DELETE | `/api/analytics/shares` | signed in | Members manage their own share links; admins see all. |
| POST | `/api/verify` | anyone | `{ email, password, card }` — $1 identity check (demo); activates a pending account and signs in. |
| POST | `/api/donate` | anyone | `{ amountCents, card }` — donation (demo). |
| GET | `/api/ethics` | anyone | Current Code of Ethics `{ version, body, publishedAt }`. |
| POST | `/api/admin/ethics` | admin | `{ body }` — publish a new version (audited). |

`POST /api/auth/signup` now also requires `acceptEthics: true`.
