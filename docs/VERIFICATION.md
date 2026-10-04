# Verification

Verified on October 5, 2026 (Asia/Kolkata), with Node.js 24.11.0 on Windows.

- `npm run check`: all 21 JavaScript and EJS files passed.
- `npm test`: 9 tests passed, covering CRUD, validation, request limits, CSRF, HTML sanitizing, search/filtering/pagination, not-found handling, and persistent demo storage.
- `npm run test:mongo`: 1 integration test passed against a real, isolated MongoDB 7.0.24 process. The test created, read, updated, reconnected, verified persistence, and deleted a post using the MongoDB repository and HTTP routes.
- Dependency installation reported 0 known vulnerabilities in the installed dependency set.
- Browser verification: published a temporary story, verified rendered Markdown, edited and saved it, and removed only that test story afterward.
- Desktop review at 1440 × 1000 and mobile review at 390 × 844; journal and article checks found no horizontal page overflow. The editor's mobile layout was visually inspected.

The checked-in `docs/preview.jpg` shows the completed journal with the four original sample stories.

The environment restricted child-process spawning, so the MongoDB binary was launched separately and the integration script used `TEST_MONGODB_URI` pointing to that isolated local database. No Atlas credentials were supplied; an actual Atlas connection has not been verified. The project includes the MongoDB connection code and configuration instructions.

The running preview uses the explicit local JSON demo. The source has not been published or pushed to GitHub.
