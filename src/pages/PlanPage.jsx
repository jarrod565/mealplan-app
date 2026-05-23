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

  // Action button handlers for tap-to-swipe
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
      <header className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h1 className="text-lg font-semibold">Plan</h1>
        <div className="flex items-center gap-2">
          <ActiveFilterIndicator />
          <Link
            to="/basket"
            className="relative p-2 rounded-md hover:bg-secondary transition-colors"
            aria-label={`Basket — ${basketCount} meal${basketCount !== 1 ? 's' : ''}`}
          >
            <ShoppingBasket className="w-5 h-5" />
            {basketCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center px-1">
                {basketCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Deck area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-hidden">
        {status === 'init' && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Finding meals for you…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 text-center max-w-xs">
            <p className="text-2xl">😕</p>
            <p className="font-semibold">Couldn't load meals</p>
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
            <p className="text-4xl">🎉</p>
            <p className="font-semibold text-lg">You've seen it all!</p>
            <p className="text-sm text-muted-foreground">
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

        {(status === 'idle') && deck.length > 0 && (
          <>
            {/* Card stack */}
            <div className="relative w-full max-w-sm" style={{ height: 'min(65svh, 520px)' }}>
              {deck.slice(0, 3).map((meal, i) => (
                <div
                  key={meal.meal_id}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transform: `scale(${1 - i * 0.04}) translateY(${i * 12}px)`,
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
            <div className="flex items-center gap-6 mt-6">
              <ActionButton
                onClick={handleTapNever}
                label="Never"
                icon={<Ban className="w-5 h-5" />}
                className="border-destructive/30 text-destructive/70 hover:border-destructive hover:text-destructive"
                size="sm"
              />
              <ActionButton
                onClick={handleTapNo}
                label="No"
                icon={<X className="w-6 h-6" />}
                className="border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground"
                size="md"
              />
              <ActionButton
                onClick={handleTapYes}
                label="Yes"
                icon={<Check className="w-6 h-6" />}
                className="border-green-500/40 text-green-600 hover:border-green-500 dark:text-green-400"
                size="md"
              />
            </div>
          </>
        )}
      </main>

      {/* Never confirmation dialog */}
      <NeverConfirmDialog
        meal={pendingNever}
        open={!!pendingNever}
        onConfirm={handleNeverConfirm}
        onCancel={handleNeverCancel}
      />
    </div>
  )
}

function ActionButton({ onClick, label, icon, className, size }) {
  const sizeClass = size === 'sm'
    ? 'w-12 h-12'
    : 'w-14 h-14'
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'rounded-full border-2 flex items-center justify-center transition-colors shadow-sm',
        sizeClass,
        className
      )}
    >
      {icon}
    </button>
  )
}
