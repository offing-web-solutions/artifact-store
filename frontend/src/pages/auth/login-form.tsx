import { useState } from 'react'

type Props = {
  onSubmit: (username: string, password: string) => Promise<void>
}

export function LoginForm({ onSubmit }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSubmit(username.trim(), password)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <h1>Sign in</h1>
      <p className="sub">Welcome back. Pick up where you left off.</p>

      <div className="field-group">
        <label className="label" htmlFor="login-user">Username</label>
        <input
          id="login-user"
          className="input input-lg"
          type="text"
          autoComplete="username"
          required
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div className="field-group">
        <label className="label" htmlFor="login-pass">Password</label>
        <input
          id="login-pass"
          className="input input-lg"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg btn-block"
        style={{ marginTop: 8 }}
        disabled={submitting}
      >
        {submitting ? 'Signing in…' : <>Sign in <span style={{ opacity: 0.6 }}>↵</span></>}
      </button>

      <div className="field-error">{error}</div>
    </form>
  )
}
