import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Wraps every authenticated route (put calendar/, goals/, journal/ etc.
 * inside this route group). The middleware already redirects unauthed
 * requests before they get this far, but this check stays as
 * defense-in-depth in case middleware.ts's matcher is ever narrowed and
 * misses a path.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}
