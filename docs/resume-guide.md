# Resume Guide — how to pick this project back up

Everything is committed to GitHub. Nothing needs to survive locally.

## Where things stand

- Repo: https://github.com/KishorePrabakar/hcplus
- Code state: backend has Express 5 hello-world (`backend/src/app.js` with `/` and `/health`). Frontend folder is empty. No dependencies installed anywhere.
- Design state: Approach A + Sections 1–2 (architecture/data model, lifecycle/permissions) approved and written up.
  - Read first: [`docs/design-spec.md`](./design-spec.md)
  - Work queue: [`docs/future-scope.md`](./future-scope.md)

## Steps to resume

1. Clone fresh:
   ```
   git clone https://github.com/KishorePrabakar/hcplus.git
   cd hcplus/backend && npm install
   cd ../frontend && npm create vite@latest . -- --template react
   npm install && npm install tailwindcss @tailwindcss/vite react-router-dom @tanstack/react-query
   ```
2. Create free accounts (all free tiers):
   - **Neon** → new project → copy connection string
   - **Render** → will host backend later
   - **Vercel** or **Netlify** → will host frontend later
3. In `backend/.env`: `DATABASE_URL="postgres://..."`, generate JWT secrets (`openssl rand -hex 32` ×2).
4. Add Prisma: `npm install prisma @prisma/client` → `npx prisma init` → model the 4 tables + RefreshToken exactly as specified in `docs/design-spec.md` → `npx prisma migrate dev --name init`.
5. Hand the spec to your coding agent and ask it to run the **writing-plans** workflow against `docs/design-spec.md` + `docs/future-scope.md`, then implement in this order:
   auth → user management/approvals → complaints CRUD/lifecycle → comments/status events → frontend scaffold → pages → deploy.

## Environment variable checklist

| Var | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | Neon connection string |
| `JWT_ACCESS_SECRET` | backend | short-lived token signing |
| `JWT_REFRESH_SECRET` | backend | refresh token signing |
| `CORS_ORIGIN` | backend | frontend URL allowlist |
| `NODE_ENV` | backend | production flag on Render |
| `VITE_API_URL` | frontend | points at Render backend URL |

## Known trade-offs accepted

- Render free tier sleeps after ~15 min idle → ~30 s cold start on first request. Fine for a hostel tool.
- Neon free tier has storage/connection limits — fine at campus scale; upgrade path exists.
