# HostelCare+ — v1 Design Spec

Status: **Approved design (partial)** — Approach A + Sections 1–2 approved in brainstorming session on 2026-08-22.
Remaining sections are listed in [future-scope.md](./future-scope.md). Resume process is in [resume-guide.md](./resume-guide.md).

## Product summary

RBAC platform for hostel complaint management and grievance redressal for Students, Wardens, and Admins.
Goal: replace manual WhatsApp-style intimation with a systematic event-logged workflow, better than ERP modules, multi-platform web based.

## Decided approach (Approach A)

| Concern | Choice | Notes |
|---|---|---|
| Backend | Express 5 (existing `backend/`) + Prisma ORM | REST API, JSON |
| Database | PostgreSQL on **Neon** (free serverless tier) | Connection string via env var |
| Auth | JWT access token (~15 min) + refresh token (7 days) | Refresh in httpOnly cookie, rotated on use, hashed rows in DB table so logout/suspension revokes sessions |
| Passwords | bcrypt hashing | |
| Frontend | React 18 + Vite + Tailwind CSS + React Router + TanStack Query | SPA in `frontend/` |
| Hosting | Backend → **Render** free tier; Frontend → Vercel or Netlify free tier | Trade-off: Render free sleeps after ~15 min idle (~30 s cold start) |

Rejected alternatives: Supabase-centric (auth vendor coupling vs custom approval workflow), Cloudflare edge stack (abandons Node/Express foundation).

## Roles

- **STUDENT** — files and tracks own complaints
- **WARDEN** — reviews, claims, resolves; approves student signups
- **ADMIN** — everything warden can do + user management

## Data model (4 tables)

### User
`id`, `name`, `email` (unique), `passwordHash`, `role` (`STUDENT` / `WARDEN` / `ADMIN`), `status` (`PENDING` / `ACTIVE` / `SUSPENDED`), `hostel`, `roomNumber`, timestamps.

Plus `RefreshToken` table: hashed token, userId, expiry, revoked flag — enables rotation and revocation.

### Complaint
`id`, human-readable code (e.g. `HC-0042`), `title`, `description`,
category enum: `ELECTRICAL`, `PLUMBING`, `INTERNET`, `MESS`, `CLEANLINESS`, `FURNITURE`, `SECURITY`, `OTHER`,
priority enum: `LOW`, `MEDIUM`, `HIGH`, `URGENT`,
status enum: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `REJECTED`,
`createdBy` → User, `assignedTo` → User (warden, nullable), `resolutionNote`, `resolvedAt`, `closedAt`, timestamps.

### Comment
`complaintId`, `authorId`, `body`. Single thread per complaint, visible to owner + staff.

### StatusEvent
`complaintId`, `actorId`, `fromStatus` → `toStatus`, `note`, timestamp.
Every transition writes a row — this is the product's core "proper log of events". Rendered as a vertical timeline in the UI.

## Complaint lifecycle

```
                    ┌────────── reopen (≤72h after resolve) ──────────────┐
                    ▼                                                     │
OPEN ──claim──> IN_PROGRESS ──resolve+note──> RESOLVED ──student confirms──> CLOSED
  │                  │
  └──reject+reason──>┴──> REJECTED (terminal)
```

- Student files → **OPEN**
- Warden claims → **IN_PROGRESS** (`assignedTo` = self); admin can assign any warden
- Warden resolves with note → **RESOLVED**
- Student confirms fixed → **CLOSED**, or reopens within **72h** → back to **IN_PROGRESS** (reopen reason recorded)
- Staff can **REJECT** with required reason (spam / not actionable) — terminal
- Priority defaults to `MEDIUM`; student picks at creation, staff can change anytime

## Permission matrix

| Action | STUDENT | WARDEN | ADMIN |
|---|---|---|---|
| File complaint | own only | ✓ | ✓ |
| View complaints | own only | all | all |
| Comment | own complaints | any | any |
| Claim / reassign / status change | — | ✓ | ✓ |
| Change priority | — | ✓ | ✓ |
| Approve pending signups | — | students only | anyone |
| Manage users (create wardens/admins, suspend, bulk import, invites) | — | — | ✓ |

Enforcement: middleware (`requireRole`, `requireActive`) plus per-route ownership checks — never trust the client.

## Account creation policy (decided)

1. **Open student signup** → account created with status `PENDING`; can log in but sees "awaiting approval" and cannot file complaints until a warden or admin approves (one-click).
2. **Mass account creation** (admin) → easy UI, CSV paste/upload with room allocation columns.
3. **Invite-only flow supported** → generated invite links let users set their own password.

## V1 scope guardrails

Lean core only: auth + approvals, complaints CRUD + lifecycle, comments, priorities, dashboards.
Deferred to post-v1: file/photo attachments, email notifications, escalation chains / SLA timers.
