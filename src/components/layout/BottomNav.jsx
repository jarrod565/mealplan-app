import { NavLink } from 'react-router-dom'
import { CalendarDays, ShoppingBasket, ShoppingCart, Heart, EyeOff } from 'lucide-react'
import { useBasket } from '@/contexts/BasketContext'
import { cn } from '@/lib/utils'

export default function BottomNav() {
  const { basketCount } = useBasket()

  const NAV_ITEMS = [
    { to: '/plan',          label: 'Plan',      Icon: CalendarDays,   badge: null },
    { to: '/basket',        label: 'Basket',    Icon: ShoppingBasket, badge: basketCount || null },
    { to: '/shopping-list', label: 'List',      Icon: ShoppingCart,   badge: null },
    { to: '/favorites',     label: 'Favorites', Icon: Heart,          badge: null },
    { to: '/hidden',        label: 'Hidden',    Icon: EyeOff,         badge: null },
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
