# Margin — Full-Stack Blog Platform

A responsive, server-rendered blog built with **Node.js, Express 5, EJS, and MongoDB/Mongoose**. Readers browse stories; writers can create, edit, and delete posts through dedicated pages.

![Margin journal preview](docs/preview.jpg)

## Run the local demo

Install Node.js 22.12 or newer, then run these commands from this folder:

```sh
npm install
npm run demo
```

Open **http://localhost:3000**. Four original sample stories are added on the first demo run. All CRUD actions work, and edits survive restarts in `.data/posts.json`.

**Demo mode uses a local JSON file, not MongoDB.** It is an explicit convenience for trying the UI without database credentials. It is intended for one local server process and is disabled in production. `npm start` never falls back to demo storage if MongoDB fails.

## Run with MongoDB Atlas

1. Create an Atlas cluster, a database user, and a network access entry for your machine's IP address.
2. Copy `.env.example` to `.env`:

   ```sh
   # macOS / Linux
   cp .env.example .env
   ```

   ```powershell
   # Windows PowerShell
   Copy-Item .env.example .env
   ```

3. Replace `MONGODB_URI` with your Atlas application connection string. Include a database name, for example:

   ```dotenv
   MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@YOUR-CLUSTER.mongodb.net/blog-platform?retryWrites=true&w=majority
   ```

   Percent-encode special characters in the password. Keep the actual value in `.env`, which is ignored by Git. Never put it in application code.

4. Generate a cookie secret and paste it into `COOKIE_SECRET` in `.env`:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. Optionally add the example stories, then start the app:

   ```sh
   npm run seed
   npm start
   ```

The seed command only adds content when the collection is empty. It does not delete or overwrite existing stories. MongoDB mode and local demo mode are separate stores; switching modes does not migrate posts.

For local MongoDB, use `mongodb://127.0.0.1:27017/blog-platform` instead of an Atlas URI.

## What is included

- Multi-page journal, article, editor, deletion confirmation, and error pages.
- Full CRUD with RESTful Express routes and persistent MongoDB documents.
- Responsive layout, keyboard focus styles, skip link, and labeled forms.
- Markdown writing, formatting shortcuts, sanitized article rendering, and reading time.
- Search by title, introduction, or author; category filters and pagination.
- Server-side validation with preserved form values and per-field errors.
- Signed-cookie CSRF protection, safe method overrides, security headers, and request size limits.
- Unsaved edit warning and explicit deletion confirmation.
- Environment configuration, safe sample seeding, automated tests, and a dependency lockfile.

This is a course/portfolio CRUD project with **no user accounts or access control**: anyone who can reach the server can edit its posts. It binds to `127.0.0.1` by default. Add authentication and authorization before offering public editing. `HOST=0.0.0.0` can expose the process to a hosting platform; use HTTPS and `NODE_ENV=production` there so cookies are secure. Hosting and Atlas resources are not provisioned by this source project.

## Commands

| Command              | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `npm start`          | Run against the configured MongoDB database                  |
| `npm run dev`        | Run MongoDB mode with Node's file watcher                    |
| `npm run demo`       | Run the persistent local demo                                |
| `npm run demo:dev`   | Watch files in demo mode                                     |
| `npm run seed`       | Add sample stories to an empty MongoDB collection            |
| `npm test`           | HTTP/CRUD, validation, security, and demo persistence checks |
| `npm run test:mongo` | Integration test against a temporary real MongoDB server     |
| `npm run check`      | Check JavaScript syntax and compile EJS templates            |

The MongoDB integration test downloads a MongoDB binary on first run and starts an isolated local process. It does not need your Atlas account. To use an existing **test database**, set `TEST_MONGODB_URI`; the test creates and deletes only its own test documents. Do not point tests at a production database.

## Routes

| Method | Path                | Purpose                                    |
| ------ | ------------------- | ------------------------------------------ |
| GET    | `/`                 | Redirect to the journal                    |
| GET    | `/posts`            | List, search, filter, and paginate stories |
| GET    | `/posts/new`        | Create form                                |
| POST   | `/posts`            | Create a story                             |
| GET    | `/posts/:id`        | Read a story                               |
| GET    | `/posts/:id/edit`   | Edit form                                  |
| PUT    | `/posts/:id`        | Update a story                             |
| GET    | `/posts/:id/delete` | Confirm deletion; does not mutate data     |
| DELETE | `/posts/:id`        | Delete a story                             |
| GET    | `/health`           | Process status and active storage mode     |

HTML forms submit POST requests with `_method=PUT` or `_method=DELETE`; the server verifies the CSRF token before applying the override. Direct PUT and DELETE requests also require the signed cookie and form token. `/health` is a liveness endpoint, not a database readiness probe.

## Project structure

```text
src/
  server.js                  Environment, database connection, process lifecycle
  app.js                     Express middleware and RESTful routes
  models/Post.js             Mongoose schema, validation, indexes, timestamps
  repositories/mongo.js      MongoDB persistence
  repositories/file.js       Explicit local demo persistence
  middleware/csrf.js         Signed-cookie form protection
  lib/posts.js               Validation, Markdown sanitizing, view helpers
  data/sample-posts.js       Original sample content
views/
  partials/                  Header, footer, and geometric cover templates
  posts/                     List, article, editor, and deletion pages
  error.ejs                  Friendly error screen
public/                      CSS, browser JavaScript, favicon
scripts/                     Seed and source checks
test/                        HTTP tests and real MongoDB integration test
```

The request flow is **browser → Express route → repository → MongoDB → EJS → HTML**. Form data is allowlisted and validated before writes. EJS escapes text fields, and Markdown HTML is sanitized before the one intentional raw-content render.

## Troubleshooting

- **No database connection:** confirm the cluster is running, the database user/password is correct, and Atlas allows your IP. A database user is separate from your Atlas login.
- **Port already in use:** change `PORT` in `.env` (for example, `3001`).
- **Expired form:** refresh the page and retry. Restarting development without a fixed cookie secret invalidates open forms.
- **PowerShell blocks `npm.ps1`:** use `npm.cmd` in place of `npm`; do not change your execution policy just for this project.
- **No sample posts:** seed MongoDB explicitly with `npm run seed`. Clearing all demo posts does not automatically recreate them.

## Push after completing the course

The project has not been pushed to GitHub. After reviewing the code and confirming `.env` is ignored, create an empty `Praneeth7171/blog-platform` repository and run:

```sh
git init
git add .
git commit -m "Build full-stack blog platform"
git branch -M main
git remote add origin https://github.com/Praneeth7171/blog-platform.git
git push -u origin main
```

If the remote already contains work, clone it and integrate this project instead of overwriting its history.

## Reference documentation

- [Express routing](https://expressjs.com/en/guide/routing/)
- [EJS templating](https://ejs.co/)
- [Mongoose schemas](https://mongoosejs.com/docs/guide.html)
- [MongoDB Atlas connection guide](https://www.mongodb.com/docs/atlas/connect-your-application/)
