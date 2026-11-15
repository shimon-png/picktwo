# CLAUDE.md — working on PickTwo

PickTwo is a standalone, mobile-first Next.js app deployed on Vercel. The product spec is [`PRD.md`](./PRD.md); MVP milestones M0–M6 are implemented. Use this file when extending it.

## Architecture rules

1. Business logic lives in `src/server/services/*`. API routes (`src/app/api/**`) stay thin: auth → rate limit → zod parse → service call, wrapped in `handler()` from `src/server/api.ts`.
2. **All Priority Point changes go through `awardPoints()`** in `services/points.ts` (ledger row + balance in one transaction, idempotent via `idemKey`).
3. Economy numbers come from `getEconomy()` (`services/config.ts`, defaults in `src/lib/constants.ts`, overridable in the admin panel). Never hard-code them.
4. Pure math (priority, ranking, reputation, reminders) lives in `services/priority.ts`, `services/ranking.ts`, `services/reputation.ts` and has unit tests — keep it pure.
5. Battles close lazily on read (`getBattleRow`) as well as by cron. Never rely on cron for correctness.
6. Raw `sql` templates: pass dates as ISO strings, not `Date` objects (postgres.js limitation).
7. Children's safety: kid info is age ranges only — never names, birthdates or face photos.

## Commands

```bash
npm run dev            # local dev
npm run typecheck && npm run lint && npm test
npm run db:generate    # after editing src/server/db/schema.ts
npm run db:migrate
npm run db:seed
npm run build && npm start && npm run test:e2e   # e2e needs DEV_LOGIN=true
```

## Stack

Next.js 15 App Router · React 19 · Tailwind v4 (custom utilities in `globals.css`) · Drizzle ORM + postgres.js · Auth.js v5 (JWT sessions; Resend email, Google, optional dev login) · Vercel Blob · Resend REST API · lucide-react.

## Next up (PRD §20)

AI predictions ("parents like you chose…"), affiliate params on `/go/[optionId]`, web push, brand battles, taste API, premium.
