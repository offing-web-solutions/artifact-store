import { useEffect, useState } from 'react'
import {
  apiAuthLogin,
  apiAuthLogout,
  apiAuthMe,
  apiAuthSetup,
  apiAuthStatus,
  type AuthStatus,
} from '@/services/api'

export function useAuth() {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [username, setUsername] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const data = await apiAuthStatus()
      setStatus(data)
      if (data.authenticated) {
        try {
          const me = await apiAuthMe()
          setUsername(me.username)
        } catch {
          // sesión inválida entre llamadas: revertimos
          setStatus({ ...data, authenticated: false })
        }
      }
    } catch {
      setStatus({ setup_required: true, authenticated: false })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const setup = async (u: string, p: string, c: string) => {
    const me = await apiAuthSetup(u, p, c)
    setStatus({ setup_required: false, authenticated: true })
    setUsername(me.username)
  }

  const login = async (u: string, p: string) => {
    const me = await apiAuthLogin(u, p)
    setStatus({ setup_required: false, authenticated: true })
    setUsername(me.username)
  }

  const logout = async () => {
    try { await apiAuthLogout() } catch { /* noop */ }
    setStatus({ setup_required: false, authenticated: false })
    setUsername('')
  }

  return { status, username, loading, setup, login, logout, refresh }
}
