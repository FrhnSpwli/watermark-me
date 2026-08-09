import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { AuthLoadingScreen } from './AuthLoadingScreen'

export function GuestRoute() {
  const { loading, user } = useAuth()

  if (loading) {
    return <AuthLoadingScreen />
  }

  return user ? <Navigate replace to="/dashboard" /> : <Outlet />
}
