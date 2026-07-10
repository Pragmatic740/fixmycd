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
