import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function AppLayout() {
  const { isLoading, isAuthenticated, isGuest } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated && !isGuest) {
    return <Navigate to="/sign-in" replace />
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {/* Main content — offset for sidebar on desktop, padded for bottom nav on mobile */}
      <main className="md:ml-56 pb-16 md:pb-0">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
