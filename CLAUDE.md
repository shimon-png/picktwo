# CLAUDE.md — instructions for building PickTwo

You are building **PickTwo**, a standalone, mobile-first web app deployed on Vercel. The full spec is in [`PRD.md`](./PRD.md). Read it fully before writing code.

## How to work

1. Build milestone by milestone, in the order of PRD Section 18 (M0 → M6). Do not start a milestone until the previous one typechecks, lints and passes tests.
2. Where the PRD marks something **[Default]**, implement the default — don't stop to ask.
3. Keep business logic in `src/server/services/*` as pure functions that take a Prisma transaction client. UI (Server Actions) and Route Handlers both call services.
4. All point changes go through `awardPoints()` in `services/points.ts` (ledger row + balance update in one transaction, idempotent).
5. All economy numbers (PRD 5.3) are read from `AppConfig` via `services/config.ts` with in-code defaults — never hard-code them elsewhere.
6. Validate every input with zod. Rate-limit every mutation.
7. The app must run locally with only `DATABASE_URL`, `AUTH_SECRET` (and optionally `AUTH_RESEND_KEY`). Missing optional services must degrade gracefully (see PRD 17.2).
8. Implement lazy close (closing past-deadline battles on read) so correctness never depends on cron.
9. Write unit tests (Vitest) for: points service, feed ranking, reputation, open-loop counting, reminder scheduling. Write Playwright e2e for the PRD Section 19 checklist.

## Commands

```bash
npm install
cp .env.example .env.local   # fill DATABASE_URL + AUTH_SECRET
npx prisma migrate dev
npm run db:seed
npm run dev
npm run typecheck && npm run lint && npm test
```

## Conventions

- TypeScript strict, no `any`.
- Next.js 15 App Router, React 19, Tailwind v4, shadcn/ui, lucide-react, framer-motion.
- Prisma + Neon Postgres, Auth.js v5, Vercel Blob, Resend.
- Colours: Option A indigo `#5B5BD6`, Option B coral `#F2665E`, points amber `#F5A524`.
- Never collect children's names, birthdates or photos of faces; kid info is age ranges only.
- Commit at the end of each milestone with a message like `feat(M3): priority queue`.
