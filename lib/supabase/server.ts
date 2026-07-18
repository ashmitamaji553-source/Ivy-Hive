import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase client for use on the server — Server Components, Route
 * Handlers, and Server Actions. Reads/writes auth cookies via Next's
 * `cookies()` API so the session survives across requests.
 *
 * NOTE: Server Components can't write cookies, so `setAll` below will
 * throw when called from one. That's expected and safe to ignore as long
 * as the middleware (see middleware.ts) is refreshing the session on every
 * request — this is the pattern Supabase's own docs recommend.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — safe to ignore because
            // middleware.ts refreshes the session on every request.
          }
        },
      },
    }
  )
}
