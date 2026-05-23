import { NavLink } from 'react-router-dom'
import { CalendarDays, ShoppingBasket, ShoppingCart, Heart, EyeOff, Settings } from 'lucide-react'
import { useBasket } from '@/contexts/BasketContext'
import { cn } from '@/lib/utils'

export default function Sidebar() {
  const { basketCount } = useBasket()

  const NAV_ITEMS = [
    { to: '/plan',          label: 'Plan',      Icon: CalendarDays,   badge: null },
    { to: '/basket',        label: 'Basket',    Icon: ShoppingBasket, badge: basketCount || null },
    { to: '/shopping-list', label: 'List',      Icon: ShoppingCart,   badge: null },
    { to: '/favorites',     label: 'Favorites', Icon: Heart,          badge: null },
    { to: '/hidden',        label: 'Hidden',    Icon: EyeOff,         badge: null },
    { to: '/settings',      label: 'Settings',  Icon: Settings,       badge: null },
  ]

  return (
    <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-56 flex-col border-r bg-background z-40">
      {/* Wordmark */}
      <div className="flex items-center gap-2 px-5 py-5 border-b">
        <span className="text-xl" aria-hidden="true">🥗</span>
        <span className="font-semibold text-lg tracking-tight">MealPlan</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map(({ to, label, Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )
            }
          >
            <div className="relative">
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              {badge != null && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-foreground text-background text-[9px] font-bold flex items-center justify-center px-1">
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
