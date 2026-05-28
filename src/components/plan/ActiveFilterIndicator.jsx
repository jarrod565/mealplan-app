import { Link } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function ActiveFilterIndicator() {
  const { subscription } = useAuth()
  const count = subscription?.dietary_restrictions?.length ?? 0

  if (count === 0) return null

  return (
    <Link
      to="/settings/dietary"
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary shadow-sm transition-colors hover:bg-primary/12"
      aria-label={`${count} dietary filter${count !== 1 ? 's' : ''} active — tap to manage`}
    >
      <SlidersHorizontal className="w-3.5 h-3.5" />
      {count} filter{count !== 1 ? 's' : ''} active
    </Link>
  )
}
