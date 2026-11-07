# TANJIL Cyber Identity — Skill-Based Community Platform

TANJIL Cyber Identity is a Node.js, Express and PostgreSQL community platform for profiles, skill learning, project challenges, events and member messaging.

## Requirements
- Node.js 20 or later, below 27
- PostgreSQL

## Environment variables
Create a local `.env` file from `.env.example`.

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: long, random secret used to sign sessions
- `NODE_ENV`: `development` locally; `production` on Render
- `APP_URL`: the public base URL of this deployed website
- `PORT`: optional locally; Render provides its own port
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`: optional admin bootstrap values; use a strong password of at least 12 characters and remove it after setup

Never commit `.env` or share the values of `DATABASE_URL` and `SESSION_SECRET`.

## Database initialization
At startup, `index.js` runs the idempotent SQL in `database/schema.sql`. It creates missing project tables and adds the profile fields needed for skills and visitor tracking. Existing rows are not deleted. The database user configured in `DATABASE_URL` must have permission to create tables and indexes and alter the `profiles` table.

## Run locally
```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Render deployment
Set the environment variables in the Render Web Service's Environment settings. Use the PostgreSQL Internal Database URL when the service and database are in the same Render region. Set `APP_URL` to the actual public service URL (not `https://render.com`). Deploy the latest commit and check `/api/health`.

## Main routes
- `/api/auth`: register, login, current user and logout
- `/api/profile`: profile read/update and public profile data
- `/api/site/stats`: unique visitor and member statistics
- `/api/dashboard`: authenticated dashboard data
- `/api/chat`: private and group messaging
- `/api/challenges`: member submissions and admin challenge/review operations
- `/api/admin`: owner analytics, member, role and rank management
- `/api/health`: database and schema health


## Platform-owner setup
Set `ADMIN_USERNAME` and a strong `ADMIN_PASSWORD` in Render Environment to promote an existing account to admin and initialize its password. For a brand-new admin account, also set `ADMIN_EMAIL` (a real email address). The bootstrap password must be at least 12 characters. Remove `ADMIN_PASSWORD` after successful deployment so restarts do not reset the password. Regular registrations require at least 6 characters.


## V2.3 — Seven-Day Skill Test + Messenger upgrades

- The 7-Day Skill Test creates seven skill-based tasks for each member. A new task unlocks every 24 hours. Members submit a project description and optional HTTPS link.
- Owner review supports approval or revision requests. Seven approved tasks award the non-privileged **SKILL GRADUATE** achievement.
- Web Development has a seven-project track, including a responsive portfolio, validated form, task manager, data dashboard, theme system, multi-page site and capstone. Dedicated tracks are included for Web Development, Video Editing, Graphic Design, Digital Marketing, Digital Art, Software & Automation, Photography, Gaming, Music & Audio, UI/UX Design, 3D & Animation and Content Creation; other skills receive a general skill-showcase track.
- Messenger now supports hover/tap reply actions, quoted replies, conversation avatars, and a chat-info panel that displays a public ID only when the member profile is public.
- Admin/Owner/Controller/Operator privileges are never awarded by event completion; privileged roles remain under the Platform Owner control.

### Render deployment

Upload the project files to the GitHub repository and deploy. The startup migration in database/schema.sql creates the Skill Test tables and message reply field automatically. Check /api/health after deployment; V2.3 expects the skill_test_enrollments and skill_test_tasks tables as well.

### Owner account bootstrap

For an existing registered owner account, set `ADMIN_USERNAME` and a strong `ADMIN_PASSWORD` in Render once. If the username does not exist yet, also set `ADMIN_EMAIL` so startup can create it. After the first successful boot, remove `ADMIN_PASSWORD` from Render so future restarts do not reset it.


## V2.4 Notes

- Messenger and Skill Test now show explicit Home, Dashboard, Profile, and Event navigation links.
- Profile photo upload includes a square crop preview with zoom and horizontal/vertical positioning controls. The final image is compressed before it is saved.
- Messenger avatar dimensions are explicitly fixed for conversation list, header, message, search, and info panel placements.

## V2.5 Professional Edition

- Messenger supports replies, reactions, per-message seen receipts, typing indicators, and live online presence.
- Owners can review platform analytics, manage member status/roles/ranks, create skill challenges, and approve or request revisions to submissions.
- Members can submit work to skill challenges. Approved work earns achievements; the seven-day event remains available and now updates persistent ranks and achievements.
- Public profiles use `/user/:username` and display rank, achievements, skills, and a founder badge for admin accounts. Existing query-based URLs remain supported.
- Dark, Light, AMOLED, Cyber Blue, and Neon Purple themes are available throughout the app, with mobile bottom navigation.
- See [V2.5_IMPLEMENTATION_PLAN.md](V2.5_IMPLEMENTATION_PLAN.md) for the repository assessment, delivered scope, remaining rollout, and production acceptance criteria.

### Windows JavaScript files

Do not double-click `.js` files such as `config/database.js`. They are Node.js source modules, not Windows Script Host scripts. Open them in Visual Studio Code or Notepad. Run the application from the project folder using `npm install` and then `npm start` in Windows Terminal / PowerShell. `config/database.js` is imported by `index.js`; it is not meant to be launched by itself.

### Render Admin Environment

Create these as three separate Environment Variables in Render (do not paste them as one combined line):

- `ADMIN_USERNAME` = `tanjil.4x`
- `ADMIN_PASSWORD` = your chosen strong admin password (at least 12 characters)
- `ADMIN_EMAIL` = your full, correct email address (use `gmail.com`, not a misspelling)

If the username already exists in the database, `ADMIN_EMAIL` is not needed for bootstrap. After the first successful admin initialization, remove `ADMIN_PASSWORD` from Render so the app does not reset that password every time it restarts.
