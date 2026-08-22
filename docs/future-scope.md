# Future Scope — what remains to design & build for v1

The approved foundation is in [design-spec.md](./design-spec.md). The items below were scoped in brainstorming but not yet fully designed or implemented. They are the immediate work queue, in rough build order.

## v1 — remaining design + implementation

### 1. Auth & account flows (detail)
- Endpoints: `register`, `login`, `refresh`, `logout`, `me`
- Pending-approval gating: `PENDING` users can authenticate but get a locked-down "awaiting approval" screen; complaint creation blocked server-side
- Warden/Admin approvals page: list of pending users, one-click Approve/Reject
- Admin bulk import: paste/upload CSV (name, email, hostel, room) with preview step before commit
- Invite tokens: single invite per email or bulk-generated link list; `/accept-invite/:token` page sets password → ACTIVE

### 2. API surface (sketch from brainstorming)
```
POST   /api/auth/register | login | refresh | logout
GET    /api/auth/me
GET    /api/users                     (staff, filters: role/status)
PATCH  /api/users/:id/status          (approve/suspend)
POST   /api/users/staff               (admin creates warden/admin)
POST   /api/users/bulk                (admin CSV import)
POST   /api/invites                   (admin)  · GET/POST /api/invites/:token/accept
POST   /api/complaints                (student+)
GET    /api/complaints                (role-scoped; filters status/category/priority/search; paginated)
GET    /api/complaints/:id
PATCH  /api/complaints/:id/status     (claim/resolve/reject/reopen/close)
PATCH  /api/complaints/:id/assign     (self-claim or admin assign)
POST   /api/complaints/:id/comments
GET    /api/stats/dashboard           (role-scoped counts)
GET    /health                        (exists already in backend/src/app.js)
```

### 3. Frontend pages & UX
- Public: Login, Register, Accept Invite, Awaiting Approval
- Student: dashboard (my complaints, quick stats, prominent "New Complaint"), complaint form (icon category picker, priority), detail page (status timeline + chat-style comments), profile
- Staff: queue dashboard (stat cards + filterable table), all-complaints list, detail page with action buttons (Claim / Resolve / Reject / Reassign / priority), Approvals page, Users management (admin: roles, bulk-import wizard)
- Style: Tailwind, clean cards, mobile-first responsive, toasts, skeleton loaders

### 4. Error handling & validation
- Central Express error middleware, consistent `{ error: { code, message } }` shape
- Zod validation on backend inputs; react-hook-form (+zod) on frontend forms
- 401 handling: silent refresh attempt, then redirect to login

### 5. Testing
- Backend: Vitest + Supertest integration tests against a test database (separate Neon branch or local instance via `TEST_DATABASE_URL`)
- E2E: Playwright smoke suite covering register → approve → file → resolve → close happy path
- CI: GitHub Actions running lint + tests

### 6. Deployment wiring
- Neon project (free) → `DATABASE_URL`; migrations via `prisma migrate deploy`
- Render web service: env vars `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `NODE_ENV`
- Vercel/Netlify: `VITE_API_URL` pointing at Render URL; CORS allowlist on backend
- Seed script: 1 admin + sample wardens/students for demo

## Post-v1 backlog (explicitly deferred)

| Feature | Notes |
|---|---|
| Photo/file attachments on complaints | Cloudinary free tier |
| Email notifications on status changes | Resend free tier (~100/day) |
| Escalation chain (Warden → Chief Warden → Admin) with SLA timers | |
| Kanban board view for staff queues | |
| Analytics dashboards (trends, resolution times by category/hostel) | |
| PWA / mobile app packaging | |
| i18n | |
