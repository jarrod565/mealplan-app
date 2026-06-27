import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useFavorites } from '@/contexts/FavoritesContext'
import { useBasket } from '@/contexts/BasketContext'
import { fetchMealDetails } from '@/lib/spoonacular'
import { Clock, Heart, ShoppingBasket, Check, Loader2, X } from 'lucide-react'
import { formatIngredientQty } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import UserAvatar from '@/components/layout/UserAvatar'
import { cn } from '@/lib/utils'

export default function FavoritesPage() {
  const { favorites, toggleFavorite } = useFavorites()
  const { isInBasket, addToBasket } = useBasket()

  const [openMealId, setOpenMealId] = useState(null)
  const [drawerDetails, setDrawerDetails] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
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

  const openMeal = favorites.find((m) => m.meal_id === openMealId) ?? null

  return (
    <>
      <header className="flex items-center justify-between px-5 py-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Favorites</h1>
          {favorites.length > 0 && (
            <p className="text-xs text-muted-foreground">{favorites.length} saved</p>
          )}
        </div>
        <UserAvatar />
      </header>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <Heart className="w-7 h-7 text-primary/50" />
          </div>
          <div>
            <p className="font-semibold text-base">No favorites yet</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Tap the heart on any meal while swiping to save it here.
            </p>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="space-y-3">
            {favorites.map((meal) => (
              <FavoriteCard
                key={meal.meal_id}
                meal={meal}
                inBasket={isInBasket(meal.meal_id)}
                onOpen={() => setOpenMealId(meal.meal_id)}
                onUnfavorite={() => toggleFavorite(meal)}
                onAddToBasket={async () => {
                  try {
                    await addToBasket(meal)
                  } catch {
                    toast.error('Could not add to basket. Please try again.')
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      <Sheet open={openMealId !== null} onOpenChange={(v) => !v && setOpenMealId(null)}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="gap-0 p-0 w-full sm:max-w-sm flex flex-col"
        >
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

            <SheetClose className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50">
              <X className="w-4 h-4" />
              <span className="sr-only">Close</span>
            </SheetClose>

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

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <p className="text-[11px] font-bold text-primary/70 uppercase tracking-widest mb-4">
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

function FavoriteCard({ meal, inBasket, onOpen, onUnfavorite, onAddToBasket }) {
  return (
    <div className="flex items-stretch rounded-2xl bg-card shadow-sm overflow-hidden">
      {/* Square thumbnail */}
      <button
        onClick={onOpen}
        className="shrink-0 w-24 h-24"
        aria-label={`View ingredients for ${meal.name}`}
        tabIndex={-1}
      >
        {meal.photo_url ? (
          <img
            src={meal.photo_url}
            alt={meal.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <span className="text-2xl">🍽️</span>
          </div>
        )}
      </button>

      {/* Content */}
      <button
        onClick={onOpen}
        className="flex-1 min-w-0 px-4 py-3 text-left hover:bg-secondary/20 active:bg-secondary/40 transition-colors"
        aria-label={`View ingredients for ${meal.name}`}
      >
        {meal.difficulty && (
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wide mb-0.5">
            {meal.difficulty}
          </p>
        )}
        <p className="font-semibold text-sm leading-snug line-clamp-2 text-foreground">
          {meal.name}
        </p>
        {meal.prep_time != null && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{meal.prep_time} min</span>
          </div>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onAddToBasket() }}
          disabled={inBasket}
          className={cn(
            'mt-2 flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 transition-colors border',
            inBasket
              ? 'border-transparent bg-secondary text-secondary-foreground cursor-default'
              : 'border-primary/30 text-primary bg-primary/5 hover:bg-primary/10'
          )}
          aria-label={inBasket ? 'Already in basket' : `Add ${meal.name} to basket`}
        >
          {inBasket ? (
            <><Check className="w-3 h-3" />In Basket</>
          ) : (
            <><ShoppingBasket className="w-3 h-3" />Add to Basket</>
          )}
        </button>
      </button>

      {/* Unfavorite */}
      <button
        onClick={onUnfavorite}
        className="shrink-0 px-4 flex items-center text-rose-400 hover:text-rose-500 transition-colors"
        aria-label={`Remove ${meal.name} from favorites`}
        aria-pressed={true}
      >
        <Heart className="w-5 h-5 fill-current" />
      </button>
    </div>
  )
}
