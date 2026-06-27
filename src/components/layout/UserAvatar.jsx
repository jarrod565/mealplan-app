import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

function getInitials(email) {
  if (!email) return '?'
  const name = email.split('@')[0]
  const parts = name.split(/[._-]/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

export default function UserAvatar() {
  const { user, isGuest } = useAuth()
  const initials = isGuest ? 'G' : getInitials(user?.email)

  return (
    <Link
      to="/settings"
      aria-label="Account settings"
      className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 hover:opacity-90 active:scale-95 transition-all shadow-sm"
    >
      {initials}
    </Link>
  )
}
