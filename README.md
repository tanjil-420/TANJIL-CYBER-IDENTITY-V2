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
- `APP_URL`: the public base URL of this deployed website
- `PORT`: optional locally; Render provides its own port

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
- `/api/health`: database and schema health
