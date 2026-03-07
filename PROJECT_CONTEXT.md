# Project Context

## Overview
Kitchen operations app built with SvelteKit and deployed to Cloudflare Pages.

## Stack
- Language: TypeScript / JavaScript
- Framework: SvelteKit
- Database: Cloudflare D1 (binding: `DB`)
- APIs: SvelteKit route handlers (`/api/*`)

## Folder Structure
src/ - main source code
tests/ - tests
scripts/ - automation
migrations/ - D1 SQL migrations

## Development Rules
- Keep functions under 100 lines
- Prefer async functions
- Use environment variables for secrets

## Database Setup (Temps + Auth)
1. Ensure Wrangler is authenticated:
   - `npx wrangler login`
2. Apply schema locally:
   - `npm run db:migrate:local`
3. Apply schema to Cloudflare D1:
   - `npm run db:migrate:remote`
4. Apply content/list schema:
   - Local: `npm run db:migrate:content:local`
   - Remote: `npm run db:migrate:content:remote`
5. Optional IoT write protection:
   - Set Cloudflare secret `IOT_API_KEY`
   - Send header `x-api-key: <value>` in POST `/api/temps`

## Tasks for Codex
- Help refactor code
- Suggest improvements
- Write tests
