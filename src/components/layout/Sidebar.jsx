import { NavLink } from 'react-router-dom'
import { CalendarDays, ShoppingBasket, ShoppingCart, History, Heart } from 'lucide-react'
import { useBasket } from '@/contexts/BasketContext'
import { cn } from '@/lib/utils'

export default function Sidebar() {
  const { basketCount } = useBasket()

  const NAV_ITEMS = [
    { to: '/plan',          label: 'Plan',      Icon: CalendarDays,   badge: null },
    { to: '/basket',        label: 'Basket',    Icon: ShoppingBasket, badge: basketCount || null },
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
          className="w-full h-auto dark:[filter:brightness(0)_invert(1)]"
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
