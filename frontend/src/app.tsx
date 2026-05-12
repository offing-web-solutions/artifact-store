import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { AuthPage } from '@/pages/auth/auth-page'
import { DashboardPage } from '@/pages/dashboard/dashboard-page'

function LoadingScreen() {
  return (
    <div style={{
      height: '100vh',
      display: 'grid',
      placeItems: 'center',
      color: 'var(--fg-3)',
      fontSize: 13,
    }}>
      Loading…
    </div>
  )
}

export default function App() {
  const { status, username, loading, setup, login, logout } = useAuth()

  if (loading || !status) return <LoadingScreen />

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            status.authenticated
              ? <Navigate to="/" replace />
              : <AuthPage status={status} onSetup={setup} onLogin={login} />
          }
        />
        <Route
          path="/"
          element={
            status.authenticated
              ? <DashboardPage username={username} onLogout={logout} />
              : <Navigate to="/login" replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
