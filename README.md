# PickTwo

**Help me choose, and tell me whether I chose well.**

PickTwo is a social app for real decisions: post a "this or that" battle, get fast votes from friends and people like you, then report back which option you picked and how it went (👍 / 👎). Helping others and closing the loop earns you **priority**, so your own questions get answered faster.

- 📄 Product spec: [`PRD.md`](./PRD.md)
- 🤖 Build instructions for Claude Code: [`CLAUDE.md`](./CLAUDE.md)

## Build it with Claude Code

```bash
git clone https://github.com/<you>/picktwo.git
cd picktwo
claude "Read PRD.md and CLAUDE.md, then build milestone M0."
```

Continue milestone by milestone (M0 → M6, PRD Section 18).

## Stack

Next.js 15 · TypeScript · Tailwind + shadcn/ui · Prisma + Neon Postgres · Auth.js v5 · Vercel Blob · Resend · Vercel Cron

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. In the project's **Storage** tab, add **Neon Postgres** and **Blob** (optionally **Upstash Redis**).
4. Add the remaining variables from `.env.example`.
5. Deploy. Migrations run during build; seed once with `npm run db:seed`.

See PRD Section 17 for details.
