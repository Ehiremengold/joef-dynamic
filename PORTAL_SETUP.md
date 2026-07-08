# Joef Dynamic Portal — setup & deploy

The public site and the portal are one Next.js app. The portal is served from the
`portal.` subdomain and backed by Supabase (Postgres + Auth).

## 1. Create the Supabase project

1. Go to <https://supabase.com> → **New project** (free tier is fine). Pick a region
   close to Nigeria (e.g. `eu-west`).
2. When it's ready, open **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

## 2. Run the database migrations

In the Supabase dashboard → **SQL Editor**, run each file in order:

1. `supabase/migrations/0001_init.sql` — when prompted, choose **"Run and enable RLS"**
2. `supabase/migrations/0002_policies.sql`
3. `supabase/migrations/0003_entrance_access.sql`

(Or, with the Supabase CLI: `supabase link` then `supabase db push`.)

## 3. Configure environment

Copy `.env.local.example` → `.env.local` and fill in the values. Generate a session
secret with:

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Leave `NEXT_PUBLIC_PORTAL_HOST` unset for local dev.

## 4. Create the first administrator

```
node scripts/seed-admin.mjs
```

Uses `FIRST_ADMIN_*` from `.env.local`. Then sign in at `/portal/staff`. From there the
admin creates other staff (Staff accounts tab) and students (Students tab).

## 5. Run locally

```
npm run dev
```

- Public site: <http://localhost:3000>
- Portal: <http://localhost:3000/portal>

## 6. Deploy to Vercel

1. Push the repo to GitHub and import it at <https://vercel.com>.
2. In Vercel → **Settings → Environment Variables**, add all of `.env.local` (set
   `NEXT_PUBLIC_PORTAL_HOST=portal.joefdynamicschools.com`).
3. Deploy. Then **Settings → Domains**, add:
   - `joefdynamicschools.com` (+ `www`)
   - `portal.joefdynamicschools.com`
   Vercel shows the exact DNS records for each.

## 7. Point Hostinger DNS

In Hostinger → **Domains → DNS / Nameservers** for joefdynamicschools.com, add the
records Vercel shows — typically:

- Apex `@` → `A` record to Vercel's IP (or `ALIAS`/`ANAME` to `cname.vercel-dns.com`)
- `www` → `CNAME` → `cname.vercel-dns.com`
- `portal` → `CNAME` → `cname.vercel-dns.com`

DNS can take up to a few hours to propagate. Vercel issues HTTPS certificates
automatically once records resolve.

## How auth works (for maintainers)

- **Staff**: Supabase Auth (email + password). Profile + role in `public.staff`.
  Admins manage staff and students in-app.
- **Students**: `public.students` roster; log in with admission number + 6-digit PIN
  (bcrypt-hashed). A signed httpOnly cookie carries the session.
- **Entrance candidates**: the common entrance test is gated by a shared **access code**.
  In the staff section (Exams tab → "Entrance access code"), set a code ahead of time,
  **Activate (release)** it on test day so candidates can register, and **Deactivate
  (revoke)** it once the exam is over. Candidates register with name + phone + the code →
  candidate number → session for the test. No standing account.
- Correct answers never reach the browser — all exam data is served through the API
  using the service-role key, which strips `correct_index`.
- One attempt per taker per exam is enforced by a unique index in Postgres.

## Notes

- Supabase's free tier pauses after long inactivity; a paid tier (or a keep-alive
  ping) is worth it once the school is live. Paid tiers also include daily backups.
