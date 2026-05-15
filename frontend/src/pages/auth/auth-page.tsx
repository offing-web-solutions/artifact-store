import { Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { LoginForm } from './login-form'
import { SetupForm } from './setup-form'
import type { AuthStatus } from '@/services/api'

type Props = {
  status: AuthStatus
  onSetup: (u: string, p: string, c: string) => Promise<void>
  onLogin: (u: string, p: string) => Promise<void>
}

const FEATURES = [
  {
    title: 'Multi-bucket storage',
    body: 'One API key per bucket. Each CI scoped to its own files.',
  },
  {
    title: 'Signed URLs, no credentials',
    body: 'Hand servers a temporary signed link instead of static tokens.',
  },
  {
    title: 'Lives on your disk',
    body: 'Files persist under your STORAGE_PATH. No cloud, no third party.',
  },
]

export function AuthPage({ status, onSetup, onLogin }: Props) {
  const navigate = useNavigate()
  const goHome = () => navigate('/', { replace: true })

  return (
    <div className="login-shell">
      <aside className="login-aside">
        <div className="login-aside-grid" />
        <div className="login-aside-content">
          <div className="brand-mark" style={{ fontSize: 16 }}>
            <span className="logo-square" style={{ width: 28, height: 28, fontSize: 14 }}>A</span>
            <span>Artifact Store</span>
          </div>
          <h2 className="login-tagline">
            Your own <em>private Docker registry</em>. Self-hosted, no cloud.
          </h2>
          <p className="login-blurb">
            Push builds from any CI, hand servers temporary signed URLs to pull them. Everything
            stored on your server's disk — you own the bits and the bandwidth.
          </p>
        </div>
        <div className="login-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="login-feat">
              <span className="check"><Check size={11} strokeWidth={3} /></span>
              <div>
                <div className="feat-title">{f.title}</div>
                <div className="feat-body">{f.body}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

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
