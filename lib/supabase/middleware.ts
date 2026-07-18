import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Any route under these paths requires a logged-in user. Add to this list
// as new authenticated pages are built (e.g. '/journal').
const PROTECTED_PATHS = ['/calendar', '/goals', '/dashboard']

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from protected routes. Called from the root
 * middleware.ts on every request that matches its `config.matcher`.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Don't add logic between createServerClient() and
  // supabase.auth.getUser() below. Doing so can cause hard-to-debug issues
  // with users being randomly logged out mid-session (see Supabase's
  // @supabase/ssr docs on why getUser() must run here, not getSession()).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isProtected = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // IMPORTANT: Return supabaseResponse as-is (don't build a new
  // NextResponse). Copying cookies onto a fresh response and returning that
  // instead will de-sync the session between browser and server.
  return supabaseResponse
}
