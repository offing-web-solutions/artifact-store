import { useNavigate } from 'react-router-dom'
import { LoginForm } from './login-form'
import { SetupForm } from './setup-form'
import type { AuthStatus } from '@/services/api'

type Props = {
  status: AuthStatus
  onSetup: (u: string, p: string, c: string) => Promise<void>
  onLogin: (u: string, p: string) => Promise<void>
}

export function AuthPage({ status, onSetup, onLogin }: Props) {
  const navigate = useNavigate()
  const goHome = () => navigate('/', { replace: true })

  return (
    <div className="login-shell">
      <div className="login-aside-grid" />

      <header className="login-header">
        <div className="brand-mark" style={{ fontSize: 16 }}>
          <span className="logo-square" style={{ width: 28, height: 28, fontSize: 14 }}>A</span>
          <span>Artifact Store</span>
        </div>
      </header>

      <div className="login-form-pane">
        {status.setup_required ? (
          <SetupForm
            onSubmit={async (u, p, c) => { await onSetup(u, p, c); goHome() }}
          />
        ) : (
          <LoginForm
            onSubmit={async (u, p) => { await onLogin(u, p); goHome() }}
          />
        )}
      </div>
    </div>
  )
}
