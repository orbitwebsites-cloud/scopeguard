# ScopeGuard — Dev Setup

> Only build after 5 founding members have charged (see `../SCOPEGUARD-PRESELL-KIT.md`).

## 1. Install dependencies

```bash
npm install
```

## 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Copy **Project URL** and **anon key** (Settings → API)
3. Copy **service role key** (same page, keep secret)
4. Apply migrations in order:
   ```bash
   # via Supabase dashboard SQL editor, or:
   npx supabase db push
   ```
   Or paste `supabase/migrations/001_schema.sql` then `002_rls.sql` into the SQL editor.
5. Enable **Google OAuth** (Authentication → Providers → Google) — needs Google Cloud credentials
6. Set redirect URL: `https://your-app.vercel.app/auth/callback`

## 3. Create Stripe products

Dashboard → Product catalog → + Add product:

| Product | Price | Type |
|---|---|---|
| ScopeGuard Pro | $29.00/mo | Recurring |
| ScopeGuard Pro | $290.00/yr | Recurring |
| ScopeGuard Founding Lifetime | $99.00 | One-time |

Copy the **price IDs** into `.env.local`.

Enable **Stripe webhook**: endpoint URL → `https://your-app.vercel.app/api/stripe/webhook`
Events: `checkout.session.completed`, `customer.subscription.deleted`

## 4. Set up Resend

1. [resend.com](https://resend.com) → API Keys → + Create key
2. Add and verify your domain (Domains → Add)
3. Set `EMAIL_FROM=hello@yourdomain.com`

## 5. Configure .env.local

```bash
cp .env.local.example .env.local
# Fill in all values — see the example for what's needed
```

## 6. Run locally

```bash
npm run dev
# → http://localhost:3000
```

## 7. Deploy to Vercel

```bash
# Push to GitHub first, then:
# Vercel dashboard → Import → set env vars → Deploy
# Or:
npx vercel --prod
```

Set all env vars in Vercel dashboard (Settings → Environment Variables).
The cron job in `vercel.json` runs daily at 08:00 UTC.

## Day-by-day build order

| Day | What to ship |
|---|---|
| 1 ✅ | This scaffold — auth, workspace bootstrap, schema, RLS |
| 2 | Project create + meters + entry logging + live meter bars |
| 3 | Threshold engine + scope_events + Resend emails + cron |
| 4 | Change-order modal + React-PDF generation + email-with-PDF |
| 5 | Stripe (3 prices) + plan gating + branding settings + onboard founders |

**Day 2 demo target:** log in, create a project, log some revisions, see the meter bars update.  
Send this URL to your 5 founding members to keep them warm while you finish Days 3–5.
