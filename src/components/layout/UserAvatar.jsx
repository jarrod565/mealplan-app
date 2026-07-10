import { Link } from 'react-router-dom'
import { ShoppingBasket } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useBasket } from '@/contexts/BasketContext'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

function getInitials(email) {
  if (!email) return '?'
  const name = email.split('@')[0]
  const parts = name.split(/[._-]/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

// CB_09 nav restructure: Basket was removed as a nav destination in
// BottomNav/Sidebar and moved here instead — a header icon next to the
// avatar, present on every screen since every page already renders
// <UserAvatar /> as the last element of its header row. Kept in this file
// (rather than a new component threaded through all 13 page headers) so the
// basket icon shows up everywhere with a single change.
export default function UserAvatar() {
  const { user, isGuest } = useAuth()
  const { basketCount } = useBasket()
  const initials = isGuest ? 'G' : getInitials(user?.email)
  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <div className="flex items-center gap-4">
      <Link
        to="/basket"
        aria-label={`Basket${basketCount > 0 ? ` — ${basketCount} meal${basketCount !== 1 ? 's' : ''}` : ''}`}
        className="relative p-2 -m-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <ShoppingBasket className="w-5 h-5" strokeWidth={1.75} />
        {basketCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
            {basketCount}
          </span>
        )}
      </Link>
      <Link
        to="/settings"
        aria-label="Account settings"
        className="w-9 h-9 rounded-full shrink-0 hover:opacity-90 active:scale-95 transition-all shadow-sm"
      >
        <Avatar className="w-full h-full">
          <AvatarImage src={avatarUrl} alt="" />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </Link>
    </div>
  )
}
