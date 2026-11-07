# TANJIL.EXE — Cyber Identity Platform

TANJIL.EXE is a Node.js, Express and PostgreSQL portfolio, learning-guide and messenger platform.

## Requirements
- Node.js 20 or later, below 27
- PostgreSQL

## Environment variables
Create a local `.env` file from `.env.example`.

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: long, random secret used to sign sessions
- `NODE_ENV`: `development` locally; `production` on Render
- `APP_URL`: the base URL used in QR/profile links (`http://localhost:3000` locally; the public HTTPS URL in production)
- `PORT`: optional locally; Render provides its own port
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`: optional admin bootstrap values; leave blank unless intentionally creating or promoting an admin. Passwords must be at least 6 characters and no more than 72 UTF-8 bytes.

Never commit `.env` or share the values of `DATABASE_URL` and `SESSION_SECRET`.

## Database initialization
At startup, `index.js` runs the idempotent SQL in `database/schema.sql`. It creates missing project tables and adds the profile fields needed for skills and visitor tracking. Existing rows are not deleted. The database user configured in `DATABASE_URL` must have permission to create tables and indexes and alter the `profiles` table.

## Run locally
```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

`npm start` runs the production server without Nodemon. `npm test` runs the built-in Node.js tests.

## Render deployment
Set the environment variables in the Render Web Service's Environment settings. Use the PostgreSQL Internal Database URL when the service and database are in the same Render region. Set `APP_URL` to the actual public service URL (not `https://render.com`). Deploy the latest commit and check `/api/health`.

## HTTP API

| Method and path | Access | Frontend use |
|---|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` | Public for register/login; authenticated for logout | `public/app.js`; logout also in `public/js/dashboard.js` |
| `GET /api/auth/me` | Authenticated | `public/app.js`, `public/js/messenger.js`, `public/js/skill-test.js` |
| `GET /api/profile/me`, `PUT /api/profile/me`, `PATCH /api/profile/me` | Authenticated | `public/js/profile.js` reads and updates with `PATCH` |
| `PATCH /api/profile/visibility` | Authenticated | API endpoint; the profile editor currently updates visibility through `PATCH /api/profile/me` |
| `GET /api/profile/public/:username` | Public; only active, public profiles | `public/js/public-profile.js` |
| `GET /api/qr` | Authenticated | No separate page caller; dashboard QR is included by `/api/dashboard` |
| `GET /api/dashboard` | Authenticated | `public/js/dashboard.js` |
| `GET /api/site/stats` | Public | `public/app.js` |
| `GET /api/admin/stats`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/status`, `PATCH /api/admin/users/:id/role` | Admin | API endpoints; there is no admin HTML client |
| `GET /api/chat/users`, `POST /api/chat/private`, `POST /api/chat/groups`, `POST /api/chat/groups/:id/members`, `GET /api/chat/conversations`, `GET /api/chat/:id/info`, `GET /api/chat/:id/messages` | Authenticated; conversation endpoints also require membership | `public/js/messenger.js` |
| `GET /api/skill-test/me`, `POST /api/skill-test/start`, `POST /api/skill-test/tasks/:day/submit`, `GET /api/skill-test/rank-path` | Authenticated (the router applies authentication to all these paths) | `public/js/skill-test.js`; rank path is returned with `/me` |
| `GET /api/skill-test/admin/submissions`, `PATCH /api/skill-test/admin/submissions/:id` | Admin | `public/js/skill-test.js` on the event page |
| `GET /api/health` | Public | Operational health check; verifies PostgreSQL and required schema objects |

Unknown `/api/*` paths return JSON 404 responses. Public pages and static assets are served from `public/`.

## Socket.IO

The Socket.IO browser client is loaded by `public/messenger.html`; its handlers are in `public/js/messenger.js`. Connections require the same authenticated session cookie as the HTTP API.

| Event | Direction | Purpose |
|---|---|---|
| `chat:sync` | Client → server | Join the current user's conversation rooms |
| `chat:join` | Client → server | Join one conversation after membership validation |
| `chat:send` | Client → server | Send a message or reply; server acknowledges and emits `chat:new` |
| `chat:read` | Client → server | Update read time; server emits `chat:read:update` |
| `chat:new` | Server → client | New message in a joined conversation |
| `chat:read:update` | Server → client | Read-state update for a joined conversation |
| `connect`, `disconnect`, `connect_error` | Socket.IO lifecycle | Connection status shown in Messenger |


## Platform-owner setup
Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in Render Environment to promote an existing account to admin and initialize its password. For a brand-new admin account, also set `ADMIN_EMAIL`. Remove `ADMIN_PASSWORD` after successful initialization so restarts do not reset the password. Admin bootstrap passwords follow the same minimum length as registration and are limited to 72 UTF-8 bytes.


## V2.3 — Seven-Day Skill Test + Messenger upgrades

- The 7-Day Skill Test creates seven skill-based tasks for each member. A new task unlocks every 24 hours. Members submit a project description and optional HTTPS link.
- Owner review supports approval or revision requests. Seven approved tasks award the non-privileged **SKILL GRADUATE** achievement.
- Web Development has a seven-project track, including a responsive portfolio, validated form, task manager, data dashboard, theme system, multi-page site and capstone. Dedicated tracks are included for Web Development, Video Editing, Graphic Design, Digital Marketing, Digital Art, Software & Automation, Photography, Gaming, Music & Audio, UI/UX Design, 3D & Animation and Content Creation; other skills receive a general skill-showcase track.
- Messenger now supports hover/tap reply actions, quoted replies, conversation avatars, and a chat-info panel that displays a public ID only when the member profile is public.
- Admin/Owner/Controller/Operator privileges are never awarded by event completion; privileged roles remain under the Platform Owner control.

### Render deployment

Upload the project files to the GitHub repository and deploy. The startup migration in database/schema.sql creates the Skill Test tables and message reply field automatically. Check /api/health after deployment; V2.3 expects the skill_test_enrollments and skill_test_tasks tables as well.

### Owner account bootstrap

For an existing registered owner account, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in Render once. If the username does not exist yet, also set `ADMIN_EMAIL` so startup can create it. After the first successful boot, remove `ADMIN_PASSWORD` from Render so future restarts do not reset it.


## V2.4 Notes

- Messenger and Skill Test now show explicit Home, Dashboard, Profile, and Event navigation links.
- Profile photo upload includes a square crop preview with zoom and horizontal/vertical positioning controls. The final image is compressed before it is saved.
- Messenger avatar dimensions are explicitly fixed for conversation list, header, message, search, and info panel placements.

### Windows JavaScript files

Do not double-click `.js` files such as `config/database.js`. They are Node.js source modules, not Windows Script Host scripts. Open them in Visual Studio Code or Notepad. Run the application from the project folder using `npm install` and then `npm start` in Windows Terminal / PowerShell. `config/database.js` is imported by `index.js`; it is not meant to be launched by itself.

### Render Admin Environment

Create these as three separate Environment Variables in Render (do not paste them as one combined line):

- `ADMIN_USERNAME` = `tanjil.4x`
- `ADMIN_PASSWORD` = your chosen strong admin password
- `ADMIN_EMAIL` = your full, correct email address (use `gmail.com`, not a misspelling)

If the username already exists in the database, `ADMIN_EMAIL` is not needed for bootstrap. After the first successful admin initialization, remove `ADMIN_PASSWORD` from Render so the app does not reset that password every time it restarts.
