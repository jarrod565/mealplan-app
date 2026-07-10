import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetClose } from '@/components/ui/sheet'
import { useMealDiscovery } from '@/hooks/useMealDiscovery'
import { useFavorites } from '@/contexts/FavoritesContext'
import { fetchMealDetails } from '@/lib/spoonacular'
import ActiveFilterIndicator from '@/components/plan/ActiveFilterIndicator'
import SwipeCard from '@/components/plan/SwipeCard'
import NeverConfirmDialog from '@/components/plan/NeverConfirmDialog'
import UserAvatar from '@/components/layout/UserAvatar'
import { RefreshCw, Loader2, X, SlidersHorizontal } from 'lucide-react'

export default function PlanPage() {
  const { deck, status, errorMessage, swipeYes, swipeNo, swipeNever, reload } = useMealDiscovery()
  const { isFavorited, toggleFavorite } = useFavorites()

  const [pendingNever, setPendingNever] = useState(null)
  const topCardRef = useRef(null)

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [sheetMeal, setSheetMeal] = useState(null)
  const [sheetDetails, setSheetDetails] = useState(null)
  const [sheetLoading, setSheetLoading] = useState(false)
  const detailsCache = useRef({})

  async function handleIngredientsPress(meal) {
    setSheetMeal(meal)
    setIsSheetOpen(true)
    if (detailsCache.current[meal.meal_id]) {
      setSheetDetails(detailsCache.current[meal.meal_id])
      return
    }
    setSheetDetails(null)
    setSheetLoading(true)
    try {
      const data = await fetchMealDetails(meal.meal_id)
      detailsCache.current[meal.meal_id] = data
      setSheetDetails(data)
    } catch {
      // fail silently — sheet shows unavailable state
    } finally {
      setSheetLoading(false)
    }
  }

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

  return (
    // Subtract bottom nav height (4rem = 64px) on mobile so content never hides behind it
    <div className="flex flex-col h-[calc(100svh-4rem)] md:h-screen">

      {/* Header — filter indicator + avatar (avatar cluster includes the basket icon) */}
      <header className="flex items-center justify-between px-5 py-4 border-b shrink-0 bg-background/95 backdrop-blur-sm">
        <h1 className="text-xl font-bold tracking-tight">Explore</h1>
        <div className="flex items-center gap-2.5">
          <ActiveFilterIndicator />
          <UserAvatar />
        </div>
      </header>

      {/* Main — card deck fills all remaining vertical space */}
      <main className="flex-1 flex flex-col min-h-0">

        {/* ── LOADING ── */}
        {status === 'init' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Finding meals for you…</p>
          </div>
        )}

        {/* ── ERROR ── */}
        {status === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6 max-w-xs mx-auto">
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

        {/* ── EMPTY ── same pattern as ForYouPage's PoolExhaustedState: message,
            filter-adjustment link, and a Reload button the user must tap —
            no automatic refetch under any circumstance. */}
        {status === 'empty' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4 max-w-xs mx-auto">
            <p className="text-5xl">🎉</p>
            <p className="font-bold text-xl">You've seen it all!</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You've gone through all available meals from your current filters.
            </p>
            <Button asChild variant="outline" className="w-full gap-2">
              <Link to="/settings/dietary">
                <SlidersHorizontal className="w-4 h-4" />
                Adjust dietary filters
              </Link>
            </Button>
            <Button onClick={reload} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              Reload meals
            </Button>
          </div>
        )}

        {/* ── CARD DECK ── */}
        {status === 'idle' && deck.length > 0 && (
          <div className="relative flex-1 min-h-0 mx-4 mt-3 mb-5 md:mx-auto md:w-full md:max-w-[420px] md:mt-6 md:mb-8 lg:flex-none lg:my-auto lg:w-[560px] lg:max-w-none lg:h-[640px]">
            {deck.slice(0, 2).map((meal, i) => (
              <div
                key={meal.meal_id}
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  zIndex: 10 - i,
                  // Back card: scaled down and shifted down slightly to create a peek effect
                  transform: i === 1 ? 'scale(0.95) translateY(18px)' : undefined,
                  transition: i === 0 ? 'none' : 'transform 0.3s ease-out',
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
                  onIngredientsPress={handleIngredientsPress}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <NeverConfirmDialog
        meal={pendingNever}
        open={!!pendingNever}
        onConfirm={handleNeverConfirm}
        onCancel={handleNeverCancel}
      />

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="h-[65vh] z-[60] flex flex-col gap-0 px-0 pt-0"
          overlayClassName="z-[60]"
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0" aria-hidden="true">
            <div className="w-12 h-1.5 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
            <SheetTitle className="text-base font-semibold leading-snug pr-8">
              {sheetMeal?.name}
            </SheetTitle>
            <SheetClose className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <X className="w-4 h-4" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>

          {/* Ingredient list */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {sheetLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Loading ingredients…
              </div>
            ) : sheetDetails?.ingredients?.length > 0 ? (
              <ul className="space-y-2 pb-4">
                {sheetDetails.ingredients.map((ing) => (
                  <li key={ing.id} className="text-sm text-foreground/80 flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                    {ing.unit?.toLowerCase() === 'servings'
                      ? <>{ing.name} <span className="text-muted-foreground">— to taste</span></>
                      : ing.original}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                Ingredient details unavailable.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
