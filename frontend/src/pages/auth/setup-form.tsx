import { useState } from 'react'

type Props = {
  onSubmit: (username: string, password: string, confirmPassword: string) => Promise<void>
}

export function SetupForm({ onSubmit }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    setSubmitting(true)
    try {
      await onSubmit(username.trim(), password, confirm)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <h1>Welcome</h1>
      <p className="sub">No admins yet. Create the first one to get started.</p>

      <div className="field-group">
        <label className="label" htmlFor="setup-user">Username</label>
        <input
          id="setup-user"
          className="input input-lg"
          type="text"
          autoComplete="username"
          required
          minLength={3}
          maxLength={64}
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div className="field-group">
        <label className="label" htmlFor="setup-pass">
          Password <span className="label-hint">· min. 8 chars</span>
        </label>
        <input
          id="setup-pass"
          className="input input-lg"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="field-group">
        <label className="label" htmlFor="setup-confirm">Confirm password</label>
        <input
          id="setup-confirm"
          className="input input-lg"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg btn-block"
        style={{ marginTop: 8 }}
        disabled={submitting}
      >
        {submitting ? 'Creating…' : 'Create admin'}
      </button>

      <div className="field-error">{error}</div>
    </form>
  )
}
