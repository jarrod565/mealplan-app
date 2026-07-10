import { NavLink } from 'react-router-dom'
import { CalendarDays, ShoppingCart, History, Heart, Sparkles } from 'lucide-react'
import { useConnectedSources } from '@/contexts/ConnectedSourcesContext'
import { cn } from '@/lib/utils'

export default function Sidebar() {
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
    <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-56 flex-col border-r bg-background z-40">
      {/* Wordmark */}
      <div className="px-5 py-4 border-b">
        <img
          src="/dinder-logo.svg"
          alt="Dinder"
          className="w-3/4 h-auto mx-auto block dark:[filter:brightness(0)_invert(1)]"
        />
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ to, label, Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              )
            }
          >
            <div className="relative">
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              {badge != null && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1">
                  {badge}
                </span>
              )}
            </div>
            {label}
          </NavLink>
        ))}
      </nav>

    </aside>
  )
}
