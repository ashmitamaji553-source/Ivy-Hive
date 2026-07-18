import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for use in the browser (Client Components, hooks like
 * useUser). Safe to call repeatedly — @supabase/ssr reuses the underlying
 * connection, but we still create one instance per call site for clarity.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
