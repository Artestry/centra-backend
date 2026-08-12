# Centra Path — Backend

REST API backend for the Centra Path iOS/Android career management app.

Bundle ID: com.salgaribay.centrapath

## Prerequisites

- Bun >= 1.1 (https://bun.sh)
- Node.js >= 20 (for Prisma CLI compatibility)

## Install

```bash
cd backend
bun install
```

## Environment setup

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required at runtime:
- `DATABASE_URL` — SQLite path, e.g. `file:./dev.db`
- `BETTER_AUTH_SECRET` — any random 32-char string (`openssl rand -hex 32`)
- `BETTER_AUTH_URL` — base URL where the server is reachable (e.g. `http://localhost:3000`)

Optional (features degrade gracefully without them):
- `RESEND_API_KEY` — enables transactional email; without it, OTPs are logged to stdout
- `OPENAI_API_KEY` — enables AI guidance endpoints (Pro-gated); returns 503 if absent
- `REVENUECAT_WEBHOOK_SECRET` — validates RevenueCat webhook signatures; skips verification if absent

## Database

Push the schema to a new SQLite file (dev, no migration history):

```bash
bun run db:push
```

Or use tracked migrations for production:

```bash
bun run db:migrate
```

Regenerate the Prisma client after schema changes:

```bash
bun run db:generate
```

## Development

```bash
bun run dev
```

Hot-reload is enabled. The server starts on port 3000 (configurable via `PORT`).

## Production

```bash
bun run start
```

## Type checking

```bash
bun run typecheck
```

## Project structure

```
backend/
├── src/
│   ├── index.ts                 Hono app entry point (port 3000)
│   ├── lib/
│   │   ├── env.ts               Zod-validated environment loader
│   │   ├── prisma.ts            PrismaClient singleton
│   │   ├── auth.ts              Better Auth instance (emailOTP + Resend)
│   │   ├── errors.ts            AppError class + global error handler
│   │   ├── ai.ts                OpenAI client + runPrompt helper
│   │   ├── email.ts             Resend client + OTP email template
│   │   └── storage.ts           Local file storage helpers
│   ├── middleware/
│   │   ├── session.ts           Enforces authenticated session (401 if absent)
│   │   ├── optional-session.ts  Hydrates session if present, allows anon
│   │   └── pro.ts               Enforces PRO subscription tier (402 if absent)
│   ├── prompts/
│   │   ├── resume-suggestions/v1.ts
│   │   ├── cover-letter-outline/v1.ts
│   │   └── interview-prep/v1.ts
│   └── routes/
│       ├── health.ts            GET /api/health
│       ├── profile.ts           GET / PATCH /api/profile
│       ├── experience.ts        CRUD /api/experience
│       ├── education.ts         CRUD /api/education
│       ├── skills.ts            CRUD /api/skills
│       ├── documents.ts         CRUD /api/documents (multipart upload)
│       ├── applications.ts      CRUD /api/applications + events sub-resource
│       ├── reminders.ts         CRUD /api/reminders + /complete action
│       ├── notifications.ts     List + bulk-read /api/notifications
│       ├── analytics.ts         POST event + GET summary /api/analytics
│       ├── ai-guidance.ts       Pro-gated AI endpoints /api/ai-guidance
│       ├── webhooks.ts          POST /api/webhooks/revenuecat
│       └── devices.ts           Register / delete device tokens /api/devices
├── prisma/
│   └── schema.prisma
├── storage/                     Local file storage (excluded from git)
├── .env.example
├── .gitignore
├── tsconfig.json
└── package.json
```

## API overview

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | /api/health | none | DB connectivity check |
| POST | /api/auth/* | — | Better Auth (emailOTP flow) |
| GET PATCH | /api/profile | session | Auto-creates profile on first GET |
| GET POST PATCH DELETE | /api/experience/:id? | session | Work experience CRUD |
| GET POST PATCH DELETE | /api/education/:id? | session | Education CRUD |
| GET POST PATCH DELETE | /api/skills/:id? | session | Skills CRUD |
| GET POST DELETE | /api/documents/:id? | session | Multipart upload; soft delete |
| GET POST PATCH DELETE | /api/applications/:id? | session | Full CRUD; status transitions validated |
| POST | /api/applications/:id/events | session | Manual event log entry |
| GET | /api/applications/:id/events | session | List events |
| GET POST PATCH DELETE | /api/reminders/:id? | session | Automated reminders are Pro-gated |
| POST | /api/reminders/:id/complete | session | Mark reminder done |
| GET | /api/notifications | session | `?unreadOnly=true` supported |
| PATCH | /api/notifications/read | session | Mark notifications read (all or by id) |
| POST | /api/analytics/events | session | Track custom event |
| GET | /api/analytics/summary | session | Count per event name |
| POST | /api/ai-guidance/resume-suggestions | session + Pro | GPT-4o-mini |
| POST | /api/ai-guidance/cover-letter-suggestions | session + Pro | GPT-4o-mini |
| POST | /api/ai-guidance/interview-prep | session + Pro | GPT-4o-mini |
| POST | /api/webhooks/revenuecat | HMAC | Updates subscription tier |
| POST DELETE | /api/devices/:token? | session | Push token management |

## Authentication flow (emailOTP)

1. Client calls `POST /api/auth/email-otp/send-otp` with `{ email }`.
2. Server sends a 6-digit OTP via Resend (or logs it if `RESEND_API_KEY` is absent).
3. Client calls `POST /api/auth/email-otp/verify-otp` with `{ email, otp }`.
4. Server returns a session cookie used for all subsequent requests.

## Subscription tiers

- `FREE` — full access to core features.
- `PRO` — unlocks automated reminders and all AI guidance endpoints.

Tier is managed by RevenueCat. Webhook at `POST /api/webhooks/revenuecat` updates `Profile.subscriptionTier` and `Profile.subscriptionExpiresAt` based on purchase / cancellation events.

## File storage

Uploaded documents are stored under `STORAGE_DIR/<userId>/<cuid>.<ext>`. The `storage/` directory is excluded from git via `.gitignore`. Set `STORAGE_DIR` to an absolute path in production.

Document text parsing is stubbed — see `src/lib/storage.ts` `parseDocument`.
