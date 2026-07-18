# Ivy-Hive — Supabase Auth integration

Files in this folder implement email/password sign-up, Google OAuth login,
session persistence, and protected routes for the Ivy-Hive Next.js app
using `@supabase/ssr`.

## Install

```bash
npm install @supabase/ssr @supabase/supabase-js
```

## File map

```
middleware.ts                     # runs on every request, refreshes the session
lib/supabase/client.ts            # browser client (Client Components, useUser)
lib/supabase/server.ts            # server client (Server Components, Server Actions)
lib/supabase/middleware.ts        # session refresh + protected-route redirect logic
hooks/useUser.ts                  # client hook: const { user, loading } = useUser()
app/auth/actions.ts               # server actions: login, signup, signInWithGoogle, signOut
app/auth/callback/route.ts        # exchanges OAuth/email-confirmation code for a session
app/login/page.tsx                # login screen
app/signup/page.tsx               # sign-up screen
app/signup/check-email/page.tsx   # "check your inbox" screen after sign-up
app/(app)/layout.tsx              # wraps protected pages with a server-side auth check
```

Put `calendar/`, `goals/`, and any other authenticated pages inside the
`(app)` route group so they inherit its layout guard.

## Supabase dashboard setup

1. **Auth → URL Configuration** — set Site URL to your deployed domain
   (or `http://localhost:3000` in dev), and add `**/auth/callback` under
   Redirect URLs.
2. **Auth → Providers → Google** — enable it, and paste in your Google
   OAuth Client ID/Secret from the Google Cloud Console. Add
   `https://<your-project-ref>.supabase.co/auth/v1/callback` as an
   authorized redirect URI on the Google side.
3. **Auth → Providers → Email** — decide whether "Confirm email" is on.
   If it is, `app/auth/callback/route.ts` also handles the confirmation
   link the same way it handles the Google redirect.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in your project's URL
and anon key from **Project Settings → API**.

## How the pieces fit together

- **`middleware.ts`** runs first, on every request. It calls
  `supabase.auth.getUser()` (never `getSession()` here — see the comment
  in `lib/supabase/middleware.ts` for why) to refresh the auth cookie, then
  redirects to `/login?redirectedFrom=...` if the path is protected and
  there's no user.
- **`app/(app)/layout.tsx`** re-checks auth server-side as defense-in-depth,
  in case a protected page's path isn't covered by the middleware matcher.
- **`useUser()`** is for client-side UI that needs the user's name/email/
  avatar reactively (e.g. the avatar in the top nav) — it doesn't do any
  redirecting itself, since that's the middleware's job.
- **Server actions** (`app/auth/actions.ts`) do the actual `signInWithPassword`,
  `signUp`, and `signInWithOAuth` calls, then `redirect()` on success or
  failure. Forms `action={login}` etc. work without any client-side JS.

## Wiring in the existing visual design

`login.html` and `signup.html` already in the repo have the full
illustrated split-layout (ivy cottage + beehive, sage/forest focus states,
leaf checkboxes). The `page.tsx` files here are intentionally bare —
port the JSX/CSS from those HTML files into `app/login/page.tsx` and
`app/signup/page.tsx`, keeping the `<form action={login}>` /
`<form action={signup}>` /  `<form action={signInWithGoogle}>` wiring as-is.
