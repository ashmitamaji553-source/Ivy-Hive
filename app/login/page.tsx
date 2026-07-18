import Link from 'next/link'
import { login, signInWithGoogle } from '@/app/auth/actions'

/**
 * Minimal functional version of the login screen. Swap the markup below
 * for the illustrated split-layout from login.html — the <form> wiring
 * to the server actions can stay exactly as-is.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectedFrom?: string }>
}) {
  const params = await searchParams

  return (
    <main className="auth-page">
      <h1>Welcome back</h1>
      <p className="subtitle">Your garden&apos;s been waiting. Let&apos;s see how it&apos;s grown.</p>

      {params.error && <p className="form-error">{params.error}</p>}
      {params.redirectedFrom && (
        <p className="form-hint">Log in to continue to {params.redirectedFrom}.</p>
      )}

      <form action={login} className="auth-form">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />

        <button type="submit" className="btn-primary">
          Log in
        </button>
      </form>

      <form action={signInWithGoogle}>
        <button type="submit" className="btn-google">
          Continue with Google
        </button>
      </form>

      <p className="switch-line">
        New to Ivy-Hive? <Link href="/signup">Sign up</Link>
      </p>
    </main>
  )
}
