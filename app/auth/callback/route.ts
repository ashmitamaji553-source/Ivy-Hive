import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Hit by two flows:
 *  1. Google OAuth redirecting back after the user approves consent.
 *  2. The confirmation link in the sign-up email (if "Confirm email" is on
 *     in Supabase Auth settings).
 * Both send a `code` query param that gets exchanged for a real session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/calendar'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Could not authenticate. Please try again.')}`
  )
}
