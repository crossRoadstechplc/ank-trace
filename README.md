# Ankuaru / Ank-Track-Leads

Next.js demo of the Ankuaru coffee lot ledger with email OTP login and a hidden admin leads panel.

## Setup

1. Copy env and fill values:

```bash
cp .env.example .env.local
```

2. Required secrets in `.env.local`:

- `DATABASE_URL` / `DIRECT_URL` — Supabase Postgres connection strings
- `AUTH_SECRET` — `openssl rand -base64 32`
- `ADMIN_PASSWORD` — password for the Ctrl+Alt+A leads popup

3. Install, migrate, run:

```bash
npm install
npx prisma migrate dev --name init
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the **email form** first.

## Auth

- Anyone can request an email OTP (becomes a **lead**).
- Sessions last **6 hours** (`SESSION_HOURS`), then users are logged out.
- Fill `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (and usually `EMAIL_FROM`) to send OTPs via Nodemailer. If those are empty, the OTP is printed in the **server console**.

## Admin leads (hidden)

Press **Ctrl+Alt+A** (Control+Option+A on Mac), enter `ADMIN_PASSWORD`, and view all leads with login counts and timestamps. There is no visible admin button.

## Notes

- The coffee ledger itself is in-memory and re-seeded on load (same as the reference HTML demo).
- Only users, OTP challenges, and login events are stored in Postgres.
