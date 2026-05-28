import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useMealDiscovery } from '@/hooks/useMealDiscovery'
import { useFavorites } from '@/contexts/FavoritesContext'
import { useBasket } from '@/contexts/BasketContext'
import ActiveFilterIndicator from '@/components/plan/ActiveFilterIndicator'
import SwipeCard from '@/components/plan/SwipeCard'
import NeverConfirmDialog from '@/components/plan/NeverConfirmDialog'
import { RefreshCw, Loader2, ShoppingBasket, X, Check, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function PlanPage() {
  const { deck, status, errorMessage, swipeYes, swipeNo, swipeNever, reload } = useMealDiscovery()
  const { isFavorited, toggleFavorite } = useFavorites()
  const { basketCount } = useBasket()

  const [pendingNever, setPendingNever] = useState(null)
  const topCardRef = useRef(null)

  function handleSwipeNever(meal) {
    setPendingNever(meal)
  }

  function handleNeverConfirm(meal, reason) {
    setPendingNever(null)
    swipeNever(meal, reason)
  }

  function handleNeverCancel() {
    setPendingNever(null)
    topCardRef.current?.snapBack()
  }

  function handleTapYes() {
    if (deck[0]) swipeYes(deck[0])
  }
  function handleTapNo() {
    if (deck[0]) swipeNo(deck[0])
  }
  function handleTapNever() {
    if (deck[0]) setPendingNever(deck[0])
  }

  return (
    <div className="flex flex-col h-[100svh] md:h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b shrink-0 bg-background/95 backdrop-blur-sm">
        <h1 className="text-xl font-bold tracking-tight">Plan</h1>
        <div className="flex items-center gap-2.5">
          <ActiveFilterIndicator />
          <Link
            to="/basket"
            className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
            aria-label={`Basket — ${basketCount} meal${basketCount !== 1 ? 's' : ''}`}
          >
            <ShoppingBasket className="w-5 h-5" />
            {basketCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                {basketCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Deck area */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-5 overflow-hidden">
        {status === 'init' && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Finding meals for you…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 text-center max-w-xs">
            <p className="text-3xl">😕</p>
            <p className="font-semibold text-lg">Couldn't load meals</p>
            <p className="text-sm text-muted-foreground">
              {errorMessage ?? 'Check your connection and try again.'}
            </p>
            {!errorMessage?.includes('quota') && (
              <Button onClick={reload} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Try again
              </Button>
            )}
          </div>
        )}

        {status === 'empty' && (
          <div className="flex flex-col items-center gap-4 text-center max-w-xs">
            <p className="text-5xl">🎉</p>
            <p className="font-bold text-xl">You've seen it all!</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You've gone through all available meals. Try loosening your dietary filters or
              reload for a fresh batch.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/settings/dietary">Adjust dietary filters</Link>
            </Button>
            <Button onClick={reload} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              Reload meals
            </Button>
          </div>
        )}

        {status === 'idle' && deck.length > 0 && (
          <>
            {/* Card stack */}
            <div className="relative w-full max-w-sm" style={{ height: 'min(62svh, 500px)' }}>
              {deck.slice(0, 3).map((meal, i) => (
                <div
                  key={meal.meal_id}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transform: `scale(${1 - i * 0.035}) translateY(${i * 14}px)`,
                    zIndex: 10 - i,
                    transition: i === 0 ? 'none' : 'transform 0.2s ease-out',
                    pointerEvents: i === 0 ? 'auto' : 'none',
                  }}
                >
                  <SwipeCard
                    meal={meal}
                    isTop={i === 0}
                    ref={i === 0 ? topCardRef : undefined}
                    onSwipeYes={swipeYes}
                    onSwipeNo={swipeNo}
                    onSwipeNever={handleSwipeNever}
                    onToggleFavorite={toggleFavorite}
                    isFavorited={isFavorited(meal.meal_id)}
                  />
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-end justify-center gap-7 mt-8">
              <ActionButton
                onClick={handleTapNever}
                label="Never"
                icon={<Ban className="w-[1.1rem] h-[1.1rem]" />}
                variant="never"
                size="sm"
              />
              <ActionButton
                onClick={handleTapNo}
                label="Skip"
                icon={<X className="w-5 h-5" />}
                variant="neutral"
                size="md"
              />
              <ActionButton
                onClick={handleTapYes}
                label="Yes!"
                icon={<Check className="w-[1.4rem] h-[1.4rem]" />}
                variant="yes"
                size="lg"
              />
            </div>
          </>
        )}
      </main>

      <NeverConfirmDialog
        meal={pendingNever}
        open={!!pendingNever}
        onConfirm={handleNeverConfirm}
        onCancel={handleNeverCancel}
      />
    </div>
  )
}

function ActionButton({ onClick, label, icon, variant = 'neutral', size = 'md' }) {
  const sizes = { sm: 'w-12 h-12', md: 'w-[3.75rem] h-[3.75rem]', lg: 'w-[4.5rem] h-[4.5rem]' }
  const styles = {
    never: 'border-2 border-destructive/20 text-destructive/50 hover:border-destructive/50 hover:text-destructive/80 bg-background transition-colors',
    neutral: 'border-2 border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground bg-background transition-colors',
    yes: 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all',
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        aria-label={label}
        className={cn(
          'rounded-full flex items-center justify-center active:scale-95 transition-transform',
          sizes[size],
          styles[variant]
        )}
      >
        {icon}
      </button>
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  )
}
