# Ivy-Hive

A cottagecore-themed schedule and goal-tracking web app.

## Database

- **`supabase/migrations/0001_ivy_hive_init.sql`** — Postgres schema for Supabase: `users` (extends `auth.users`), `events`, `goals`, `weekly_tasks`, `tags`. Includes calendar-query indexes and Row Level Security policies so every user can only access their own rows.

## Auth

Email/password sign-up + login, Google OAuth, session refresh via
middleware, and protected routes are implemented with `@supabase/ssr`.
See **[`docs/AUTH_SETUP.md`](docs/AUTH_SETUP.md)** for the file map, install
step, and Supabase dashboard configuration.

## Events API

Full CRUD on the `events` table, with recurring events (`recurrence_rule`,
an RFC5545 RRULE string) expanded into concrete instances and grouped by
day — ready for a week/month calendar grid. See
**[`docs/EVENTS_API.md`](docs/EVENTS_API.md)** for endpoints, the response
shape, and example requests.

## Pages

- **`index.html`** — marketing landing page (hero, features, "how it grows" timeline, CTA)
- **`calendar.html`** — main calendar dashboard: week view with color-coded events, mini month picker, and goal progress bars styled as vines on a trellis
- **`goals.html`** — goals page: cards with a circular forest-green progress ring per goal, expandable weekly to-do lists with leaf-shaped checkboxes, and a seedling illustration for the empty state
- **`signup.html`** / **`login.html`** — split-layout auth screens: a full-bleed illustration of an ivy-covered cottage and beehive on the left, form on beige with sage-outlined inputs (forest on focus), a forest-green primary button, and a "Continue with Google" secondary button

All pages are self-contained HTML files — no build step required. Open directly in a browser, or enable **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root) to serve them live.

## Design system

- **Colors**: beige `#F5EFE3` (base), sage `#A8B79A` (secondary), forest green `#3B5D42` (primary/nav), honey-amber `#D9A24B` (accent)
- **Type**: Fraunces (headings), Nunito (body)
- **Signature elements**: hand-drawn ivy vine dividers, a honeycomb-clock hero illustration, a hexagon "Get Started" button, vine-on-trellis goal progress bars, and leaf-shaped checkboxes that fill sage green when checked
- **Event categories** (calendar): Tending (sage), Deep Work (forest), Harvest / deadlines (honey), Errands (tan)
