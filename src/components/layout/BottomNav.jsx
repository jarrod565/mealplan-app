import { NavLink } from 'react-router-dom'
import { CalendarDays, ShoppingCart, History, Heart, Sparkles } from 'lucide-react'
import { useConnectedSources } from '@/contexts/ConnectedSourcesContext'
import { cn } from '@/lib/utils'

export default function BottomNav() {
  const { connections } = useConnectedSources()

  // CB_09 nav restructure: "Plan" renamed to "Explore"; Basket moved out of
  // the nav entirely and into the top header (see UserAvatar.jsx) — it's no
  // longer a destination here.
  const NAV_ITEMS = [
    { to: '/plan',          label: 'Explore',   Icon: CalendarDays,   badge: null },
    // CB_12: nav item appears once any source is connected — generic across
    // Airtable today and future sources (e.g. Pinterest), not source-specific.
    ...(connections.length > 0
      ? [{ to: '/for-you', label: 'For You', Icon: Sparkles, badge: null }]
      : []),
    { to: '/shopping-list', label: 'List',      Icon: ShoppingCart,   badge: null },
    { to: '/history',       label: 'History',   Icon: History,        badge: null },
    { to: '/favorites',     label: 'Favorites', Icon: Heart,          badge: null },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <ul className="flex h-16 items-stretch">
        {NAV_ITEMS.map(({ to, label, Icon, badge }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-xs transition-colors',
                  isActive ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={1.75} />
                {badge != null && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1">
                    {badge}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
