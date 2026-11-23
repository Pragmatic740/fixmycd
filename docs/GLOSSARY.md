# Glossary

Words used in the interface, so screens, emails and docs stay consistent.

| Term | Meaning |
| --- | --- |
| **Post** | One person's submission about an infrastructure problem: title, type, severity, location, photo/video/audio. Shown in the feed, on the map and on its own page. |
| **Report** | A summary across many posts: the analytics dashboard, a shared dashboard link (`/v/…`) or the PDF incident sheet. |
| **Comment** | A reply under a post. |
| **Endorsement** | An expert's (referee or admin) severity rating and note on a post. |
| **Flag** | A request for moderators to review a post or comment. |

In the code, database and API, a post is still called a `report` (`reports` table,
`/api/reports`, `/dashboard/reports/[id]`). Only the visible wording changed, so
links, data and the seed are unaffected.
