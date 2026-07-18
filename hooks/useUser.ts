'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface UseUserResult {
  user: User | null
  loading: boolean
}

/**
 * Client-side hook for reading the current Supabase user.
 *
 * Fetches the user once on mount, then subscribes to onAuthStateChange so
 * `user` stays correct across login, logout, and token refresh — without
 * needing to reload the page or re-fetch manually.
 *
 * Usage:
 *   const { user, loading } = useUser()
 *   if (loading) return <Spinner />
 *   if (!user) return null // middleware should already have redirected
 *   return <p>Hi, {user.email}</p>
 */
export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let isMounted = true

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (isMounted) {
        setUser(user)
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
