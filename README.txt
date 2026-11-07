TANJIL.EXE - CYBER IDENTITY PLATFORM

Node.js 20-26, Express and PostgreSQL application for profiles, learning guides,
the Skill Test event and private/group messaging.

Quick start:
1. Copy .env.example to .env and configure DATABASE_URL and SESSION_SECRET.
2. Run npm install.
3. Run npm run dev, then open http://localhost:3000.

The app applies database/schema.sql at startup. The database user needs permission
to create and update the application tables. Use npm start for the production
server and npm test for the built-in tests.

For the complete environment-variable list, HTTP route inventory, Socket.IO
events and deployment instructions, see README.md.
