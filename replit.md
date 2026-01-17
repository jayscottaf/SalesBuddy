# Salesbuddy CRM

## Overview
Salesbuddy is a sales meeting transcript analysis tool with AI-powered coaching. It provides a React frontend with a Node.js/Express backend, now with persistent PostgreSQL database storage.

## Project Structure
- `client/` - React + Vite frontend (runs on port 5000)
- `server/` - Express API backend (runs on port 3001)
- `shared/` - Shared TypeScript types and Drizzle schema
- `api/` - Vercel serverless functions (not used in Replit)

## Running the Application
The app uses `npm run dev` which starts both frontend and backend concurrently:
- Frontend: Vite dev server on 0.0.0.0:5000
- Backend: Express API on localhost:3001

The frontend proxies `/api` requests to the backend.

## Database
Uses PostgreSQL with Drizzle ORM. The `analyses` table stores all transcript analyses.
- Schema: `shared/schema.ts`
- Database connection: `server/db.ts`
- Push schema changes: `npm run db:push`

## Configuration
- `DATABASE_URL` - PostgreSQL connection string (automatically set by Replit)
- `OPENAI_API_KEY` - Optional. If not set, the app uses fallback analysis.

## Authentication
Uses Replit Auth for user login. In development mode (NODE_ENV !== 'production'), authentication is bypassed with a dev user for easier testing.

## Teams & Collaboration
- Teams table allows creating team workspaces
- Team members can share analyses within their team
- Analyses can be personal (userId only) or team-shared (teamId)
- All team-scoped endpoints verify membership before access

## Recent Changes
- 2026-01-17: Added team collaboration with membership verification
  - Created teams and teamMembers tables
  - Analyses can be scoped to teams
  - Added security checks for team membership on all team endpoints
- 2026-01-17: Added Replit Auth integration
  - Users and sessions tables for authentication
  - Development mode bypass for easier testing
- 2026-01-17: Added persistent database storage
  - Created PostgreSQL database with Drizzle ORM
  - All transcript analyses now persist to the database
  - Schema uses JSONB for complex nested fields (intent, coaching, etc.)
- 2026-01-17: Configured for Replit environment
  - Updated Vite to use port 5000 with allowedHosts for proxy support
  - Moved backend to port 3001 to avoid conflicts
  - Fixed tsx execution for server dev mode
