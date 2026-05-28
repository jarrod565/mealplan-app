import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBasket } from '@/contexts/BasketContext'
import { fetchMealDetails } from '@/lib/spoonacular'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import { Clock, Loader2, ShoppingBasket, ChevronRight, Trash2, X } from 'lucide-react'
import { cn, formatIngredientQty } from '@/lib/utils'

export default function BasketPage() {
  const { basketItems, basketCount, removeFromBasket } = useBasket()

  const [openMealId, setOpenMealId] = useState(null)
  const [drawerDetails, setDrawerDetails] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  // Cache fetched details so re-opening the same meal doesn't re-fetch
  const cacheRef = useRef({})

  useEffect(() => {
    if (!openMealId) return

    if (cacheRef.current[openMealId]) {
      setDrawerDetails(cacheRef.current[openMealId])
      setDrawerLoading(false)
      return
    }

    setDrawerLoading(true)
    setDrawerDetails(null)

    fetchMealDetails(openMealId)
      .then((data) => {
        cacheRef.current[openMealId] = data
        setDrawerDetails(data)
      })
      .catch(() => {
        setDrawerDetails({ error: true })
      })
      .finally(() => setDrawerLoading(false))
  }, [openMealId])

  const openMeal = basketItems.find((m) => m.meal_id === openMealId) ?? null

  function handleOpenMeal(mealId) {
    // Opening an already-open drawer re-opens it instantly from cache
    setOpenMealId(mealId)
  }

  function handleCloseDrawer() {
    setOpenMealId(null)
  }

  if (basketCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <ShoppingBasket className="w-7 h-7 text-primary/50" />
        </div>
        <div>
          <p className="font-semibold text-base">Your basket is empty</p>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Swipe right on meals you'd like to cook this week.
          </p>
        </div>
        <Button asChild>
          <Link to="/plan">Start swiping</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-7">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold tracking-tight">Basket</h1>
          <span className="text-sm text-muted-foreground font-medium">
            {basketCount} meal{basketCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-3">
          {basketItems.map((meal) => (
            <BasketCard
              key={meal.meal_id}
              meal={meal}
              onOpen={() => handleOpenMeal(meal.meal_id)}
              onRemove={() => removeFromBasket(meal.meal_id)}
            />
          ))}
        </div>

        <Separator className="my-7" />

        <Button asChild className="w-full gap-2 h-11 text-base">
          <Link to="/ingredients">
            View Ingredients List
            <ChevronRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      {/* Ingredient drawer — single instance, one open at a time */}
      <Sheet open={openMealId !== null} onOpenChange={(v) => !v && handleCloseDrawer()}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="gap-0 p-0 w-full sm:max-w-sm flex flex-col"
        >
          {/* Photo header */}
          <div className="relative shrink-0 h-48 bg-secondary">
            {openMeal?.photo_url ? (
              <img
                src={openMeal.photo_url}
                alt={openMeal.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-5xl">🍽️</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

            {/* Close button */}
            <SheetClose className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50">
              <X className="w-4 h-4" />
              <span className="sr-only">Close</span>
            </SheetClose>

            {/* Meal name + meta over photo */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
              <SheetTitle className="text-white font-bold text-lg leading-snug line-clamp-2">
                {openMeal?.name}
              </SheetTitle>
              {(openMeal?.prep_time != null || openMeal?.difficulty) && (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {openMeal.prep_time != null && (
                    <span className="inline-flex items-center gap-1 bg-black/35 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs text-white/90 font-medium">
                      <Clock className="w-3 h-3" />
                      {openMeal.prep_time} min
                    </span>
                  )}
                  {openMeal?.difficulty && (
                    <span className="inline-flex items-center bg-black/35 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs text-white/90 font-medium">
                      {openMeal.difficulty}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Ingredient list */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <p className="text-[11px] font-bold text-primary/60 uppercase tracking-widest mb-4">
              {drawerLoading
                ? 'Loading ingredients…'
                : drawerDetails?.error
                  ? 'Ingredients unavailable'
                  : `Ingredients${drawerDetails?.ingredients?.length ? ` · ${drawerDetails.ingredients.length}` : ''}`}
            </p>

            {drawerLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Fetching ingredients…
              </div>
            )}

            {!drawerLoading && drawerDetails?.error && (
              <p className="text-sm text-muted-foreground">
                Couldn't load ingredients for this meal.
              </p>
            )}

            {!drawerLoading && drawerDetails?.ingredients?.length > 0 && (
              <ul className="space-y-3">
                {drawerDetails.ingredients.map((ing) => {
                  const qty = formatIngredientQty(ing.amount, ing.unit)
                  return (
                    <li key={ing.id} className="flex items-baseline gap-3">
                      {qty && (
                        <span className={cn(
                          'shrink-0 min-w-[64px] text-right text-xs font-semibold text-muted-foreground',
                          qty !== 'to taste' && 'tabular-nums'
                        )}>
                          {qty}
                        </span>
                      )}
                      <span className="text-sm text-foreground leading-snug">{ing.name}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function BasketCard({ meal, onOpen, onRemove }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Clickable area — photo + details */}
      <button
        onClick={onOpen}
        className="flex items-center gap-4 flex-1 min-w-0 p-4 text-left hover:bg-secondary/30 active:bg-secondary/50 transition-colors"
        aria-label={`View ingredients for ${meal.name}`}
      >
        {meal.photo_url ? (
          <img
            src={meal.photo_url}
            alt={meal.name}
            className="w-[72px] h-[72px] rounded-xl object-cover shrink-0"
          />
        ) : (
          <div className="w-[72px] h-[72px] rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <span className="text-2xl">🍽️</span>
          </div>
        )}

        <div className="min-w-0">
          <p className="font-semibold text-sm leading-snug line-clamp-2">{meal.name}</p>
          {meal.prep_time != null && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{meal.prep_time} min</span>
              {meal.difficulty && (
                <>
                  <span className="mx-0.5">·</span>
                  <span>{meal.difficulty}</span>
                </>
              )}
            </div>
          )}
          <p className="text-xs text-primary/60 font-medium mt-1.5">Tap to see ingredients</p>
        </div>
      </button>

      {/* Remove — separate from the tap target */}
      <button
        onClick={onRemove}
        className="shrink-0 p-4 text-muted-foreground hover:text-destructive transition-colors"
        aria-label={`Remove ${meal.name} from basket`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

