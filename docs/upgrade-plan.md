# HostelCare+ Upgrade Plan (v2)

Status: planning approved 2026-08-24 · baseline: v1 live at https://hcplus-phi.vercel.app
Supersedes the remaining open items in [future-scope.md](./future-scope.md).

## Guideline sources for the UI phase ("famous design skills")

- **Refactoring UI** (Wathan & Schoger) — visual hierarchy, spacing/systemization, elevation, restrained color
- **shadcn/ui** — component API conventions & variants for React + Tailwind
- **Radix UI** — accessible primitives reference (dialogs, dropdowns, toasts)
- **Material Design 3** — color-role & state-layer token modeling
- **Apple HIG** — mobile ergonomics, touch targets, motion restraint
- **WCAG 2.2 AA** — contrast, focus visibility, keyboard paths

---

## Phase 1 — UI Upgrade (current phase)

### 1.1 Design tokens (Tailwind v4 `@theme`)
- Self-hosted **Inter** (UI) + tabular numerals for data columns
- Neutral base scale (zinc) + single accent (replace default indigo-everything)
- Semantic tokens: success / warning / danger / info mapped to complaint states
- Elevation scale (border → subtle shadow → overlay), consistent radius scale
- Full **dark mode** (class strategy) + persisted toggle

### 1.2 Component library rebuild (`components/ui.jsx` → `components/ui/`)
Button (primary/secondary/ghost/destructive × sm/md/lg), Input, Select, Textarea,
Field (label + hint + error), Card, Badge (status/priority dots), Table, Tabs,
Dialog, DropdownMenu, Toasts, Skeleton, EmptyState, Avatar, Pagination.

### 1.3 App shell & navigation
- Desktop: fixed sidebar + topbar; Mobile: bottom nav bar (thumb-reach, HIG)
- Page header pattern (title / description / actions slot) on every route
- Breadcrumbs on detail pages

### 1.4 Screens refreshed against real content
Login/Register, Awaiting Approval, student dashboard, New Complaint (stepped form),
detail page (timeline + comments), staff queue (dense data table + filters),
approvals, users admin, profile.

### 1.5 Quality bar
- WCAG AA contrast, `focus-visible` rings everywhere, aria labels
- Motion ≤200ms, respects `prefers-reduced-motion`
- No layout shift; skeleton loaders on all async views

## Phase 2 — Security & account essentials
1. Rate limiting on auth endpoints (per-IP sliding window + lockout)
2. Forgot/reset password flow; interim admin-issued one-time reset links
3. Change password; edit name / hostel / room / phone in Profile

## Phase 3 — Complaint attachments
4. Vercel Blob storage (~1GB free tier; client-side compression, max 3/complaint)
5. Upload UI on New Complaint + gallery on detail page

## Phase 4 — SMS notifications
6. Provider-agnostic notifier (`console` adapter live immediately)
7. Hooks: approved / claimed / resolved / rejected / reopened / staff comment
8. Phone capture at register, invite, profile; adapter slots for MSG91/Fast2SMS/Twilio

## Phase 5 — Analytics & feedback
9. Staff analytics page: resolution-time trends, category/hostel breakdowns
10. Satisfaction rating (stars) on resolved complaints → CSAT stat

---

## Feature menu (pick any)

| # | Feature | Notes |
|---|---|---|
| A | Kanban board | Drag-drop staff queue by status |
| B | Bulk actions | Multi-select queue rows → assign/priority/resolve |
| C | SLA escalation | Auto-flag complaints stuck >48h; badge + SMS nudge |
| D | Notices board | Warden/admin announcements visible to all students |
| E | Duplicate detection | Warn when filing similar open complaint (hostel+category) |
| F | CSV export | Staff export of filtered complaints |
| G | Watchlist | Staff follow complaints for change notifications |
| H | Saved filters | Named filter presets per user |
| I | PWA | Installable, offline shell, app icon |
| J | i18n | Tamil / Hindi strings |
| K | QR posters | Per-hostel QR prefills location on New Complaint |
| L | Comment @mentions | Mention staff → notification |
| M | PDF/print report | Printable complaint summary |

## Execution rules
- Each phase: implement → extend tests → verify locally → deploy → push
- Target ≥75 backend tests by end of Phase 4
