import Link from 'next/link'
import { signup, signInWithGoogle } from '@/app/auth/actions'

/**
 * Minimal functional version of the sign-up screen. Swap the markup below
 * for the illustrated split-layout from signup.html — the <form> wiring
 * to the server actions can stay exactly as-is.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="auth-page">
      <h1>Create your account</h1>
      <p className="subtitle">Start a garden of your own — free to plant your first goal.</p>

      {params.error && <p className="form-error">{params.error}</p>}

      <form action={signup} className="auth-form">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" autoComplete="name" required />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />

        <button type="submit" className="btn-primary">
          Create account
        </button>
      </form>

      <form action={signInWithGoogle}>
        <button type="submit" className="btn-google">
          Continue with Google
        </button>
      </form>

      <p className="switch-line">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  )
}
