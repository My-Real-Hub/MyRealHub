# MyRealHub

MyRealHub is a full-stack real estate services directory. It helps people find
real estate agents, mortgage brokers, home inspectors, lawyers, appraisers,
insurance brokers, contractors, photographers, stagers, property managers,
movers, cleaners, and other real estate-related professionals.

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase for database, auth, and storage

## New Device Setup

You need Node.js installed first. Then run:

```bash
npm run setup
```

The setup script will:

1. Install npm packages.
2. Create `.env.local` from `.env.example` if needed.
3. Offer to log into Supabase and link the project.
4. Offer to check/apply database migrations.
5. Offer to run lint and typecheck.

After setup, fill in `.env.local` if the values are still placeholders:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key
```

Find these in Supabase Dashboard > Project Settings > API.

Address search and map tiles have safe development defaults. Before
production, replace `GEOCODER_USER_AGENT` with a value that identifies your
deployed application and contact URL. `GEOCODER_BASE_URL`,
`NEXT_PUBLIC_MAP_TILE_URL`, and `NEXT_PUBLIC_MAP_ATTRIBUTION` can point to
self-hosted or contracted services.

## Start The App

```bash
npm run dev
```

Open:

- App: [http://localhost:3000](http://localhost:3000)
- Supabase health check: [http://localhost:3000/api/supabase/health](http://localhost:3000/api/supabase/health)

## Manual Setup

Use these commands if you do not want to use the setup script:

```bash
npm install
copy .env.example .env.local
npx supabase login
npx supabase link --project-ref eywzwkfeghbhwtsnjuti
npx supabase db push --dry-run
npx supabase db push --include-seed
npm run lint
npm run typecheck
npm run dev
```

On macOS or Linux, use this instead of the Windows `copy` command:

```bash
cp .env.example .env.local
```

## Common Commands

```bash
npm run dev
```

Starts the local development server.

```bash
npm run lint
```

Runs ESLint.

```bash
npm run typecheck
```

Runs TypeScript without emitting files.

```bash
npm run db:dry-run
```

Shows which Supabase migrations would be pushed.

```bash
npm run db:push
```

Applies pending Supabase migrations and runs `supabase/seed.sql`.

```bash
npm run db:migrations
```

Shows local and remote Supabase migration history.

## Supabase Notes

- The cloud Supabase project ref is `eywzwkfeghbhwtsnjuti`.
- Database migrations live in `supabase/migrations`.
- Seed data lives in `supabase/seed.sql`.
- The current schema is documented in `docs/database.md`.
- Supabase Auth owns `auth.users`; app-specific user data lives in
  `public.profiles`.

Do not commit `.env.local` or any real Supabase keys.

## Database Setup

The MVP database migration creates:

- `profiles`
- `provider_profiles`
- `categories`
- `languages`
- `specialties`
- `provider_languages`
- `provider_specialties`
- `canadian_subdivisions`
- `service_regions`
- `provider_service_regions`
- `saved_providers`
- `contact_requests`

To apply database changes:

```bash
npm run db:dry-run
npm run db:push
```

Use `db:dry-run` first so you can see what will change.

## Important Next.js Note

This project uses Next.js 16. Before changing Next.js-specific APIs, routing,
or file conventions, read the local docs in:

```bash
node_modules/next/dist/docs/
```

The repo also has `AGENTS.md` with this same instruction for coding agents.
